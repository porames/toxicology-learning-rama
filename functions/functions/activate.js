import {onRequest} from "firebase-functions/v2/https";
import {admin, db} from "../lib/admin.js";
import {handleCors} from "../lib/cors.js";

export const activate = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;

    const {email} = req.body;
    if (!email) {
      res.status(400).json({error: "Missing email"});
      return;
    }

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        res.status(404).json({error: "No account registered for this email."});
        return;
      }
      throw err;
    }

    const snap = await db
        .collection("users")
        .where("authId", "==", userRecord.uid)
        .limit(1)
        .get();

    if (snap.empty) {
      res.status(404).json({error: "No account registered for this email."});
      return;
    }

    const userDoc = snap.docs[0];
    if (userDoc.data().signedUp === true) {
      res.status(400).json({error: "This account is already activated."});
      return;
    }

    await userDoc.ref.update({
      signedUp: true,
      signedUpAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({success: true});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Internal server error"});
  }
});
