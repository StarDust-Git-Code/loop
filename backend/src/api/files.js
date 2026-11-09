// File bytes live in Google Drive (in-process, src/drive); metadata lives in Firestore.
import { now } from '../lib/env.js';
import { driveReady, putBytes, getStream, removeFile } from '../drive/index.js';
import { userCol } from './db.js';

const base = () => driveReady();
export const artifactsReady = () => driveReady();
/** Files always work: Drive when connected, otherwise small files (<= 700 KB) are kept inline in the database. */
export const storageReady = () => true;
const INLINE_MAX = 700_000;

/** Upload bytes through the Artifacts service and record a file entity. */
export async function putFile(uid, { name, mime = 'application/octet-stream', buf, source = 'upload', runId }) {
  if (!base()) {
    if (buf.length > INLINE_MAX) throw Object.assign(new Error('Google Drive is not connected, and without it files are limited to 700 KB. Connect Drive in Connections to store larger files.'), { statusCode: 413 });
    const ref = userCol(uid, 'files').doc(); const ts = now();
    const doc = { name, size: buf.length, mime, source, ...(runId ? { runId } : {}), storage: 'inline', inline: buf.toString('base64'), createdAt: ts, updatedAt: ts };
    await ref.set(doc); const { inline, ...meta } = doc; return { id: ref.id, ...meta };
  }
  const { driveId, size } = await putBytes({ name, mime, run: runId, buf });
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
  return { file: f, body: await getStream(f.driveId) };
}

export async function deleteDriveFile(driveId) {
  if (!base() || !driveId) return;
  await removeFile(driveId).catch(() => {});
}
