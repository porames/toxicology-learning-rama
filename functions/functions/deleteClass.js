import {onRequest} from "firebase-functions/v2/https";
import {admin, db} from "../lib/admin.js";
import {handleCors} from "../lib/cors.js";
import {verifyAdmin} from "../lib/auth.js";

const BATCH_LIMIT = 400;

async function deleteInBatches(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export const deleteClass = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyAdmin(req);

    const {classId} = req.body;
    if (!classId || typeof classId !== "string") {
      return res.status(400).json({error: "classId is required"});
    }

    const classRef = db.collection("classes").doc(classId);
    const refsToDelete = [];

    const lecturesSnap = await classRef.collection("lectures").get();
    for (const lecture of lecturesSnap.docs) {
      const materialsSnap = await lecture.ref.collection("materials").get();
      materialsSnap.docs.forEach((m) => refsToDelete.push(m.ref));
      refsToDelete.push(lecture.ref);
    }

    const assignmentsSnap = await classRef.collection("assignments").get();
    for (const assignment of assignmentsSnap.docs) {
      const submissionsSnap = await assignment.ref.collection("submissions").get();
      submissionsSnap.docs.forEach((s) => refsToDelete.push(s.ref));
      refsToDelete.push(assignment.ref);
    }

    refsToDelete.push(classRef);

    await deleteInBatches(refsToDelete);

    const classSnap = await classRef.get();
    const enroledStudents = classSnap.exists
      ? (classSnap.data()?.enroledStudents ?? [])
      : [];

    for (let i = 0; i < enroledStudents.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      enroledStudents.slice(i, i + BATCH_LIMIT).forEach((uid) => {
        batch.update(db.collection("users").doc(uid), {
          enroledClasses: admin.firestore.FieldValue.arrayRemove(classId),
        });
      });
      await batch.commit();
    }

    return res.status(200).json({success: true});
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({error: err.message || "Something went wrong"});
  }
});
