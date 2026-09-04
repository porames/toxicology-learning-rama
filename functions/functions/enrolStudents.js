import { onRequest } from "firebase-functions/v2/https";
import { admin, db } from "../lib/admin.js";
import { handleCors } from "../lib/cors.js";
import { verifyAdmin } from "../lib/auth.js";

export const enrolStudents = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyAdmin(req);

    const { classId, studentIds } = req.body;

    if (!classId || !Array.isArray(studentIds) || studentIds.length === 0) {
      res.status(400).json({ error: "Missing data points" });
      return;
    }

    const classRef = db.collection("classes").doc(classId);

    const batch = db.batch();
    for (const id of studentIds) {
      const userRef = db.collection("users").doc(id);
      batch.set(
        userRef,
        { enroledClasses: admin.firestore.FieldValue.arrayUnion(classId) },
        { merge: true },
      );
      batch.set(
        classRef,
        { enroledStudents: admin.firestore.FieldValue.arrayUnion(id) },
        { merge: true },
      );
    }

    await batch.commit();

    return res.status(200).json({ success: true, count: studentIds.length });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
  }
});
