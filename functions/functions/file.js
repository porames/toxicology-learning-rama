import { onRequest } from "firebase-functions/v2/https";
import { admin, storage, db } from "../lib/admin.js";
import { handleCors } from "../lib/cors.js";
import { verifyUser } from "../lib/auth.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadMaterial = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    const user = await verifyUser(req);

    const { originalName, description, fileData } = req.body ?? {};
    if (!originalName || !fileData) {
      res
        .status(400)
        .json({ error: "Missing required fields: originalName, fileData" });
      return;
    }

    const match = fileData.match(/^data:(.*?);base64,(.+)$/);
    if (!match) {
      res
        .status(400)
        .json({ error: "Invalid file data. Must be a base64-encoded data URL." });
      return;
    }

    const contentType = match[1] || "application/octet-stream";
    const buffer = Buffer.from(match[2], "base64");

    if (buffer.length > MAX_FILE_BYTES) {
      res.status(400).json({ error: "File exceeds the 10 MB limit." });
      return;
    }

    const ext = originalName.split(".").pop() || "";
    const fileName = ext ? `${crypto.randomUUID()}.${ext}` : crypto.randomUUID();
    const storagePath = `files/${user.uid}/${fileName}`;
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);

    await file.save(buffer, { metadata: { contentType } });

    await file.makePublic();
    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const docRef = db.collection("files").doc();
    await docRef.set({
      originalName,
      storagePath,
      description: typeof description === "string" ? description : "",
      downloadUrl,
      userId: user.uid,
      userName: user.name ?? "",
      userEmail: user.email ?? "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "uploaded",
    });

    res.status(200).json({ downloadUrl, fileId: docRef.id, storagePath });
  } catch (err) {
    console.error("createFile error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});
