import {onRequest} from "firebase-functions/v2/https";
import {admin, db} from "../lib/admin.js";
import {handleCors} from "../lib/cors.js";
import {verifyAdmin} from "../lib/auth.js";

const VALID_ROLES = ["student", "resident", "teacher", "admin"];

export const updateUserRole = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyAdmin(req);

    const {id, role} = req.body;
    if (!id || typeof id !== "string") {
      return res.status(400).json({message: "id is required."});
    }
    if (!role || typeof role !== "string" || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        message: `role must be one of: ${VALID_ROLES.join(", ")}.`,
      });
    }

    const userRef = db.collection("users").doc(id);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({message: `User not found: ${id}`});
    }

    const userData = snap.data();

    await userRef.update({role});

    if (userData.authId) {
      await admin.auth().setCustomUserClaims(userData.authId, {role});
    }

    return res.status(200).json({
      success: true,
      id,
      role,
      claimUpdated: Boolean(userData.authId),
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({message: err.message || "Something went wrong"});
  }
});
