import {onRequest} from "firebase-functions/v2/https";
import {db} from "../lib/admin.js";
import {handleCors} from "../lib/cors.js";
import {verifyAdmin} from "../lib/auth.js";

export const deleteUser = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyAdmin(req);

    const {id} = req.body;
    if (!id || typeof id !== "string") {
      return res.status(400).json({message: "id is required."});
    }

    const userRef = db.collection("users").doc(id);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({message: `User not found: ${id}`});
    }

    await userRef.delete();
    return res.status(200).json({success: true});
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({message: err.message || "Something went wrong"});
  }
});
