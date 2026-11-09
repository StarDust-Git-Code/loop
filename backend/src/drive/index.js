// Google Drive, in-process. Acts as the owner through an OAuth refresh token (full Drive scope) and is confined to ONE
// folder (DRIVE_ROOT_FOLDER_ID). Everything the agents list, read, write, copy, move or trash must be that folder or
// inside it; anything else is refused. Without a folder id a "Loopmates" folder is created and used.
// The owner connects Drive from the dashboard: their own OAuth client id/secret, a sign-in, then a folder pick.
// DRIVE_FAKE=1 (tests only) keeps files in memory.
import { randomBytes } from 'node:crypto';
import { env } from '../lib/env.js';

const MAX = 15 * 1024 * 1024;
const FAKE = env('DRIVE_FAKE') === '1' && env('NODE_ENV') !== 'production';
const err = (m, c = 400) => Object.assign(new Error(m), { statusCode: c });
export const driveReady = () => FAKE || !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET') && env('GOOGLE_REFRESH_TOKEN'));

/* ---------- OAuth ---------- */
// One Google sign-in covers Drive plus the optional Calendar and Gmail tools. GOOGLE_SCOPES picks which
// (default "drive,calendar,gmail"); GOOGLE_GRANTED_SCOPES records what the last sign-in actually granted.
const SCOPES = {
  drive: ['https://www.googleapis.com/auth/drive'],
  calendar: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy'],
  gmail: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose'],
};
const wanted = () => ['drive', ...env('GOOGLE_SCOPES', 'drive,calendar,gmail').split(',').map((s) => s.trim().toLowerCase())].filter((k, i, a) => SCOPES[k] && a.indexOf(k) === i);
export const SCOPE = wanted().flatMap((k) => SCOPES[k]).join(' ');
/** Did the owner's Google sign-in grant this part (calendar, gmail)? Older sign-ins did not record it: assume no for extras. */
export const googleGranted = (part) => {
  if (!driveReady() || FAKE) return false;
  const g = env('GOOGLE_GRANTED_SCOPES');
  return !!g && (SCOPES[part] ?? []).every((s) => g.split(/\s+/).includes(s));
};
let tok = { v: '', exp: 0, rt: '' };
async function token() {
  if (tok.exp > Date.now() + 60_000 && tok.rt === env('GOOGLE_REFRESH_TOKEN')) return tok.v;
  if (!driveReady()) throw err('Google Drive is not connected. Connect it in Connections → Google Drive.', 501);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(20_000),
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), refresh_token: env('GOOGLE_REFRESH_TOKEN'), grant_type: 'refresh_token' }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw err(`Google refused the Drive sign-in: ${j.error_description || j.error || res.status}. Connect Drive again (sign-ins expire after 7 days while the consent screen is in Testing).`, 502);
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000, rt: env('GOOGLE_REFRESH_TOKEN') };
  return tok.v;
}
/** Sign-in URL for the owner's own OAuth client. */
export function authUrl(redirectUri, state) {
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: redirectUri, response_type: 'code', scope: wanted().flatMap((k) => SCOPES[k]).join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state })}`;
}
/** An access token for the owner's Google account (Drive, Calendar, Gmail share one sign-in). */
export const googleToken = () => token();
let lastGranted = '';
/** Scopes granted by the latest exchangeCode(), to save next to the refresh token. */
export const grantedScopes = () => lastGranted;
/** Exchange the callback code for a refresh token. */
export async function exchangeCode(code, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(20_000), body: new URLSearchParams({ code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.refresh_token) throw err(`Google did not return a refresh token: ${j.error_description || j.error || res.status}`, 502);
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000, rt: j.refresh_token };
  lastGranted = String(j.scope ?? '');
  return j.refresh_token;
}

const drive = async (path, init = {}) => fetch(`https://www.googleapis.com${path}`, { ...init, headers: { authorization: `Bearer ${await token()}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(110_000) });
async function gj(path, init) {
  const res = await drive(path, init); const j = await res.json().catch(() => ({}));
  if (!res.ok) throw err(`Drive: ${j.error?.message || res.status}`, res.status === 404 ? 404 : 502);
  return j;
}

let folderId = '';
async function folder() {
  if (env('DRIVE_ROOT_FOLDER_ID')) return env('DRIVE_ROOT_FOLDER_ID');
  if (folderId) return folderId;
  const qq = encodeURIComponent("name='Loopmates' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const found = await gj(`/drive/v3/files?q=${qq}&fields=files(id)&pageSize=1`);
  if (found.files?.[0]?.id) return (folderId = found.files[0].id);
  const made = await gj('/drive/v3/files?fields=id', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Loopmates', mimeType: 'application/vnd.google-apps.folder' }) });
  return (folderId = made.id);
}

const safe = (s) => String(s || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);
const FIELDS = 'id,name,mimeType,size,modifiedTime,webViewLink,parents';
const FOLDER = 'application/vnd.google-apps.folder';
const q = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
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
const multipart = (metaObj, mime, buf) => { const b = `lm${randomBytes(8).toString('hex')}`; return { b, body: Buffer.concat([Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metaObj)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`), buf, Buffer.from(`\r\n--${b}--`)]) }; };

/* ---------- in-memory Drive for tests ---------- */
const mem = new Map();
const fake = {
  health: async () => ({ ok: true, folder: 'fake' }),
  put: async ({ buf }) => { const id = `d${mem.size + 1}`; mem.set(id, buf); return { driveId: id, size: buf.length }; },
  get: async (id) => { const b = mem.get(id); if (!b) throw err('Not found', 404); return new Response(b).body; },
  remove: async (id) => { mem.delete(id); },
};

/* ---------- file storage (uploads and run deliverables) ---------- */
export async function health() { return FAKE ? fake.health() : { ok: true, folder: await folder() }; }

export async function putBytes({ name, mime = 'application/octet-stream', run, buf }) {
  if (buf.length > MAX) throw err('File is larger than 15 MB', 413);
  if (FAKE) return fake.put({ buf });
  const { b, body } = multipart({ name: run ? `${safe(run)}__${safe(name)}` : safe(name), parents: [await folder()] }, String(mime).slice(0, 100), buf);
  const j = await gj('/upload/drive/v3/files?uploadType=multipart&fields=id,size,webViewLink', { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${b}` }, body });
  return { driveId: j.id, size: Number(j.size ?? buf.length), webViewLink: j.webViewLink };
}

/** A web ReadableStream of the file's bytes. */
export async function getStream(id) {
  if (FAKE) return fake.get(id);
  if (env('DRIVE_ROOT_FOLDER_ID')) await target(id);
  const res = await drive(`/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
  if (!res.ok || !res.body) throw err(`Drive: ${res.status}`, res.status === 404 ? 404 : 502);
  return res.body;
}

export async function removeFile(id) {
  if (FAKE) return fake.remove(id);
  if (env('DRIVE_ROOT_FOLDER_ID')) await target(id);
  await drive(`/drive/v3/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/* ---------- folder-confined file management for agents ---------- */
async function ensurePath(parent, path) { // "a/b/c" below parent, creating what is missing
  let cur = parent;
  for (const seg of String(path).split('/').map((x) => safe(x.trim())).filter(Boolean)) {
    const f = await gj(`/drive/v3/files?q=${encodeURIComponent(`'${cur}' in parents and name='${q(seg)}' and mimeType='${FOLDER}' and trashed=false`)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    cur = f.files?.[0]?.id ?? (await gj('/drive/v3/files?fields=id&supportsAllDrives=true', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: seg, mimeType: FOLDER, parents: [cur] }) })).id;
  }
  return cur;
}

export const ops = {
  async list({ folder: f, query } = {}) {
    const parent = await target(f); const name = String(query ?? '').trim();
    const query2 = `'${parent}' in parents and trashed=false${name ? ` and name contains '${q(name)}'` : ''}`;
    const j = await gj(`/drive/v3/files?q=${encodeURIComponent(query2)}&fields=${encodeURIComponent(`files(${FIELDS})`)}&pageSize=100&orderBy=folder,name&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    return { folder: parent, items: (j.files ?? []).map(row) };
  },
  /** Folders anywhere in My Drive (not confined): used only by the owner's folder picker. */
  async folders({ parent } = {}) {
    const p = parent || 'root';
    const j = await gj(`/drive/v3/files?q=${encodeURIComponent(`'${q(p)}' in parents and mimeType='${FOLDER}' and trashed=false`)}&fields=files(id,name)&pageSize=200&orderBy=name`);
    return { parent: p, items: (j.files ?? []).map((x) => ({ id: x.id, name: x.name })) };
  },
  async read({ id: raw }) {
    const id = await target(raw); const m = await meta(id); if (m.mimeType === FOLDER) throw err('That is a folder. Use list.');
    const exp = { 'application/vnd.google-apps.document': 'text/plain', 'application/vnd.google-apps.presentation': 'text/plain', 'application/vnd.google-apps.spreadsheet': 'text/csv' }[m.mimeType];
    if (!exp && !TEXTY.test(m.mimeType) && !/\.(md|txt|csv|json|js|ts|py|html|css|yml|yaml|xml|sh|log)$/i.test(m.name)) return { ...row(m), text: null, note: `Binary file (${m.mimeType}); it cannot be shown as text.` };
    const res = await drive(exp ? `/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exp)}` : `/drive/v3/files/${id}?alt=media&supportsAllDrives=true`);
    if (!res.ok) throw err(`Drive: ${res.status}`, 502);
    const buf = Buffer.from(await res.arrayBuffer()); const LIM = 200_000;
    return { ...row(m), text: buf.subarray(0, LIM).toString('utf8'), truncated: buf.length > LIM };
  },
  async mkdir({ parent, name }) {
    const p = await target(parent); if (!String(name ?? '').trim()) throw err('name is required');
    return { id: await ensurePath(p, name), ok: true };
  },
  async write(b = {}) {
    const content = Buffer.from(String(b.content ?? ''), 'utf8'); if (content.length > MAX) throw err('Too large');
    const mime = String(b.mime || 'text/plain').slice(0, 100); let id = b.id ? await target(b.id) : '';
    if (!id) {
      let parent = await target(b.parent); const name = String(b.name ?? '').split('/').map((x) => x.trim()).filter(Boolean);
      if (!name.length) throw err('name is required'); const leaf = safe(name.pop()); if (name.length) parent = await ensurePath(parent, name.join('/'));
      if (b.overwrite !== false) { const f = await gj(`/drive/v3/files?q=${encodeURIComponent(`'${parent}' in parents and name='${q(leaf)}' and mimeType!='${FOLDER}' and trashed=false`)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`); id = f.files?.[0]?.id ?? ''; }
      if (!id) {
        const { b: bd, body } = multipart({ name: leaf, parents: [parent] }, mime, content);
        return { ...row(await gj(`/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(FIELDS)}&supportsAllDrives=true`, { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${bd}` }, body })), created: true };
      }
    }
    return { ...row(await gj(`/upload/drive/v3/files/${id}?uploadType=media&fields=${encodeURIComponent(FIELDS)}&supportsAllDrives=true`, { method: 'PATCH', headers: { 'content-type': mime }, body: content })), created: false };
  },
  async copy({ id: raw, parent, name }) {
    const id = await target(raw); const m = await meta(id, 'mimeType,name'); if (m.mimeType === FOLDER) throw err('Copying a folder is not supported. Copy its files one by one.');
    const body = { parents: [await target(parent)], ...(name ? { name: safe(name) } : {}) };
    return row(await gj(`/drive/v3/files/${id}/copy?fields=${encodeURIComponent(FIELDS)}&supportsAllDrives=true`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  },
  async move({ id: raw, parent, name }) { // move and/or rename
    const id = await target(raw); if (id === (await folder())) throw err('The root folder itself cannot be changed.', 403);
    const m = await meta(id, 'parents'); const params = new URLSearchParams({ fields: FIELDS, supportsAllDrives: 'true' });
    if (parent) { params.set('addParents', await target(parent)); params.set('removeParents', (m.parents ?? []).join(',')); }
    okCache.delete(id);
    return row(await gj(`/drive/v3/files/${id}?${params}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(name ? { name: safe(name) } : {}) }));
  },
  async trash({ id: raw }) { // goes to Drive's Trash; recoverable for 30 days
    const id = await target(raw); if (id === (await folder())) throw err('The root folder itself cannot be deleted.', 403);
    await gj(`/drive/v3/files/${id}?fields=id&supportsAllDrives=true`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
    return { ok: true };
  },
};
/** The folder id changed (picker): forget what we proved about the old one. */
export function resetFolder() { folderId = ''; okCache.clear(); }
