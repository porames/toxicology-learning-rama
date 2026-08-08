import { onRequest } from "firebase-functions/v2/https";
import { admin, db } from "../lib/admin.js";
import { handleCors } from "../lib/cors.js";
import { verifyUser } from "../lib/auth.js";

function checkRequirements(requiredAttachments, submissionAttachments) {
    const provided = new Set(
        (submissionAttachments ?? [])
            .map((a) => a.attachmentId)
            .filter(Boolean),
    );
    const missing = (requiredAttachments ?? []).filter(
        (req) => !provided.has(req.id),
    );
    return {
        met: missing.length === 0,
        requiredCount: (requiredAttachments ?? []).length,
        providedCount: provided.size,
        missing,
    };
}

export const submitAssignment = onRequest(async (req, res) => {
    try {
        if (handleCors(req, res)) return;
        const userData = await verifyUser(req);

        const { classId, assignmentId } = req.body;
        if (!classId || !assignmentId) {
            res.status(400).json({ error: "Missing data points" });
            return;
        }

        const assignmentSnap = await db
            .collection("classes")
            .doc(classId)
            .collection("assignments")
            .doc(assignmentId)
            .get();

        if (!assignmentSnap.exists) {
            return res.status(404).json({ error: `Assignment not found: ${assignmentId}` });
        }
        const assignmentData = assignmentSnap.data();

        const submissionSnap = await db
            .collection("classes")
            .doc(classId)
            .collection("assignments")
            .doc(assignmentId)
            .collection("submissions")
            .doc(userData.id)
            .get();

        if (!submissionSnap.exists) {
            return res.status(404).json({ error: "Submission not found" });
        }
        const submissionData = submissionSnap.data();

        const result = checkRequirements(
            assignmentData.requiredAttachments,
            submissionData.attachments,
        );

        const patch = {
            requirementsMet: result.met,
            missingAttachmentIds: result.missing.map((m) => m.id),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await submissionSnap.ref.update(patch);

        return res.status(200).json({
            classId,
            assignmentId,
            requirementsMet: result.met,
            requiredCount: result.requiredCount,
            providedCount: result.providedCount,
            missing: result.missing,
        });
    } catch (err) {
        console.error(err);
        return res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
    }
});
