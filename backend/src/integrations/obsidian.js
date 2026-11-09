// Obsidian: the owner's vault is a folder on the same computer as the server, so the agents read and write the
// Markdown files directly. Every path is resolved and checked to stay inside OBSIDIAN_VAULT (symlinks included);
// dot-folders (.obsidian, .trash, .git) are never listed or touched. Only .md files are written.
import { readdir, readFile, writeFile, mkdir, stat, realpath, appendFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, relative, sep, dirname, basename, extname } from 'node:path';
import { env } from '../lib/env.js';
import { bad, str, clip, data } from './util.js';

const MAX_FILES = 8000, MAX_READ = 200_000;
export const vault = () => env('OBSIDIAN_VAULT');
export const obsidianReady = () => { const v = vault(); return !!v && existsSync(v); };

/** Resolve a vault-relative path and refuse anything outside the vault. */
export async function inVault(p, { mustExist = true } = {}) {
  const root = await realpath(vault()).catch(() => { throw bad('The Obsidian vault folder was not found on the server. Check Connections → Obsidian.'); });
  let rel = String(p ?? '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!rel) throw bad('A note path is required, like "Projects/Loopmates.md"');
  if (!extname(rel)) rel += '.md';
  if (rel.split('/').some((part) => part === '..' || part.startsWith('.'))) throw bad('That path leaves the vault or uses a hidden folder');
  const full = resolve(root, rel);
  if (full !== root && !full.startsWith(root + sep)) throw bad('That path is outside the vault');
  if (mustExist) {
    const real = await realpath(full).catch(() => { throw bad(`No note at "${rel}"`); });
    if (!real.startsWith(root + sep)) throw bad('That note links outside the vault');
  } else {
    // A new file: its nearest existing parent must still be inside the vault.
    let d = dirname(full); while (!existsSync(d) && d.startsWith(root)) d = dirname(d);
    const realParent = await realpath(d).catch(() => root);
    if (realParent !== root && !realParent.startsWith(root + sep)) throw bad('That folder links outside the vault');
  }
  return { root, full, rel: relative(root, full).split(sep).join('/') };
}

let cache = { at: 0, root: '', files: [] };
/** Every Markdown note in the vault (relative paths), cached for a minute. */
export async function notes() {
  const root = await realpath(vault());
  if (cache.root === root && Date.now() - cache.at < 60_000) return cache.files;
  const out = [];
  const walk = async (dir) => {
    if (out.length >= MAX_FILES) return;
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push(relative(root, p).split(sep).join('/'));
      if (out.length >= MAX_FILES) return;
    }
  };
  await walk(root);
  cache = { at: Date.now(), root, files: out };
  return out;
}
const invalidate = () => { cache.at = 0; };

/** [[Wiki links]] in a note: target names without aliases or headings. */
export const linksIn = (text) => [...new Set([...String(text).matchAll(/\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim()).filter(Boolean))];
const noteName = (rel) => basename(rel, '.md');

function dailyFolder(root) {
  if (env('OBSIDIAN_DAILY_FOLDER')) return env('OBSIDIAN_DAILY_FOLDER').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  try { return String(JSON.parse(readFileSync(join(root, '.obsidian', 'daily-notes.json'), 'utf8')).folder ?? '').replace(/^\/+|\/+$/g, ''); } catch { return ''; }
}
const today = (tz) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); } };

const terms = (q) => (String(q).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).slice(0, 12);

export const OBSIDIAN_TOOLS = {
  obsidian_search: { group: 'Notes', ready: obsidianReady, desc: 'Search the owner\'s Obsidian vault (note names and text). Returns the best notes with a snippet each.', args: '{"query": "words to find", "limit?": 8}', run: async (_c, a) => {
    const t = terms(a.query); if (!t.length) throw bad('query is required');
    const files = await notes(); const root = await realpath(vault()); const hits = [];
    for (const rel of files) {
      const name = rel.toLowerCase(); let text = '';
      try { text = (await readFile(join(root, rel), 'utf8')).slice(0, 60_000); } catch { continue; }
      const low = text.toLowerCase();
      const score = t.reduce((s, w) => s + (name.includes(w) ? 3 : 0) + (low.includes(w) ? 1 : 0), 0);
      if (!score) continue;
      const i = Math.max(0, low.indexOf(t.find((w) => low.includes(w)) ?? t[0]) - 80);
      hits.push({ rel, score, snip: text.slice(i, i + 240).replace(/\s+/g, ' ') });
    }
    hits.sort((x, y) => y.score - x.score);
    const n = Math.min(Number(a.limit) || 8, 20);
    return hits.length ? data('Obsidian notes', hits.slice(0, n).map((h) => `- ${h.rel}: …${h.snip}…`).join('\n')) : `No notes match "${a.query}" (searched ${files.length} notes).`;
  } },
  obsidian_read: { group: 'Notes', ready: obsidianReady, desc: 'Read one Obsidian note by its path in the vault (from obsidian_search), with its [[links]] and backlinks.', args: '{"path": "Folder/Note.md", "offset?": 0}', run: async (_c, a) => {
    const { full, rel } = await inVault(a.path);
    const text = await readFile(full, 'utf8'); const off = Math.max(0, Number(a.offset) || 0);
    const name = noteName(rel); const root = await realpath(vault()); const back = [];
    for (const f of await notes()) { if (back.length >= 15 || f === rel) continue; try { if (linksIn(await readFile(join(root, f), 'utf8')).some((l) => l.toLowerCase() === name.toLowerCase() || l.toLowerCase() === rel.replace(/\.md$/, '').toLowerCase())) back.push(f); } catch { /* skip */ } }
    const links = linksIn(text);
    return data(`Obsidian note ${rel} (${text.length} chars)`, `${text.slice(off, off + 6000)}${text.length > off + 6000 ? `\n…[more: offset ${off + 6000}]` : ''}\n\nLinks: ${links.slice(0, 30).join(', ') || 'none'}\nBacklinks: ${back.join(', ') || 'none'}`);
  } },
  obsidian_write: { group: 'Notes', ready: obsidianReady, write: true, desc: 'Create a note in the Obsidian vault, or append to one. Use [[Note name]] to link notes. mode "create" fails if the note exists; "append" adds to the end (creating it if needed); "replace" overwrites (only when the owner asked).', args: '{"path": "Folder/Note.md", "content": "Markdown", "mode?": "create|append|replace"}', run: async (_c, a) => {
    const mode = ['create', 'append', 'replace'].includes(a.mode) ? a.mode : 'create';
    const { full, rel } = await inVault(a.path, { mustExist: false });
    if (!rel.toLowerCase().endsWith('.md')) throw bad('Only Markdown (.md) notes can be written');
    const content = str(a.content, MAX_READ); if (!content.trim()) throw bad('content is required');
    const exists = existsSync(full);
    if (mode === 'create' && exists) throw bad(`"${rel}" already exists. Use mode "append", or pick another name.`);
    await mkdir(dirname(full), { recursive: true });
    if (mode === 'append' && exists) await appendFile(full, `${content.startsWith('\n') ? '' : '\n\n'}${content}\n`, 'utf8');
    else await writeFile(full, `${content}\n`, 'utf8');
    invalidate();
    return `${mode === 'append' && exists ? 'Appended to' : exists ? 'Replaced' : 'Created'} ${rel} in the vault.`;
  } },
  obsidian_daily: { group: 'Notes', ready: obsidianReady, write: true, desc: 'Append a line or section to today\'s daily note in Obsidian (journal entries, a log of what happened, a captured idea). Creates the note if needed.', args: '{"text": "Markdown to add", "heading?": "optional heading for the entry"}', run: async (c, a) => {
    const root = await realpath(vault()); const day = today(c.settings?.timezone);
    const folder = dailyFolder(root); const { full, rel } = await inVault(`${folder ? `${folder}/` : ''}${day}.md`, { mustExist: false });
    const text = str(a.text, 20_000).trim(); if (!text) throw bad('text is required');
    const time = new Date().toISOString().slice(11, 16);
    await mkdir(dirname(full), { recursive: true });
    const block = `${a.heading ? `## ${str(a.heading, 120)}\n` : ''}${text}\n<!-- added by Loopmates ${time} UTC -->`;
    if (existsSync(full)) await appendFile(full, `\n\n${block}\n`, 'utf8'); else await writeFile(full, `# ${day}\n\n${block}\n`, 'utf8');
    invalidate();
    return `Added to today's daily note (${rel}).`;
  } },
  obsidian_recent: { group: 'Notes', ready: obsidianReady, desc: 'The most recently changed notes in the Obsidian vault.', args: '{"limit?": 10}', run: async () => {
    const root = await realpath(vault()); const rows = [];
    for (const rel of await notes()) { try { rows.push({ rel, t: (await stat(join(root, rel))).mtimeMs }); } catch { /* skip */ } }
    rows.sort((x, y) => y.t - x.t);
    return rows.slice(0, 10).map((r) => `- ${new Date(r.t).toISOString().slice(0, 16).replace('T', ' ')} ${r.rel}`).join('\n') || 'The vault has no notes yet.';
  } },
};

/** Note → [[link]] pairs for the knowledge graph (POST /v1/integrations/obsidian/sync). */
export async function vaultLinks(limit = 3000) {
  const root = await realpath(vault()); const out = [];
  for (const rel of await notes()) {
    let text = ''; try { text = await readFile(join(root, rel), 'utf8'); } catch { continue; }
    for (const to of linksIn(text)) { out.push({ from: noteName(rel), to: basename(to) }); if (out.length >= limit) return out; }
  }
  return out;
}

export const obsidian = {
  key: 'obsidian', name: 'Obsidian', badge: 'OB', group: 'Notes', bg: '#EFE7FF', fg: '#5B3CC4',
  what: 'Agents search, read and write the notes in your Obsidian vault. Luna writes journal entries into your daily note, Recall searches the vault, Writer saves drafts there, and your [[links]] can become the knowledge graph.',
  fields: [{ key: 'OBSIDIAN_VAULT', label: 'Vault folder on the server computer', placeholder: 'C:\\Users\\you\\Documents\\My Vault' }, { key: 'OBSIDIAN_DAILY_FOLDER', label: 'Daily notes folder (optional)', placeholder: 'Daily' }],
  steps: [
    { title: 'Point Loopmates at your vault', text: 'Type the full path of your vault folder on the computer that runs the Loopmates server. Obsidian does not need to be open, and nothing is uploaded: the server reads the files in place. If you sync the vault (Obsidian Sync, iCloud, Git), changes show up on your other devices as usual.' },
    { title: 'Test, then sync the graph', text: 'Test counts your notes. Sync links turns your [[wiki links]] into the knowledge graph, so the agents know how your notes connect.' },
  ],
  ready: obsidianReady,
  note: () => (vault() ? (obsidianReady() ? `Vault at ${vault()}` : `Folder not found: ${vault()}`) : 'No vault set'),
  test: async () => { const n = (await notes()).length; return `Found ${n} note${n === 1 ? '' : 's'} in the vault.`; },
  actions: { sync: { label: 'Sync links to the graph' } },
  tools: OBSIDIAN_TOOLS,
};
