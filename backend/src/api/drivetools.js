// Google Drive tools for Mates. They work only inside the one folder the owner chose (DRIVE_ROOT_FOLDER_ID on the artifacts service).
import { env } from '../lib/env.js';
import { svcFetch } from '../lib/svc.js';

const bad = (m) => Object.assign(new Error(m), { tool: true });
async function drive(path, body) {
  const base = env('ARTIFACTS_URL'); if (!base) throw bad('Google Drive is not connected yet (ARTIFACTS_URL is missing on the API service).');
  let res; try { res = await svcFetch(base, path, { method: 'POST', body, timeoutMs: 60_000 }); } catch (e) { throw bad(`The Drive service is unreachable (${String(e.message).slice(0, 80)}).`); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw bad(j.error || j.message || `Drive service answered ${res.status}`);
  return j;
}
const line = (f) => `${f.type === 'folder' ? '[folder]' : '[file]  '} ${f.name}  (id ${f.id}${f.size != null ? `, ${f.size} bytes` : ''}${f.modified ? `, ${f.modified.slice(0, 10)}` : ''})`;
const D = (desc, args, run, more = {}) => ({ group: 'File System', net: true, desc, args, run, ...more });

export const DRIVE_TOOLS = {
  drive_list: D('List the files and folders inside a Drive folder (default: the top folder). Optionally filter by name.', '{"folder?": "folder id (omit for the top folder)", "query?": "part of a name"}', async (_c, a) => {
    const r = await drive('/v1/drive/list', { folder: a.folder, query: a.query });
    return r.items.length ? r.items.map(line).join('\n') : 'That folder is empty.';
  }),
  drive_read: D('Read a text file from Drive (also Google Docs, Sheets as CSV, Slides). Pass the id from drive_list.', '{"id": "file id"}', async (_c, a) => {
    const r = await drive('/v1/drive/read', { id: a.id });
    return r.text == null ? `${r.name}: ${r.note}` : `${r.name}${r.truncated ? ' (first 200 KB)' : ''}\n---\n${r.text}`;
  }),
  drive_write: D('Create a text file in Drive, or overwrite one with the same name. The name may include subfolders ("notes/2026/idea.md"); missing folders are created.', '{"name": "folder/file.md", "content": "text", "folder?": "parent folder id", "id?": "edit this file id instead"}', async (_c, a) => {
    const r = await drive('/v1/drive/write', { name: a.name, content: String(a.content ?? ''), parent: a.folder, id: a.id });
    return `${r.created ? 'Created' : 'Updated'} ${r.name} (id ${r.id}).`;
  }, { write: true }),
  drive_mkdir: D('Create a folder in Drive. A path like "projects/2026/q4" creates every missing level.', '{"name": "folder or a/b/c path", "parent?": "parent folder id"}', async (_c, a) => `Folder ready (id ${(await drive('/v1/drive/mkdir', { name: a.name, parent: a.parent })).id}).`, { write: true }),
  drive_copy: D('Copy a file inside the Drive folder (optionally with a new name and/or into another folder).', '{"id": "file id", "name?": "new name", "parent?": "destination folder id"}', async (_c, a) => `Copied to ${(await drive('/v1/drive/copy', { id: a.id, name: a.name, parent: a.parent })).name}.`, { write: true }),
  drive_move: D('Rename and/or move a file or folder inside the Drive folder.', '{"id": "item id", "name?": "new name", "parent?": "destination folder id"}', async (_c, a) => `Now "${(await drive('/v1/drive/move', { id: a.id, name: a.name, parent: a.parent })).name}".`, { write: true }),
  drive_trash: D('Move a file or folder to the Drive trash (recoverable for 30 days; nothing is erased for good).', '{"id": "item id"}', async (_c, a) => { await drive('/v1/drive/trash', { id: a.id }); return 'Moved to the Drive trash.'; }, { write: true }),
};
