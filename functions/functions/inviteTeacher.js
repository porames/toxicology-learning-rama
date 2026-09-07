import { onRequest } from 'firebase-functions/v2/https';
import { readFileSync } from 'node:fs';
import { OAuth2Client } from 'google-auth-library';
import { admin, db } from '../lib/admin.js';
import { handleCors } from '../lib/cors.js';
import { verifyAdmin } from '../lib/auth.js';

const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const APP_BASE_URL_DEV = 'http://localhost:5173/poisoncenter/th/elearning';
const APP_BASE_URL_PROD = 'https://toxicology-learning-rama.vercel.app/poisoncenter/th/elearning';

const meetAccount = JSON.parse(readFileSync('../secret/meetAccount.json', 'utf8'));
const MEET_KEYS = meetAccount.web ?? meetAccount.installed ?? {};

function appBaseUrl() {
	return process.env.FUNCTIONS_EMULATOR ? APP_BASE_URL_DEV : APP_BASE_URL_PROD;
}

function loadOAuthClient(refreshToken) {
	const oauth = new OAuth2Client(MEET_KEYS.client_id, MEET_KEYS.client_secret);
	oauth.setCredentials({ refresh_token: refreshToken });
	return oauth;
}

async function getAccessToken(uid) {
	const snap = await db.collection('meetOAuth').doc(uid).get();
	if (!snap.exists) {
		const err = new Error('connect_google_meet');
		err.status = 400;
		throw err;
	}
	const oauth = loadOAuthClient(snap.data().refreshToken);
	const { token } = await oauth.getAccessToken();
	return token;
}

function base64urlEncode(str) {
	return Buffer.from(str, 'utf8').toString('base64url');
}

function buildInviteEmail({ from, to, name, signupUrl }) {
	const subject = 'You have been invited to RAMA Toxico';
	const text = [
		`Hi ${name},`,
		'',
		'You have been invited to join RAMA Toxico as a teacher.',
		'',
		'Please sign up using the link below:',
		signupUrl,
		'',
		'Thank you.',
	].join('\n');
	return [
		`From: ${from}`,
		`To: ${to}`,
		`Subject: ${subject}`,
		'Content-Type: text/plain; charset=UTF-8',
		'MIME-Version: 1.0',
		'',
		text,
	].join('\r\n');
}

export const inviteTeacher = onRequest(async (req, res) => {
	try {
		if (handleCors(req, res)) return;
		const user = await verifyAdmin(req);

		const { email, name } = req.body ?? {};
		if (!email || !name) {
			res.status(400).json({ error: 'Missing data points' });
			return;
		}

		const emailLower = String(email).toLowerCase().trim();
		if (!emailLower) {
			res.status(400).json({ error: 'Missing data points' });
			return;
		}

const existingByLower = await db
      .collection('users')
      .where('emailLower', '==', emailLower)
      .limit(1)
      .get();
    const existingByEmail = await db
      .collection('users')
      .where('email', 'in', [emailLower, String(email)])
      .limit(1)
      .get();
    if (!existingByLower.empty || !existingByEmail.empty) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

		const docRef = db.collection('users').doc();
		await docRef.set({
			email: emailLower,
			emailLower,
			name,
			role: 'teacher',
			signedUp: false,
			invitedAt: admin.firestore.FieldValue.serverTimestamp(),
			createdAt: admin.firestore.FieldValue.serverTimestamp(),
		});

		try {
			const token = await getAccessToken(user.uid);
			const signupUrl = `${appBaseUrl()}/signup`;
			const raw = buildInviteEmail({
				from: user.email,
				to: emailLower,
				name,
				signupUrl,
			});

			const sendRes = await fetch(GMAIL_SEND_URL, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ raw: base64urlEncode(raw) }),
			});
			if (!sendRes.ok) {
				const bodyText = await sendRes.text();
				if (/insufficient|permission|scope/i.test(bodyText)) {
					await docRef.delete().catch(() => {});
					res.status(403).json({ error: 'connect_google_meet' });
					return;
				}
				throw new Error(`Gmail API error: ${bodyText}`);
			}
		} catch (err) {
			await docRef.delete().catch(() => {});
			throw err;
		}

		res.status(200).json({ success: true, id: docRef.id });
	} catch (err) {
		console.error('inviteTeacher error:', err);
		res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
	}
});
