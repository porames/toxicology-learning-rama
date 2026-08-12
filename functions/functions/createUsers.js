import {onRequest} from "firebase-functions/v2/https";
import {admin, db} from "../lib/admin.js";
import {handleCors} from "../lib/cors.js";
import {verifyAdmin} from "../lib/auth.js";

const BASE_REQUIRED = ["email", "name", "role"];

export const createUsers = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyAdmin(req);

    const {students} = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({error: "Missing or empty students array"});
      return;
    }

    // Validate required fields and reject duplicates within the upload.
    const seenRama = new Map();
    const seenEmail = new Map();
    const cleaned = [];
    for (const s of students) {
      const missing = BASE_REQUIRED.filter((f) => !s[f]);
      const needsYear = s.role === "student" || s.role === "resident";
      if (needsYear && !s.year) missing.push("year");
      if (missing.length > 0) {
        res.status(400).json({
          error: `Student "${s.name || s.email}" is missing: ${missing.join(", ")}`,
        });
        return;
      }

      if (s.rama_id) {
        const ramaKey = String(s.rama_id).toLowerCase();
        if (seenRama.has(ramaKey)) {
          res.status(400).json({
            error: `Duplicate RAMA ID "${s.rama_id}" appears more than once in this upload.`,
          });
          return;
        }
        seenRama.set(ramaKey, s.rama_id);
      }
      const emailKey = String(s.email).toLowerCase();
      if (seenEmail.has(emailKey)) {
        res.status(400).json({
          error: `Duplicate email "${s.email}" appears more than once in this upload.`,
        });
        return;
      }
      seenEmail.set(emailKey, s.email);
      cleaned.push(s);
    }

    // Reject entries that collide with existing users (exact match, case-sensitive).
    const uniqueRamaIds = [...new Set(cleaned.filter((s) => s.rama_id).map((s) => String(s.rama_id)))];
    const uniqueEmails = [...new Set(cleaned.map((s) => String(s.email)))];
    const foundRama = new Set();
    const foundEmail = new Set();
    const CHUNK = 30;
    const queryCollisions = async (ids, field, found) => {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const snap = await db
            .collection("users")
            .where(field, "in", ids.slice(i, i + CHUNK))
            .get();
        snap.forEach((doc) => {
          const data = doc.data();
          if (data[field]) found.add(String(data[field]));
        });
      }
    };
    await queryCollisions(uniqueRamaIds, "rama_id", foundRama);
    await queryCollisions(uniqueEmails, "email", foundEmail);

    for (const s of cleaned) {
      if (s.rama_id && foundRama.has(String(s.rama_id))) {
        res.status(400).json({
          error: `RAMA ID "${s.rama_id}" is already in use by an existing user.`,
        });
        return;
      }
      if (foundEmail.has(String(s.email))) {
        res.status(400).json({
          error: `Email "${s.email}" is already in use by an existing user.`,
        });
        return;
      }
    }

    const batch = db.batch();
    const ids = [];

    for (const s of cleaned) {
      const ref = db.collection("users").doc();
      batch.set(ref, {
        email: s.email,
        name: s.name,
        year: s.year,
        role: s.role,
        ...(s.rama_id && {rama_id: s.rama_id}),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        signedUp: false,
      });
      ids.push(ref.id);
    }

    await batch.commit();

    res.json({success: true, count: cleaned.length, ids});
  } catch (err) {
    console.error("CODE:", err.code);
    console.error("DETAILS:", err.details);
    res.status(err.status || 500).json({error: err.message || "Internal server error"});
  }
});
