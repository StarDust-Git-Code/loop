// Artifacts service: owner-only Google Drive storage. OAuth refresh token (drive.file scope), one "Loopmates" folder.
// Service accounts have no personal-Drive quota, so we act as YOU via a refresh token instead.
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { env, need } from '../lib/env.js';
import { createServer, svcOnly, listen } from '../lib/server.js';

for (const k of ['SERVICE_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']) need(k);
const MAX = 15 * 1024 * 1024;
const app = await createServer('artifacts', { bodyLimit: MAX + 1024 });
app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: MAX }, (req, body, done) => done(null, body));

let tok = { v: '', exp: 0 };
async function token() {
  if (tok.exp > Date.now() + 60_000) return tok.v;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(20_000),
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), refresh_token: env('GOOGLE_REFRESH_TOKEN'), grant_type: 'refresh_token' }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw Object.assign(new Error(`Google OAuth refused the refresh token: ${j.error_description || j.error || res.status}. Re-run scripts/drive-token.mjs.`), { statusCode: 502 });
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return tok.v;
}
const drive = async (path, init = {}) => fetch(`https://www.googleapis.com${path}`, { ...init, headers: { authorization: `Bearer ${await token()}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(110_000) });

let folderId = '';
async function folder() {
  if (folderId) return folderId;
  const q = encodeURIComponent("name='Loopmates' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const found = await (await drive(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`)).json();
  if (found.files?.[0]?.id) return (folderId = found.files[0].id);
  const made = await (await drive('/drive/v3/files?fields=id', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Loopmates', mimeType: 'application/vnd.google-apps.folder' }) })).json();
  if (!made.id) throw Object.assign(new Error('Could not create the Loopmates folder in Drive'), { statusCode: 502 });
  return (folderId = made.id);
}

const safe = (s) => String(s || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);

app.get('/v1/health', { preHandler: svcOnly }, async () => ({ ok: true, folder: await folder() }));

app.put('/v1/files', { preHandler: svcOnly }, async (req, reply) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf)) return reply.code(400).send({ error: 'send the file as application/octet-stream' });
  const name = safe(req.query.name); const mime = String(req.query.mime || 'application/octet-stream').slice(0, 100);
  const meta = { name: req.query.run ? `${safe(req.query.run)}__${name}` : name, parents: [await folder()] };
  const b = `lm${randomBytes(8).toString('hex')}`;
  const body = Buffer.concat([Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`), buf, Buffer.from(`\r\n--${b}--`)]);
  const res = await drive('/upload/drive/v3/files?uploadType=multipart&fields=id,size,webViewLink', { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${b}` }, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return reply.code(502).send({ error: `Drive: ${j.error?.message || res.status}` });
  return { driveId: j.id, size: Number(j.size ?? buf.length), webViewLink: j.webViewLink };
});

app.get('/v1/files/:id', { preHandler: svcOnly }, async (req, reply) => {
  const res = await drive(`/drive/v3/files/${encodeURIComponent(req.params.id)}?alt=media`);
  if (!res.ok || !res.body) return reply.code(res.status === 404 ? 404 : 502).send({ error: `Drive: ${res.status}` });
  return reply.header('content-type', 'application/octet-stream').send(Readable.fromWeb(res.body));
});

app.delete('/v1/files/:id', { preHandler: svcOnly }, async (req) => {
  const res = await drive(`/drive/v3/files/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });
  return { ok: res.ok || res.status === 404 };
});

await listen(app);
