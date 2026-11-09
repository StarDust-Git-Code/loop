// Pairing the dashboard with this server, and telling the dashboard where the server is.
// 1. The setup page shows a 6-digit code. The server writes pairings/{code} = { url } (readable by signed-in users, by id only).
// 2. The owner types the code in the dashboard; the dashboard reads the url and calls POST {url}/v1/pair with its Firebase token.
// 3. The server checks the code and the allow-list, remembers OWNER_UID, and writes servers/{uid} = { url, lastSeen, ... }.
//    Only the owner can read that doc (firestore.rules). The server refreshes it every 2 minutes and whenever the URL changes.
import { randomInt } from 'node:crypto';
import { env, now } from '../lib/env.js';
import { saveConfig } from '../lib/config.js';
import { commit } from '../lib/server.js';
import { db } from './db.js';

let cur = null; // { code, exp }
const bad = (m, statusCode = 400) => Object.assign(new Error(m), { statusCode });
export const publicUrl = () => (env('PUBLIC_URL') || `http://localhost:${env('PORT', '8787')}`).replace(/\/$/, '');
export const pairingState = () => ({ paired: !!env('OWNER_UID'), code: cur && cur.exp > Date.now() ? cur.code : null, expiresAt: cur?.exp ?? null, url: publicUrl() });

export async function newPairingCode() {
  if (cur) await db.collection('pairings').doc(cur.code).delete().catch(() => {});
  cur = { code: String(randomInt(0, 1_000_000)).padStart(6, '0'), exp: Date.now() + 10 * 60_000 };
  await db.collection('pairings').doc(cur.code).set({ url: publicUrl(), exp: cur.exp, createdAt: now() });
  return pairingState();
}

export async function pair(user, code) {
  if (!cur || cur.exp < Date.now() || String(code ?? '').trim() !== cur.code) throw bad('That code is wrong or expired. Make a new one on the server’s setup page.');
  if (env('OWNER_UID') && env('OWNER_UID') !== user.uid) throw bad('This server is already paired with another account. Unpair it on the setup page first.', 409);
  await saveConfig({ OWNER_UID: user.uid });
  await db.collection('pairings').doc(cur.code).delete().catch(() => {});
  cur = null;
  await publish();
  return { ok: true, url: publicUrl() };
}

export async function unpair() {
  const uid = env('OWNER_UID');
  if (uid) await db.collection('servers').doc(uid).delete().catch(() => {});
  await saveConfig({ OWNER_UID: '' });
}

/** Write servers/{owner} so the dashboard finds this server at sign-in. */
export async function publish() {
  const uid = env('OWNER_UID'); if (!uid) return;
  await db.collection('servers').doc(uid).set({ url: publicUrl(), lastSeen: now(), commit, platform: process.platform, version: 1 }, { merge: true });
  if (cur && cur.exp > Date.now()) await db.collection('pairings').doc(cur.code).set({ url: publicUrl() }, { merge: true }).catch(() => {});
}

let beat = null;
export function startPresence(log) {
  if (beat) return;
  const go = () => publish().catch((e) => log?.warn?.(`presence: ${e.message}`));
  go();
  beat = setInterval(go, 2 * 60_000); beat.unref();
}
