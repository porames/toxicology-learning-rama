import { onRequest } from 'firebase-functions/v2/https';
import { readFileSync } from 'node:fs';
import { OAuth2Client } from 'google-auth-library';
import { admin, db } from '../lib/admin.js';
import { handleCors } from '../lib/cors.js';
import { verifyStaff } from '../lib/auth.js';

const SCOPES = [
	'https://www.googleapis.com/auth/meetings.space.created',
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/contacts.readonly',
	'https://www.googleapis.com/auth/directory.readonly',
	'https://www.googleapis.com/auth/gmail.send',
];

const meetAccount = JSON.parse(readFileSync('../secret/meetAccount.json', 'utf8'));
const MEET_KEYS = meetAccount.web ?? meetAccount.installed ?? {};

function functionsBaseUrl() {
	if (process.env.MEET_FUNCTIONS_BASE_URL) return process.env.MEET_FUNCTIONS_BASE_URL;
	if (process.env.FUNCTIONS_EMULATOR) {
		return 'http://localhost:5001/rama-toxico-edu/us-central1';
	}
	return 'https://us-central1-rama-toxico-edu.cloudfunctions.net';
}

function callbackUri() {
	return `${functionsBaseUrl()}/meetOAuthCallback`;
}

const APP_BASE_URL_DEV = 'http://localhost:5173/poisoncenter/th/elearning';
const APP_BASE_URL_PROD = 'https://toxicology-learning-rama.vercel.app/poisoncenter/th/elearning';

function appBaseUrl() {
	return process.env.FUNCTIONS_EMULATOR ? APP_BASE_URL_DEV : APP_BASE_URL_PROD;
}

function loadOAuthClient() {
	return new OAuth2Client(MEET_KEYS.client_id, MEET_KEYS.client_secret);
}

export const meetOAuthUrl = onRequest(async (req, res) => {
	try {
		if (handleCors(req, res)) return;
		await verifyStaff(req);

		const authHeader = req.headers.authorization;
		const state = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : '';
		if (!state) throw new Error('Missing id token');

		const client = loadOAuthClient();
		const url = client.generateAuthUrl({
			redirect_uri: callbackUri(),
			scope: SCOPES.join(' '),
			access_type: 'offline',
			prompt: 'consent',
			state,
		});

		res.status(200).json({ url });
	} catch (err) {
		console.error('meetOAuthUrl error:', err);
		res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
	}
});

export const meetOAuthCallback = onRequest(async (req, res) => {
	const base = appBaseUrl();
	const fail = () => res.redirect(302, `${base}/settings?meet=error`);

	try {
		const { code, state, error } = req.query;
		if (error || !code || !state) return fail();

		const decoded = await admin.auth().verifyIdToken(String(state));
		const client = loadOAuthClient();
		const { tokens } = await client.getToken({
			code: String(code),
			redirect_uri: callbackUri(),
		});
		if (!tokens.refresh_token) throw new Error('No refresh token returned');

		await db.collection('meetOAuth').doc(decoded.uid).set({
			refreshToken: tokens.refresh_token,
			updatedAt: admin.firestore.FieldValue.serverTimestamp(),
		});

		return res.redirect(302, `${base}/settings?meet=success`);
	} catch (err) {
		console.error('meetOAuthCallback error:', err);
		return fail();
	}
});

export const meetOAuthStatus = onRequest(async (req, res) => {
	try {
		if (handleCors(req, res)) return;
		const user = await verifyStaff(req);

		const snap = await db.collection('meetOAuth').doc(user.uid).get();
		res.status(200).json({ connected: snap.exists });
	} catch (err) {
		console.error('meetOAuthStatus error:', err);
		res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
	}
});
