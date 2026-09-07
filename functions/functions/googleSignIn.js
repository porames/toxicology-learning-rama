import { onRequest } from 'firebase-functions/v2/https';
import { admin, db } from '../lib/admin.js';
import { handleCors } from '../lib/cors.js';

export const googleSignIn = onRequest(async (req, res) => {
	try {
		if (handleCors(req, res)) return;

		const authHeader = req.headers.authorization;
		if (!authHeader?.startsWith('Bearer ')) {
			res.status(401).json({ error: 'Unauthorized' });
			return;
		}

		const idToken = authHeader.split('Bearer ')[1];
		const decoded = await admin.auth().verifyIdToken(idToken);

		if (decoded.firebase?.sign_in_provider !== 'google.com') {
			res.status(400).json({ error: 'Only Google sign-in is supported here.' });
			return;
		}

		const email = decoded.email;
		if (!email) {
			res.status(400).json({ error: 'Missing email' });
			return;
		}

		const emailLower = email.toLowerCase();
		const candidates = await db
			.collection('users')
			.where('email', 'in', [email, emailLower])
			.limit(1)
			.get();

		let userDoc = candidates.empty ? null : candidates.docs[0];

		if (!userDoc) {
			const lowerSnap = await db
				.collection('users')
				.where('emailLower', '==', emailLower)
				.limit(1)
				.get();
			if (!lowerSnap.empty) userDoc = lowerSnap.docs[0];
		}

		if (!userDoc) {
			res.json({ success: true, enrolled: false });
			return;
		}

		const data = userDoc.data();
		const previousAuthId = data.authId;

		if (previousAuthId && previousAuthId !== decoded.uid) {
			await admin
				.auth()
				.deleteUser(previousAuthId)
				.catch(() => {});
		}

		const role = data.role || 'student';

		if (role === 'teacher' && !data.signedUp) {
			const invite = data;
			await db
				.collection('users')
				.doc(decoded.uid)
				.set({
					authId: decoded.uid,
					email: email,
					emailLower,
					name: invite.name || decoded.name || email,
					role: 'teacher',
					displayName: decoded.name || invite.name || '',
					...(decoded.picture && { photoURL: decoded.picture }),
					signedUp: true,
					signedUpAt: admin.firestore.FieldValue.serverTimestamp(),
					createdAt: admin.firestore.FieldValue.serverTimestamp(),
				});
			await userDoc.ref.delete().catch(() => {});
			await admin.auth().setCustomUserClaims(decoded.uid, { role: 'teacher' });
			res.json({ success: true, enrolled: true, role: 'teacher', pendingTeacher: true });
			return;
		}

		await userDoc.ref.update({
			authId: decoded.uid,
			email: email,
			emailLower,
			displayName: decoded.name || data.name || '',
			...(decoded.picture && { photoURL: decoded.picture }),
			signedUp: true,
			signedUpAt: admin.firestore.FieldValue.serverTimestamp(),
		});

		await admin.auth().setCustomUserClaims(decoded.uid, { role });

		res.json({ success: true, enrolled: true, role });
	} catch (err) {
		console.error(err);
		res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
	}
});
