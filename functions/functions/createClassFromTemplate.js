import {onRequest} from "firebase-functions/v2/https";
import {admin, db} from "../lib/admin.js";
import {handleCors} from "../lib/cors.js";
import {verifyAdmin} from "../lib/auth.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function timeIndex(t) {
  const week = t?.week ?? 1;
  const day = t?.day ?? 1;
  return (week - 1) * 7 + (day - 1);
}

function timeOfDay(value) {
  const d = value?.toDate ? value.toDate() : new Date(value);
  return d.getHours() * 3600000 + d.getMinutes() * 60000 + d.getSeconds() * 1000;
}

export const createClassFromTemplate = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyAdmin(req);

    const {templateId, name, code, startDate, studentIds} = req.body;
    if (!templateId || !name || !startDate) {
      res.status(400).json({error: "Missing data points"});
      return;
    }

    const templateSnap = await db
        .collection("courseTemplates")
        .doc(templateId)
        .get();
    if (!templateSnap.exists) {
      return res.status(404).json({error: `Template not found: ${templateId}`});
    }
    const templateData = templateSnap.data();
    const lectureTemplates = (templateData?.lectures ?? []).map((l) => ({
      id: l.id,
      ...l,
    }));
    lectureTemplates.sort((a, b) => timeIndex(a.startTime) - timeIndex(b.startTime));

    const baseStart = startOfDay(new Date(startDate));

    const classRef = db.collection("classes").doc();
    const classId = classRef.id;

    const batch = db.batch();
    let opCount = 0;

    batch.set(classRef, {
      name,
      code: code ?? templateData.code ?? "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    opCount++;

    for (const lec of lectureTemplates) {
      const startTime = new Date(
          baseStart.getTime() + timeIndex(lec.startTime) * DAY_MS + timeOfDay(lec.startTime.time),
      );
      const endTime = new Date(
          baseStart.getTime() + timeIndex(lec.endTime) * DAY_MS + timeOfDay(lec.endTime.time),
      );

      const lectureRef = db.collection("classes", classId, "lectures").doc();
      const matRefs = (lec.materials ?? []).map((matData) => ({
        ref: db.collection("classes", classId, "lectures", lectureRef.id, "materials").doc(),
        data: matData,
      }));
      batch.set(lectureRef, {
        title: lec.title || "Untitled lecture",
        startTime,
        endTime,
        materialsOrder: matRefs.map((x) => x.ref.id),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      opCount++;

      for (const {ref, data} of matRefs) {
        batch.set(ref, {
          type: data.type,
          title: data.title,
          value: data.value ?? "",
          ...(data.requiredPostTest !== undefined
              ? {requiredPostTest: data.requiredPostTest}
              : {}),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        opCount++;
      }

      if (opCount >= 400) {
        await batch.commit();
        opCount = 0;
      }
    }

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      const cleaned = [...new Set(studentIds.filter((id) => typeof id === "string"))];
      if (cleaned.length > 0) {
        batch.update(classRef, {
          enroledStudents: admin.firestore.FieldValue.arrayUnion(...cleaned),
        });
        cleaned.forEach((id) => {
          batch.update(db.collection("users").doc(id), {
            enroledClasses: admin.firestore.FieldValue.arrayUnion(classId),
          });
        });
        opCount += 1 + cleaned.length;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    return res.status(200).json({success: true, classId});
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({error: err.message || "Something went wrong"});
  }
});
