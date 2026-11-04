// Artifacts service: owner-only Google Drive storage. OAuth refresh token (full Drive scope), confined to ONE folder.
// DRIVE_ROOT_FOLDER_ID = the folder you made in Drive (open it, copy the id from the URL). Everything the agents list, read, write,
// copy, move or trash must be that folder or inside it; anything else is refused. Without it, a "Loopmates" folder is created.
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
  if (env('DRIVE_ROOT_FOLDER_ID')) return env('DRIVE_ROOT_FOLDER_ID');
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
  if (env('DRIVE_ROOT_FOLDER_ID')) await target(req.params.id);
  const res = await drive(`/drive/v3/files/${encodeURIComponent(req.params.id)}?alt=media`);
  if (!res.ok || !res.body) return reply.code(res.status === 404 ? 404 : 502).send({ error: `Drive: ${res.status}` });
  return reply.header('content-type', 'application/octet-stream').send(Readable.fromWeb(res.body));
});

app.delete('/v1/files/:id', { preHandler: svcOnly }, async (req) => {
  if (env('DRIVE_ROOT_FOLDER_ID')) await target(req.params.id);
  const res = await drive(`/drive/v3/files/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });
  return { ok: res.ok || res.status === 404 };
});

// ------------------------------------------------------------------ folder-confined file management for agents
const FIELDS = 'id,name,mimeType,size,modifiedTime,webViewLink,parents';
const err = (m, c = 400) => Object.assign(new Error(m), { statusCode: c });
const FOLDER = 'application/vnd.google-apps.folder';
const q = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function gj(path, init) {
  const res = await drive(path, init); const j = await res.json().catch(() => ({}));
  if (!res.ok) throw err(`Drive: ${j.error?.message || res.status}`, res.status === 404 ? 404 : 502);
  return j;
}
const meta = (id, fields = FIELDS) => gj(`/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`);
const okCache = new Map(); // ids already proven to be inside the root
async function inside(id) {
  const r = await folder(); let cur = id;
  for (let i = 0; i < 25; i++) {
    if (cur === r || okCache.get(cur) > Date.now()) { okCache.set(id, Date.now() + 600_000); return true; }
    const m = await meta(cur, 'parents').catch(() => null); const p = m?.parents?.[0];
    if (!p) return false; cur = p;
  }
  return false;
}
const target = async (id) => { // '' or 'root' means the root folder itself
  const r = await folder(); const x = !id || id === 'root' ? r : String(id);
  if (!(await inside(x))) throw err('That item is outside the folder the agents are allowed to use.', 403);
  return x;
};
const row = (f) => ({ id: f.id, name: f.name, type: f.mimeType === FOLDER ? 'folder' : f.mimeType, size: f.size ? Number(f.size) : undefined, modified: f.modifiedTime, link: f.webViewLink });
const TEXTY = /^(text\/|application\/(json|xml|javascript|x-yaml|yaml|csv|x-sh))/;

app.post('/v1/drive/list', { preHandler: svcOnly }, async (req) => {
  const parent = await target(req.body?.folder); const name = String(req.body?.query ?? '').trim();
  const query = `'${parent}' in parents and trashed=false${name ? ` and name contains '${q(name)}'` : ''}`;
  const j = await gj(`/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(`files(${FIELDS})`)}&pageSize=100&orderBy=folder,name&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return { folder: parent, items: (j.files ?? []).map(row) };
});

app.post('/v1/drive/read', { preHandler: svcOnly }, async (req) => {
  const id = await target(req.body?.id); const m = await meta(id); if (m.mimeType === FOLDER) throw err('That is a folder. Use list.');
  const exp = { 'application/vnd.google-apps.document': 'text/plain', 'application/vnd.google-apps.presentation': 'text/plain', 'application/vnd.google-apps.spreadsheet': 'text/csv' }[m.mimeType];
  if (!exp && !TEXTY.test(m.mimeType) && !/\.(md|txt|csv|json|js|ts|py|html|css|yml|yaml|xml|sh|log)$/i.test(m.name)) return { ...row(m), text: null, note: `Binary file (${m.mimeType}); it cannot be shown as text.` };
  const res = await drive(exp ? `/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exp)}` : `/drive/v3/files/${id}?alt=media&supportsAllDrives=true`);
  if (!res.ok) throw err(`Drive: ${res.status}`, 502);
  const buf = Buffer.from(await res.arrayBuffer()); const LIM = 200_000;
  return { ...row(m), text: buf.subarray(0, LIM).toString('utf8'), truncated: buf.length > LIM };
});

async function ensurePath(parent, path) { // "a/b/c" below parent, creating what is missing
  let cur = parent;
  for (const seg of String(path).split('/').map((x) => safe(x.trim())).filter(Boolean)) {
    const f = await gj(`/drive/v3/files?q=${encodeURIComponent(`'${cur}' in parents and name='${q(seg)}' and mimeType='${FOLDER}' and trashed=false`)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    cur = f.files?.[0]?.id ?? (await gj('/drive/v3/files?fields=id&supportsAllDrives=true', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: seg, mimeType: FOLDER, parents: [cur] }) })).id;
  }
  return cur;
}
app.post('/v1/drive/mkdir', { preHandler: svcOnly }, async (req) => {
  const parent = await target(req.body?.parent); if (!String(req.body?.name ?? '').trim()) throw err('name is required');
  const id = await ensurePath(parent, req.body.name); return { id, ok: true };
});

app.post('/v1/drive/write', { preHandler: svcOnly }, async (req) => {
  const b = req.body ?? {}; const content = Buffer.from(String(b.content ?? ''), 'utf8'); if (content.length > MAX) throw err('Too large');
  const mime = String(b.mime || 'text/plain').slice(0, 100); let id = b.id ? await target(b.id) : '';
  if (!id) {
    let parent = await target(b.parent); let name = String(b.name ?? '').split('/').map((x) => x.trim()).filter(Boolean);
    if (!name.length) throw err('name is required'); const leaf = safe(name.pop()); if (name.length) parent = await ensurePath(parent, name.join('/'));
    if (b.overwrite !== false) { const f = await gj(`/drive/v3/files?q=${encodeURIComponent(`'${parent}' in parents and name='${q(leaf)}' and mimeType!='${FOLDER}' and trashed=false`)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`); id = f.files?.[0]?.id ?? ''; }
    if (!id) {
      const bd = `lm${randomBytes(8).toString('hex')}`;
      const body = Buffer.concat([Buffer.from(`--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: leaf, parents: [parent] })}\r\n--${bd}\r\nContent-Type: ${mime}\r\n\r\n`), content, Buffer.from(`\r\n--${bd}--`)]);
      const j = await gj(`/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(FIELDS)}&supportsAllDrives=true`, { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${bd}` }, body });
      return { ...row(j), created: true };
    }
  }
  const j = await gj(`/upload/drive/v3/files/${id}?uploadType=media&fields=${encodeURIComponent(FIELDS)}&supportsAllDrives=true`, { method: 'PATCH', headers: { 'content-type': mime }, body: content });
  return { ...row(j), created: false };
});

app.post('/v1/drive/copy', { preHandler: svcOnly }, async (req) => {
  const id = await target(req.body?.id); const m = await meta(id, 'mimeType,name'); if (m.mimeType === FOLDER) throw err('Copying a folder is not supported. Copy its files one by one.');
  const body = { parents: [await target(req.body?.parent)], ...(req.body?.name ? { name: safe(req.body.name) } : {}) };
  return row(await gj(`/drive/v3/files/${id}/copy?fields=${encodeURIComponent(FIELDS)}&supportsAllDrives=true`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
});

app.post('/v1/drive/move', { preHandler: svcOnly }, async (req) => { // move and/or rename
  const id = await target(req.body?.id); if (id === (await folder())) throw err('The root folder itself cannot be changed.', 403);
  const m = await meta(id, 'parents'); const params = new URLSearchParams({ fields: FIELDS, supportsAllDrives: 'true' });
  if (req.body?.parent) { params.set('addParents', await target(req.body.parent)); params.set('removeParents', (m.parents ?? []).join(',')); }
  okCache.delete(id);
  return row(await gj(`/drive/v3/files/${id}?${params}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req.body?.name ? { name: safe(req.body.name) } : {}) }));
});

app.post('/v1/drive/trash', { preHandler: svcOnly }, async (req) => { // goes to Drive's Trash; recoverable for 30 days
  const id = await target(req.body?.id); if (id === (await folder())) throw err('The root folder itself cannot be deleted.', 403);
  await gj(`/drive/v3/files/${id}?fields=id&supportsAllDrives=true`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  return { ok: true };
});

await listen(app);
