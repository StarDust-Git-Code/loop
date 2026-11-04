// File bytes live in Google Drive via the Artifacts service; metadata lives in Firestore.
import { env, now } from '../lib/env.js';
import { svcFetch, svcJson } from '../lib/svc.js';
import { userCol } from './db.js';

const base = () => env('ARTIFACTS_URL');
export const artifactsReady = () => !!base();
/** Files always work: Drive when connected, otherwise small files (<= 700 KB) are kept inline in the database. */
export const storageReady = () => true;
const INLINE_MAX = 700_000;
const nope = () => Object.assign(new Error('Artifacts service is not configured (ARTIFACTS_URL).'), { statusCode: 501 });

/** Upload bytes through the Artifacts service and record a file entity. */
export async function putFile(uid, { name, mime = 'application/octet-stream', buf, source = 'upload', runId }) {
  if (!base()) {
    if (buf.length > INLINE_MAX) throw Object.assign(new Error('Google Drive is not connected, and without it files are limited to 700 KB. Connect Drive in Connections to store larger files.'), { statusCode: 413 });
    const ref = userCol(uid, 'files').doc(); const ts = now();
    const doc = { name, size: buf.length, mime, source, ...(runId ? { runId } : {}), storage: 'inline', inline: buf.toString('base64'), createdAt: ts, updatedAt: ts };
    await ref.set(doc); const { inline, ...meta } = doc; return { id: ref.id, ...meta };
  }
  const q = `?name=${encodeURIComponent(name)}&mime=${encodeURIComponent(mime)}${runId ? `&run=${encodeURIComponent(runId)}` : ''}`;
  const res = await svcFetch(base(), `/v1/files${q}`, { method: 'PUT', raw: buf, headers: { 'content-type': 'application/octet-stream' }, timeoutMs: 120_000 });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(`Artifacts service: ${res.status} ${text.slice(0, 200)}`), { statusCode: 502 });
  const { driveId, size } = JSON.parse(text);
  const ref = userCol(uid, 'files').doc();
  const ts = now();
  const doc = { name, size: size ?? buf.length, mime, source, ...(runId ? { runId } : {}), driveId, createdAt: ts, updatedAt: ts };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function getFileStream(uid, id) {
  const d = await userCol(uid, 'files').doc(id).get();
  if (!d.exists) throw Object.assign(new Error('Not found'), { statusCode: 404 });
  const f = d.data();
  if (f.inline) { const { inline, ...meta } = f; return { file: meta, body: new Response(Buffer.from(inline, 'base64')).body }; }
  if (!base() || !f.driveId) throw Object.assign(new Error('Not found'), { statusCode: 404 });
  const res = await svcFetch(base(), `/v1/files/${encodeURIComponent(f.driveId)}`, { timeoutMs: 120_000 });
  if (!res.ok || !res.body) throw Object.assign(new Error(`Artifacts service: ${res.status}`), { statusCode: 502 });
  return { file: f, body: res.body };
}

export async function deleteDriveFile(driveId) {
  if (!base() || !driveId) return;
  await svcJson(base(), `/v1/files/${encodeURIComponent(driveId)}`, { method: 'DELETE' }).catch(() => {});
}
