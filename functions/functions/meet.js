import { onRequest } from "firebase-functions/v2/https";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { CloudTasksClient } from "@google-cloud/tasks";
import { OAuth2Client } from "google-auth-library";
import { admin, db } from "../lib/admin.js";
import { handleCors } from "../lib/cors.js";
import { verifyStaff, verifyAdmin } from "../lib/auth.js";

const MEET_API = "https://meet.googleapis.com/v2";
const SPACES_URL = `${MEET_API}/spaces`;
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TIMEZONE = "Asia/Bangkok";

// Auto-sync tuning: run SYNC_BUFFER_MIN after lecture end, retry on missing
// conference records for ~2h before marking failed.
const SYNC_BUFFER_MIN = 10;
const MAX_ATTEMPTS = 5;

// Cloud Tasks wiring (one-time setup: create the queue once with gcloud).
// Every scheduled marker gets exactly one task via the Firestore trigger below.
const TASK_REGION = "us-central1";
const SYNC_QUEUE = process.env.MEET_SYNC_QUEUE ?? "meet-sync";
const WORKER_NAME = "meetSyncWorker";

function workerUrl() {
  const project = process.env.GCLOUD_PROJECT ?? "rama-toxico-edu";
  return `https://${TASK_REGION}-${project}.cloudfunctions.net/${WORKER_NAME}`;
}

function workerServiceAccount() {
  const project = process.env.GCLOUD_PROJECT ?? "rama-toxico-edu";
  return process.env.MEET_SYNC_SA_EMAIL ?? `${project}@appspot.gserviceaccount.com`;
}

let tasksClient = null;
function getTasksClient() {
  if (!tasksClient) tasksClient = new CloudTasksClient();
  return tasksClient;
}

// Enqueue exactly one sync task per schedule. Task name embeds runAtMs so
// re-schedules are idempotent (ALREADY_EXISTS = a live task already covers it).
async function enqueueSyncTask({ classId, lectureId, runAtMs }) {
  if (process.env.FUNCTIONS_EMULATOR) {
    console.log("skip task enqueue (emulator)", { classId, lectureId, runAtMs });
    return;
  }
  const project = process.env.GCLOUD_PROJECT ?? "rama-toxico-edu";
  const client = getTasksClient();
  const parent = client.queuePath(project, TASK_REGION, SYNC_QUEUE);
  const task = {
    name: client.taskPath(
      project,
      TASK_REGION,
      SYNC_QUEUE,
      `sync-${classId}-${lectureId}-${runAtMs}`,
    ),
    scheduleTime: { seconds: Math.floor(runAtMs / 1000) },
    httpRequest: {
      httpMethod: "POST",
      url: workerUrl(),
      oidcToken: { serviceAccountEmail: workerServiceAccount() },
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify({ data: { classId, lectureId } })).toString("base64"),
    },
  };
  await client.createTask({ parent, task });
}

let cachedMeetKeys = null;
function meetKeys() {
  if (!cachedMeetKeys) {
    const raw = process.env.MEET_ACCOUNT_JSON;
    if (!raw) throw new Error("MEET_ACCOUNT_JSON env var is not set");
    cachedMeetKeys = JSON.parse(raw).web ?? {};
  }
  return cachedMeetKeys;
}

function loadOAuthClient(refreshToken) {
  const { client_id, client_secret } = meetKeys();
  const oauth = new OAuth2Client(client_id, client_secret);
  oauth.setCredentials({ refresh_token: refreshToken });
  return oauth;
}

async function getUserRefreshToken(uid) {
  const snap = await db.collection("meetOAuth").doc(uid).get();
  return snap.exists ? snap.data().refreshToken : null;
}

async function getAccessToken(uid) {
  const refreshToken = await getUserRefreshToken(uid);
  if (!refreshToken) {
    const err = new Error("connect_google_meet");
    err.status = 400;
    throw err;
  }
  const oauth = loadOAuthClient(refreshToken);
  const { token } = await oauth.getAccessToken();
  return token;
}

// Resolve a Meet API token: prefer the meeting owner's, fall back to any
// other connected staff account (any staff token can read conference records).
async function resolveAccessToken(preferredUid) {
  if (preferredUid) {
    try {
      return { token: await getAccessToken(preferredUid), uid: preferredUid };
    } catch (err) {
      console.warn("owner meet token unavailable, trying other accounts:", err.message);
    }
  }
  const snaps = await db.collection("meetOAuth").limit(10).get();
  for (const d of snaps.docs) {
    if (d.id === preferredUid) continue;
    try {
      return { token: await getAccessToken(d.id), uid: d.id };
    } catch {
      // try next account
    }
  }
  const err = new Error("connect_google_meet");
  err.status = 400;
  throw err;
}

async function getStudentEmails(classId) {
  const classSnap = await db.collection("classes").doc(classId).get();
  const enroled = classSnap.exists ? classSnap.data().enroledStudents ?? [] : [];
  const emails = [];
  for (const docId of enroled) {
    const snap = await db.collection("users").doc(docId).get();
    if (snap.exists && snap.data().email) emails.push(snap.data().email);
  }
  return emails;
}

async function createCalendarEvent(token, { classId, title, startTime, endTime, meetingUri }) {
  const emails = await getStudentEmails(classId);
  const event = {
    summary: title || "Online class",
    start: { dateTime: new Date(startTime).toISOString(), timeZone: TIMEZONE },
    end: { dateTime: new Date(endTime).toISOString(), timeZone: TIMEZONE },
    attendees: emails.map((email) => ({ email })),
    conferenceData: {
      conferenceSolution: { key: { type: "hangoutsMeet" }, name: "Google Meet" },
      entryPoints: [{ entryPointType: "video", uri: meetingUri, label: meetingUri }],
    },
  };
  const res = await fetch(`${CALENDAR_EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    throw new Error(`Calendar API error: ${await res.text()}`);
  }
  const data = await res.json();
  return { eventId: data.id, htmlLink: data.htmlLink };
}

export const createMeetSpace = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    const user = await verifyStaff(req);

    const { classId, lectureId, title, startTime, endTime } = req.body ?? {};
    const token = await getAccessToken(user.uid);
    const meetRes = await fetch(SPACES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!meetRes.ok) {
      throw new Error(`Meet API error: ${await meetRes.text()}`);
    }
    const space = await meetRes.json();
    const meetingUri = space.meetingUri;

    let eventId = null;
    let htmlLink = null;
    if (classId) {
      try {
        const invite = await createCalendarEvent(token, {
          classId,
          title,
          startTime,
          endTime,
          meetingUri,
        });
        eventId = invite.eventId;
        htmlLink = invite.htmlLink;
      } catch (err) {
        console.error("createCalendarEvent error:", err);
      }
    }

    // Schedule the end-of-meeting auto-sync. Guarded by lecture existence:
    // brand-new (unsaved) lectures get their marker from the editor save flow.
    if (classId && lectureId && endTime) {
      try {
        const lecRef = db.collection("classes").doc(classId).collection("lectures").doc(lectureId);
        if ((await lecRef.get()).exists) {
          const endMs = Date.parse(endTime);
          const runAt = new Date(
            Math.max(
              Number.isNaN(endMs) ? Date.now() : endMs + SYNC_BUFFER_MIN * 60 * 1000,
              Date.now(),
            ),
          );
          await lecRef.set(
            {
              sessionSync: {
                status: "scheduled",
                runAt,
                meetingUri,
                ownerUid: user.uid,
                attempts: 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
            { merge: true },
          );
        }
      } catch (err) {
        console.error("write sessionSync marker error:", err);
      }
    }

    res.status(200).json({
      meetingUri,
      meetingCode: space.meetingCode,
      name: space.name,
      eventId,
      htmlLink,
    });
  } catch (err) {
    console.error("createMeetSpace error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  }
});

export const getMeetInvitees = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyStaff(req);

    const { classId } = req.body ?? {};
    if (!classId) {
      res.status(400).json({ error: "classId is required" });
      return;
    }

    const classSnap = await db.collection("classes").doc(classId).get();
    const enroled = classSnap.exists ? classSnap.data().enroledStudents ?? [] : [];

    const chunkSize = 30;
    const chunks = [];
    for (let i = 0; i < enroled.length; i += chunkSize) {
      chunks.push(enroled.slice(i, i + chunkSize));
    }

    const snapshots = await Promise.all(
      chunks.map((chunk) =>
        db
          .collection("users")
          .where(admin.firestore.FieldPath.documentId(), "in", chunk)
          .get(),
      ),
    );

    const invitees = snapshots
      .flatMap((snap) => snap.docs.map((d) => d.data()))
      .filter((u) => u.email)
      .map((u) => ({ name: u.name ?? "", email: u.email }));

    res.status(200).json({ invitees });
  } catch (err) {
    console.error("getMeetInvitees error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  }
});

async function fetchConferenceData(token, meetingUri) {
  const meetingCode = String(meetingUri).trim().replace(/\/+$/, "").split("/").pop();
  const filter = `space.meeting_code="${meetingCode}"`;
  const recordsRes = await fetch(
    `${MEET_API}/conferenceRecords?filter=${encodeURIComponent(filter)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!recordsRes.ok) {
    throw new Error(`Meet API error: ${await recordsRes.text()}`);
  }
  const records = await recordsRes.json();
  const record = records.conferenceRecords?.[0] ?? null;
  if (!record) return { record: null, partsList: [], sessionLists: [] };

  const partsRes = await fetch(`${MEET_API}/${record.name}/participants`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!partsRes.ok) {
    throw new Error(`Meet API error: ${await partsRes.text()}`);
  }
  const parts = await partsRes.json();

  const partsList = parts.participants ?? [];
  const sessionLists = await Promise.all(
    partsList.map(async (p) => {
      if (!p.name) return [];
      try {
        const res = await fetch(`${MEET_API}/${p.name}/participantSessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.participantSessions ?? [];
      } catch (err) {
        console.error("participantSessions error:", err);
        return [];
      }
    }),
  );
  return { record, partsList, sessionLists };
}

async function matchUsersByDisplayName(partsList) {
  const displayNames = [
    ...new Set(
      partsList
        .map((p) => p.signedinUser?.displayName ?? p.anonymousUser?.displayName ?? null)
        .filter((n) => typeof n === "string" && n.trim() !== ""),
    ),
  ];

  const chunkSize = 30;
  const chunks = [];
  for (let i = 0; i < displayNames.length; i += chunkSize) {
    chunks.push(displayNames.slice(i, i + chunkSize));
  }
  const userSnaps = await Promise.all(
    chunks.map((chunk) =>
      db.collection("users").where("displayName", "in", chunk).get(),
    ),
  );
  const userByDisplayName = new Map();
  for (const snap of userSnaps) {
    for (const doc of snap.docs) {
      const u = doc.data();
      if (!u.email) continue;
      userByDisplayName.set(u.displayName ?? "", {
        uid: doc.id,
        email: u.email,
        realName: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || "",
      });
    }
  }
  return userByDisplayName;
}

function buildParticipants(partsList, sessionLists, userByDisplayName) {
  return partsList.map((p, i) => {
    const displayName = p.signedinUser?.displayName ?? p.anonymousUser?.displayName ?? null;
    const user = displayName ? userByDisplayName.get(displayName) : undefined;
    const sessions = sessionLists[i] ?? [];
    const starts = sessions
      .map((s) => s.startTime)
      .filter((v) => typeof v === "string" && v);
    const ends = sessions
      .map((s) => s.endTime)
      .filter((v) => typeof v === "string" && v);
    const joinTime = starts.length ? starts.sort()[0] : null;
    const leaveTime = ends.length ? ends.sort().reverse()[0] : null;
    const sessionTimeSec = sessions.reduce((acc, s) => {
      if (s.startTime && s.endTime) {
        const diff = Date.parse(s.endTime) - Date.parse(s.startTime);
        if (!isNaN(diff) && diff > 0) acc += diff / 1000;
      }
      return acc;
    }, 0);
    return {
      name: p.name,
      uid: user?.uid ?? null,
      email: user?.email ?? null,
      displayName,
      realName: user?.realName ?? null,
      type: p.signedinUser ? "signedin" : "anonymous",
      joinTime,
      leaveTime,
      sessionTimeSec: sessionTimeSec > 0 ? sessionTimeSec : null,
    };
  });
}

function isManualEntry(p) {
  return !!p && (p.manualOverride === true || p.type === "manual");
}

// Merge-safe persist: keeps manual-override participants in sessionData and
// never overwrites a manually-set meetSession in activities. Returns the
// merged participant list. Skips the sessionData write when there is no
// conference record yet (nothing to cache).
async function persistAttendance({ record, participants, classId, lectureId }) {
  if (!classId || !lectureId) return participants;
  const lecRef = db.collection("classes").doc(classId).collection("lectures").doc(lectureId);
  const lecSnap = await lecRef.get();
  const lecData = lecSnap.exists ? (lecSnap.data() ?? {}) : {};
  const prevParts = Array.isArray(lecData.sessionData?.participants)
    ? lecData.sessionData.participants
    : [];
  const freshKeys = new Set(
    participants.flatMap((p) => {
      const keys = [];
      if (p.email) keys.push(`e:${String(p.email).toLowerCase()}`);
      if (p.uid) keys.push(`u:${p.uid}`);
      return keys;
    }),
  );
  const keptManual = prevParts.filter((p) => {
    if (!isManualEntry(p)) return false;
    const emailKey = p.email ? `e:${String(p.email).toLowerCase()}` : null;
    const uidKey = p.uid ? `u:${p.uid}` : null;
    return !((emailKey && freshKeys.has(emailKey)) || (uidKey && freshKeys.has(uidKey)));
  });
  const merged = [...participants, ...keptManual];

  if (record) {
    await lecRef.set(
      {
        sessionData: {
          conferenceRecord: record.name,
          startTime: record.startTime ?? null,
          endTime: record.endTime ?? null,
          participants: merged,
        },
      },
      { merge: true },
    );
  }

  let requiresPostTest = false;
  try {
    const materials = lecData.materials ?? [];
    requiresPostTest = materials.some((m) => m.type === "quiz" && m.requiredPostTest);
  } catch (err) {
    console.warn("read lecture materials error:", err);
  }
  await Promise.all(
    merged
      .filter((p) => p.uid && p.joinTime && !isManualEntry(p))
      .map(async (p) => {
        try {
          const actRef = db.collection("users").doc(p.uid).collection("activities").doc(lectureId);
          const existing = await actRef.get();
          if (existing.exists && existing.data()?.meetSession?.manualOverride) return;
          const payload = {
            classId,
            lectureId,
            checkedInAt: new Date(p.joinTime),
            meetSession: {
              joinTime: new Date(p.joinTime),
              leaveTime: p.leaveTime ? new Date(p.leaveTime) : null,
              durationSec: p.sessionTimeSec,
              displayName: p.displayName ?? "",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          };
          // Lectures without a required post-test auto-complete on leave.
          // Post-test lectures only get checked in; completion stays manual.
          if (!requiresPostTest && p.leaveTime) {
            payload.completedAt = new Date(p.leaveTime);
          }
          await actRef.set(payload, { merge: true });
        } catch (err) {
          console.warn("write meetSession error:", err);
        }
      }),
  );
  return merged;
}

async function syncMeeting({ ownerUid, meetingUri, classId, lectureId }) {
  const { token } = await resolveAccessToken(ownerUid);
  const { record, partsList, sessionLists } = await fetchConferenceData(token, meetingUri);
  const userByDisplayName = await matchUsersByDisplayName(partsList);
  const participants = buildParticipants(partsList, sessionLists, userByDisplayName);
  const merged = await persistAttendance({ record, participants, classId, lectureId });
  return { record, participants: merged };
}

export const getMeetParticipants = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    const user = await verifyStaff(req);

    const { meetingUri, classId, lectureId } = req.body ?? {};
    if (!meetingUri) {
      res.status(400).json({ error: "meetingUri is required" });
      return;
    }

    const { record, participants } = await syncMeeting({
      ownerUid: user.uid,
      meetingUri,
      classId,
      lectureId,
    });

    // A manual check that finds a record completes any pending auto-sync,
    // so the scheduled task doesn't redo the work.
    if (record && classId && lectureId) {
      try {
        const lecRef = db.collection("classes").doc(classId).collection("lectures").doc(lectureId);
        const lecSnap = await lecRef.get();
        if (lecSnap.exists && lecSnap.data()?.sessionSync) {
          await writeMarker(lecRef, {
            status: "done",
            meetingUri,
            ownerUid: user.uid,
            attempts: (lecSnap.data()?.sessionSync?.attempts ?? 0) + 1,
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn("mark manual sync done error:", err);
      }
    }

    res.status(200).json({
      conferenceRecord: record?.name ?? null,
      startTime: record?.startTime ?? null,
      endTime: record?.endTime ?? null,
      participants,
    });
  } catch (err) {
    console.error("getMeetParticipants error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  }
});

async function writeMarker(lecRef, marker) {
  await lecRef.set({ sessionSync: marker }, { merge: true });
}

async function processDueLecture(classId, lectureId) {
  const lecRef = db.collection("classes").doc(classId).collection("lectures").doc(lectureId);
  const snap = await lecRef.get();
  if (!snap.exists) return;
  const data = snap.data() ?? {};
  const marker = data.sessionSync ?? {};
  if (marker.status !== "scheduled") return;
  // Early delivery (e.g. superseded schedule): leave it for the live task.
  const runAtMs = marker.runAt?.toDate?.()?.getTime?.() ?? 0;
  if (runAtMs > Date.now() + 5 * 60 * 1000) return;

  const meetMat = (data.materials ?? []).find((m) => m.type === "meet" && m.value);
  const meetingUri = meetMat?.value ?? marker.meetingUri;
  if (!meetingUri) {
    await writeMarker(lecRef, { ...marker, status: "failed", lastError: "no_meeting" });
    return;
  }
  // Teacher replaced the meeting after scheduling: restart attempts for the new URI.
  const attempts = marker.meetingUri && marker.meetingUri !== meetingUri ? 0 : (marker.attempts ?? 0);

  // Lecture extended after scheduling: push the run out past the new end.
  const endMs = data.endTime?.toDate?.()?.getTime?.() ?? 0;
  if (endMs && endMs + SYNC_BUFFER_MIN * 60 * 1000 > Date.now()) {
    await writeMarker(lecRef, {
      status: "scheduled",
      runAt: new Date(endMs + SYNC_BUFFER_MIN * 60 * 1000),
      meetingUri,
      ownerUid: marker.ownerUid ?? null,
      attempts,
    });
    return;
  }

  try {
    const { record } = await syncMeeting({
      ownerUid: marker.ownerUid ?? undefined,
      meetingUri,
      classId,
      lectureId,
    });
    if (!record) {
      // No conference record yet (Meet API lag): bump attempts and throw so
      // the task redelivers after the queue backoff. Terminal state acks.
      const next = attempts + 1;
      if (next >= MAX_ATTEMPTS) {
        await writeMarker(lecRef, {
          status: "failed",
          meetingUri,
          ownerUid: marker.ownerUid ?? null,
          attempts: next,
          lastError: "no_conference_record",
        });
        return;
      }
      await writeMarker(lecRef, {
        status: "scheduled",
        runAt: marker.runAt ?? new Date(),
        meetingUri,
        ownerUid: marker.ownerUid ?? null,
        attempts: next,
        enqueuedFor: marker.enqueuedFor ?? null,
      });
      throw new Error("no_conference_record_yet");
    }
    await writeMarker(lecRef, {
      status: "done",
      meetingUri,
      ownerUid: marker.ownerUid ?? null,
      attempts: attempts + 1,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("processDueLecture error:", err);
    if (err?.message === "no_conference_record_yet") throw err;
    const next = attempts + 1;
    const fatal = err?.message === "connect_google_meet" || next >= MAX_ATTEMPTS;
    if (fatal) {
      await writeMarker(lecRef, {
        status: "failed",
        meetingUri,
        ownerUid: marker.ownerUid ?? null,
        attempts: next,
        lastError: err?.message ?? "error",
      });
      return;
    }
    await writeMarker(lecRef, {
      status: "scheduled",
      runAt: marker.runAt ?? new Date(),
      meetingUri,
      ownerUid: marker.ownerUid ?? null,
      attempts: next,
      enqueuedFor: marker.enqueuedFor ?? null,
    });
    throw err;
  }
}

// Enqueues exactly one sync task per scheduled marker. Fires on every
// lecture write but early-exits unless there is a new/changed schedule:
// the marker's enqueuedFor tracks which runAt already has a live task.
export const onLectureSyncMarker = onDocumentWritten(
  "classes/{classId}/lectures/{lectureId}",
  async (event) => {
    const after = event.data?.after?.data() ?? {};
    const marker = after.sessionSync;
    if (!marker || marker.status !== "scheduled" || !marker.runAt) return;
    const runAtMs = marker.runAt?.toDate?.()?.getTime?.() ?? 0;
    if (!runAtMs || marker.enqueuedFor === runAtMs) return;
    const { classId, lectureId } = event.params;
    try {
      await enqueueSyncTask({ classId, lectureId, runAtMs });
    } catch (err) {
      if (err?.code !== 6) {
        console.error("enqueueSyncTask error:", err);
        return;
      }
      // ALREADY_EXISTS: a live task already covers this schedule.
    }
    try {
      await event.data.after.ref.set(
        { sessionSync: { ...marker, enqueuedFor: runAtMs } },
        { merge: true },
      );
    } catch (err) {
      console.error("mark task enqueued error:", err);
    }
  },
);

export const meetSyncWorker = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 6,
      minBackoffSeconds: 1800,
      maxBackoffSeconds: 1800,
      maxDoublings: 0,
    },
    rateLimits: { maxDispatchesPerSecond: 5, maxConcurrentDispatches: 10 },
  },
  async (req) => {
    const { classId, lectureId } = req.data ?? {};
    if (!classId || !lectureId) return;
    await processDueLecture(classId, lectureId);
  },
);

export const overrideMeetAttendance = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    const adminUser = await verifyAdmin(req);

    const { classId, lectureId, studentDocId, attended } = req.body ?? {};
    if (!classId || !lectureId || !studentDocId || typeof attended !== "boolean") {
      res.status(400).json({ error: "classId, lectureId, studentDocId, attended are required" });
      return;
    }

    const userSnap = await db.collection("users").doc(studentDocId).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "student not found" });
      return;
    }
    const userData = userSnap.data() ?? {};
    const email = userData.email ?? null;
    if (!email) {
      res.status(400).json({ error: "student has no email" });
      return;
    }
    const emailLower = String(email).toLowerCase();

    const lecRef = db.collection("classes").doc(classId).collection("lectures").doc(lectureId);
    const [lecSnap, classSnap] = await Promise.all([
      lecRef.get(),
      db.collection("classes").doc(classId).get(),
    ]);
    if (!lecSnap.exists) {
      res.status(404).json({ error: "lecture not found" });
      return;
    }
    const lecData = lecSnap.data() ?? {};
    const materials = lecData.materials ?? [];
    const requiresPostTest = materials.some((m) => m.type === "quiz" && m.requiredPostTest);
    const sessionData = lecData.sessionData ?? {
      conferenceRecord: null,
      startTime: null,
      endTime: null,
      participants: [],
    };
    const existingParts = Array.isArray(sessionData.participants)
      ? sessionData.participants
      : [];

    // Manual attendance is backdated to the end of class: class doc's classEnd,
    // falling back to the lecture's endTime, then to now.
    const toDate = (v) => (v?.toDate ? v.toDate() : null);
    const attendedAt =
      toDate(classSnap.exists ? classSnap.data().classEnd : null) ??
      toDate(lecData.endTime) ??
      new Date();
    const attendedAtISO = attendedAt.toISOString();
    const nowISO = new Date().toISOString();
    const matches = (p) =>
      (p.email && String(p.email).toLowerCase() === emailLower) || (p.uid && p.uid === studentDocId);

    let nextParts;
    if (attended) {
      const displayName = userData.displayName ?? userData.name ?? null;
      const realName =
        [userData.firstName, userData.lastName].filter(Boolean).join(" ") ||
        userData.name ||
        null;
      const manualPart = {
        name: existingParts.find(matches)?.name ?? null,
        uid: studentDocId,
        email,
        displayName,
        realName,
        type: "manual",
        joinTime: attendedAtISO,
        leaveTime: null,
        sessionTimeSec: null,
        manualOverride: true,
        manualBy: adminUser.uid,
        updatedAt: nowISO,
      };
      nextParts = [...existingParts.filter((p) => !matches(p)), manualPart];
    } else {
      nextParts = existingParts.filter((p) => !matches(p));
    }

    await lecRef.update({
      sessionData: { ...sessionData, participants: nextParts },
    });

    const actRef = db
      .collection("users")
      .doc(studentDocId)
      .collection("activities")
      .doc(lectureId);
    const actSnap = await actRef.get();
    const actData = actSnap.exists ? (actSnap.data() ?? {}) : {};
    if (attended) {
      // Keep a genuine check-in/completion; only fill in what's missing.
      const setCheckedIn = !actData.checkedInAt;
      const setCompleted = !requiresPostTest && !actData.completedAt;
      const payload = {
        classId,
        lectureId,
        meetSession: {
          joinTime: attendedAt,
          leaveTime: null,
          durationSec: null,
          displayName: userData.displayName ?? userData.name ?? "",
          manualOverride: true,
          updatedBy: adminUser.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        attendanceOverride: {
          by: adminUser.uid,
          at: admin.firestore.FieldValue.serverTimestamp(),
          setCheckedIn,
          setCompleted,
        },
      };
      if (setCheckedIn) payload.checkedInAt = attendedAt;
      if (setCompleted) payload.completedAt = attendedAt;
      await actRef.set(payload, { merge: true });
    } else {
      if (actSnap.exists) {
        // Only undo what this override set; genuine manual check-ins survive.
        const marker = actData.attendanceOverride ?? {};
        const del = admin.firestore.FieldValue.delete();
        const patch = { meetSession: del, attendanceOverride: del };
        if (marker.setCheckedIn) patch.checkedInAt = del;
        if (marker.setCompleted) patch.completedAt = del;
        await actRef.set(patch, { merge: true });
      }
    }

    res.status(200).json({ participants: nextParts });
  } catch (err) {
    console.error("overrideMeetAttendance error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  }
});
