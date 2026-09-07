import { onRequest } from 'firebase-functions/v2/https';
import { readFileSync } from 'node:fs';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../lib/admin.js';
import { handleCors } from '../lib/cors.js';
import { verifyAdmin } from '../lib/auth.js';

const DIRECTORY_URL = 'https://people.googleapis.com/v1/people:searchDirectoryPeople';
const READ_MASK = 'names,emailAddresses,organizations,photos';
const SOURCES = ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE', 'DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT'];
const PAGE_SIZE = 1000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const meetAccount = JSON.parse(readFileSync('../secret/meetAccount.json', 'utf8'));
const MEET_KEYS = meetAccount.web ?? meetAccount.installed ?? {};

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

function firstEmail(person) {
  const email = person.emailAddresses?.find((e) => e.value) ?? null;
  return email?.value ?? null;
}

function primaryName(person) {
  const name = person.names?.find((n) => n.metadata?.primary || n.displayName) ?? null;
  return name?.displayName ?? null;
}

function firstOrganization(person) {
  const org = person.organizations?.find((o) => o.name) ?? null;
  return org?.name ?? null;
}

export const getPeopleDirectory = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    const user = await verifyAdmin(req);

    const { query } = req.body ?? {};
    if (!query || !String(query).trim()) {
      res.status(400).json({ error: 'missing_query' });
      return;
    }

    const token = await getAccessToken(user.uid);

    const cap = Math.min(DEFAULT_LIMIT, MAX_LIMIT);
    const contacts = [];
    let pageToken = null;
    for (let page = 0; page < 50; page++) {
      const params = new URLSearchParams({
        query: String(query).trim(),
        readMask: READ_MASK,
        pageSize: String(Math.min(cap, PAGE_SIZE)),
      });
      for (const source of SOURCES) params.append('sources', source);
      if (pageToken) params.set('pageToken', pageToken);

      const peopleRes = await fetch(`${DIRECTORY_URL}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!peopleRes.ok) {
        const bodyText = await peopleRes.text();
        let body = null;
        try {
          body = JSON.parse(bodyText);
        } catch {
          body = null;
        }
        if (peopleRes.status === 403 || peopleRes.status === 400) {
          if (/insufficient|permission|scope/i.test(body?.error?.message ?? '')) {
            res.status(403).json({ error: 'connect_google_meet' });
            return;
          }
        }
        throw new Error(`People API error: ${body?.error?.message ?? bodyText}`);
      }
      const data = await peopleRes.json();
      for (const person of data.people ?? []) {
        contacts.push({
          resourceName: person.resourceName ?? '',
          name: primaryName(person),
          email: firstEmail(person),
          department: firstOrganization(person),
          photoUrl: person.photos?.find((p) => p.url)?.url ?? null,
        });
      }
      pageToken = data.nextPageToken ?? null;
      if (!pageToken || contacts.length >= cap) break;
    }

    const sorted = contacts
      .slice(0, cap)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    res.status(200).json({ contacts: sorted });
  } catch (err) {
    console.error('getPeopleDirectory error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});