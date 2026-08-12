import {randomBytes} from "crypto";
import {onRequest} from "firebase-functions/v2/https";
import {admin, db} from "../lib/admin.js";
import {handleCors} from "../lib/cors.js";
import {verifyAdmin} from "../lib/auth.js";

export const createUser = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyAdmin(req);

    const {email, name, year, role, rama_id, electiveStart, electiveEnd} = req.body;
    const needsYear = role === "student" || role === "resident";
    if (!email || !name || !role || (needsYear && !year)) {
      res.status(400).json({error: "Missing data points"});
      return;
    }

    const filters = [admin.firestore.Filter.where("email", "==", email)];
    if (rama_id) filters.push(admin.firestore.Filter.where("rama_id", "==", rama_id));
    const snap = await db
        .collection("users")
        .where(filters.length === 1 ? filters[0] : admin.firestore.Filter.or(...filters))
        .limit(1)
        .get();

    if (!snap.empty) {
      const hit = snap.docs[0].data();
      const exists = rama_id && hit.rama_id === rama_id ? `RAMA ID "${rama_id}"` : `Email "${email}"`;
      res.status(400).json({error: `${exists} is already in use.`});
      return;
    }

    const password = randomBytes(9).toString("base64url");

    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: name,
        emailVerified: false,
        disabled: false,
      });
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        res.status(400).json({error: `Email "${email}" is already in use.`});
        return;
      }
      throw err;
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, {role});

    try {
      await db.collection("users").doc(userRecord.uid).set({
        authId: userRecord.uid,
        email,
        name,
        ...(year && {year}),
        role,
        ...(rama_id && {rama_id}),
        ...(electiveStart && {electiveStart: new Date(electiveStart)}),
        ...(electiveEnd && {electiveEnd: new Date(electiveEnd)}),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        signedUp: false,
      });
    } catch (err) {
      await admin.auth().deleteUser(userRecord.uid).catch(() => {});
      throw err;
    }

    res.json({success: true, id: userRecord.uid});
  } catch (err) {
    console.error("CODE:", err.code);
    console.error("DETAILS:", err.details);
    res.status(err.status || 500).json({error: err.message || "Internal server error"});
  }
});
