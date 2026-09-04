import {onRequest} from "firebase-functions/v2/https";
import {admin, db} from "../lib/admin.js";
import {handleCors} from "../lib/cors.js";

const VALID_ROLES = ["student", "resident"];
const VALID_GENDERS = ["male", "female"];
const VALID_YEARS = {
  student: ["y4", "y5", "y6"],
  resident: ["r1", "r2", "r3"],
};

function toFirestoreDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export const signUpGoogle = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({error: "Unauthorized"});
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);

    if (decoded.firebase?.sign_in_provider !== "google.com") {
      res.status(400).json({error: "Only Google sign-up is supported here."});
      return;
    }

    const email = decoded.email;
    if (!email) {
      res.status(400).json({error: "Missing email"});
      return;
    }

    const {
      firstName,
      lastName,
      gender,
      role,
      year,
      hospital,
      department,
      phone,
      lineId,
      electiveStart,
      electiveEnd,
      assessmentFormUrl,
      assessmentFormPath,
      assessmentFormName,
    } = req.body;

    if (!firstName || !lastName || !gender || !role || !hospital || !phone || !year) {
      res.status(400).json({error: "Missing data points"});
      return;
    }

    if (!assessmentFormUrl || !assessmentFormPath || !assessmentFormName) {
      res.status(400).json({error: "Missing assessment form"});
      return;
    }

    if (!assessmentFormPath.startsWith("assessment-forms/")) {
      res.status(400).json({error: "Invalid assessment form path"});
      return;
    }

    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({error: `Invalid role "${role}". Must be one of ${VALID_ROLES.join(", ")}.`});
      return;
    }

    if (!VALID_GENDERS.includes(gender)) {
      res.status(400).json({error: `Invalid gender "${gender}". Must be one of ${VALID_GENDERS.join(", ")}.`});
      return;
    }

    if (!VALID_YEARS[role]?.includes(year)) {
      res.status(400).json({error: `Invalid year "${year}" for role "${role}".`});
      return;
    }

    if (role === "resident" && !department) {
      res.status(400).json({error: "Missing data points"});
      return;
    }

    const start = toFirestoreDate(electiveStart);
    const end = toFirestoreDate(electiveEnd);
    if (!start || !end) {
      res.status(400).json({error: "electiveStart and electiveEnd must be valid dates"});
      return;
    }

    const emailLower = email.toLowerCase();
    const existing = await db
        .collection("users")
        .where("email", "in", [email, emailLower])
        .limit(1)
        .get();

    if (!existing.empty) {
      await admin.auth().deleteUser(decoded.uid).catch(() => {});
      res.status(409).json({error: "Email already registered"});
      return;
    }

    await db.collection("users").doc(decoded.uid).set({
      authId: decoded.uid,
      email,
      emailLower,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      gender,
      role,
      year,
      hospital,
      ...(department && {department}),
      phone,
      ...(lineId && {lineId}),
      displayName: decoded.name || "",
      ...(decoded.picture && {photoURL: decoded.picture}),
      electiveStart: start,
      electiveEnd: end,
      assessmentFormUrl,
      assessmentFormPath,
      assessmentFormName,
      enroledClasses: [],
      signedUp: true,
      signedUpAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await admin.auth().setCustomUserClaims(decoded.uid, {role});

    res.json({success: true});
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({error: err.message || "Internal server error"});
  }
});
