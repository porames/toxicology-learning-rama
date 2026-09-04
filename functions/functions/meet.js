import { onRequest } from "firebase-functions/v2/https";
import { readFileSync } from "node:fs";
import { OAuth2Client } from "google-auth-library";
import { admin, db } from "../lib/admin.js";
import { handleCors } from "../lib/cors.js";
import { verifyStaff } from "../lib/auth.js";

const MEET_API = "https://meet.googleapis.com/v2";
const SPACES_URL = `${MEET_API}/spaces`;
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TIMEZONE = "Asia/Bangkok";

const meetAccount = JSON.parse(readFileSync("../secret/meetAccount.json", "utf8"));
const MEET_KEYS = meetAccount.web ?? meetAccount.installed ?? {};

function loadOAuthClient(refreshToken) {
  const oauth = new OAuth2Client(MEET_KEYS.client_id, MEET_KEYS.client_secret);
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

    const { classId, title, startTime, endTime } = req.body ?? {};
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

export const getMeetParticipants = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    const user = await verifyStaff(req);

    const { meetingUri, classId, lectureId } = req.body ?? {};
    if (!meetingUri) {
      res.status(400).json({ error: "meetingUri is required" });
      return;
    }

    const token = await getAccessToken(user.uid);

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
    if (!record) {
      res.status(200).json({ conferenceRecord: null, participants: [] });
      return;
    }

    const partsRes = await fetch(`${MEET_API}/${record.name}/participants`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!partsRes.ok) {
      throw new Error(`Meet API error: ${await partsRes.text()}`);
    }
    const parts = await partsRes.json();

    const partsList = parts.participants ?? [];
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

    const participants = partsList.map((p, i) => {
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

    if (classId && lectureId) {
      await Promise.all(
        participants
          .filter((p) => p.uid && p.joinTime)
          .map((p) =>
            db
              .collection("users")
              .doc(p.uid)
              .collection("activities")
              .doc(lectureId)
              .set(
                {
                  classId,
                  lectureId,
                  meetSession: {
                    joinTime: new Date(p.joinTime),
                    leaveTime: p.leaveTime ? new Date(p.leaveTime) : null,
                    durationSec: p.sessionTimeSec,
                    displayName: p.displayName ?? "",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  },
                },
                { merge: true },
              )
              .catch((err) => console.warn("write meetSession error:", err)),
          ),
      );
    }

    res.status(200).json({
      conferenceRecord: record.name,
      startTime: record.startTime ?? null,
      endTime: record.endTime ?? null,
      participants,
    });
  } catch (err) {
    console.error("getMeetParticipants error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  }
});
