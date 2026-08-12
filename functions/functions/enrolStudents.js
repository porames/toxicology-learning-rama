import { onRequest } from "firebase-functions/v2/https";
import { admin, db } from "../lib/admin.js";
import { handleCors } from "../lib/cors.js";
import { verifyAdmin } from "../lib/auth.js";
import { randomBytes } from "crypto";

const VALID_ROLES = ["student", "resident", "teacher", "admin"];

function toFirestoreDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}


async function findOrCreateUser(student) {
  try {
    const userRecord = await admin.auth().getUserByEmail(student.email);
    return { userRecord, isNew: false };
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      const newUser = await admin.auth().createUser({
        email: student.email,
        password: randomBytes(9).toString("base64url"),
        displayName: student.name,
        emailVerified: false,
        disabled: false,
      });
      await admin.auth().setCustomUserClaims(newUser.uid, { role: student.role });
      return { userRecord: newUser, isNew: true };
    }
    throw error;
  }
}

export const enrolStudents = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyAdmin(req);

    const { studentData, classId } = req.body;

    if (!Array.isArray(studentData) || studentData.length === 0 || !classId) {
      res.status(400).json({ error: "Missing data points" });
      return;
    }

    const batch = db.batch();
    let count = 0;

    for (const student of studentData) {
      if (!student.email || !student.name || !student.role || !student.electiveStart || !student.electiveEnd) {
        res.status(400).json({ error: "Missing data points" });
        return;
      }
      if (!VALID_ROLES.includes(student.role)) {
        res.status(400).json({
          error: `Invalid role "${student.role}". Must be one of ${VALID_ROLES.join(", ")}.`,
        });
        return;
      }

      const electiveStart = toFirestoreDate(student.electiveStart);
      const electiveEnd = toFirestoreDate(student.electiveEnd);
      if (!electiveStart || !electiveEnd) {
        res.status(400).json({ error: "electiveStart and electiveEnd must be valid dates" });
        return;
      }

      const { userRecord, isNew } = await findOrCreateUser(student);
      const userRef = db.collection("users").doc(userRecord.uid);
      const classRef = db.collection("classes").doc(classId);

      if (isNew) {
        batch.set(userRef, {
          authId: userRecord.uid,
          email: student.email,
          name: student.name,
          role: student.role,
          ...(student.year && {year: student.year}),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          signedUp: false,
          electiveStart,
          electiveEnd,
          enroledClasses: [classId],
        });
      } else {
        batch.set(
          userRef,
          {
            enroledClasses: admin.firestore.FieldValue.arrayUnion(classId),
            ...(student.year && {year: student.year}),
          },
          { merge: true },
        );
      }
      batch.set(
        classRef,
        { enroledStudents: admin.firestore.FieldValue.arrayUnion(userRecord.uid) },
        { merge: true },
      );
      count++;
    }

    await batch.commit();

    return res.status(200).json({ success: true, count });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
  }
});
