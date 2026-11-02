// Tool registry. Each Mate gets only the tools its "tools" setting grants (Web Search, Memory, Calendar...).
// Tools are called through a JSON protocol (works with any model, no native function-calling needed).
import dns from 'node:dns/promises';
import net from 'node:net';
import { env, now } from '../lib/env.js';
import { userCol } from './db.js';
import { searchKnowledge } from './knowledge.js';
import { putFile, artifactsReady } from './files.js';

import { hooks, setToolHooks } from './toolhooks.js';
import { MONITOR_TOOLS } from './monitor.js';
export { setToolHooks };

const cap = (s, n = 4000) => (s.length > n ? `${s.slice(0, n)}\n…[truncated]` : s);
const textOf = (h) => h.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const bad = (m) => Object.assign(new Error(m), { tool: true });

/* ---------- network safety: fetch_url must never reach private networks (SSRF) ---------- */
function privateIp(ip) {
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:') && privateIp(l.slice(7)); }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
async function assertPublic(urlStr) {
  let u; try { u = new URL(urlStr); } catch { throw bad('Not a valid URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw bad('Only http(s) URLs are allowed');
  if (u.port && !['80', '443', ''].includes(u.port)) throw bad('Only standard web ports are allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw bad('That address is private');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => { throw bad('Could not resolve that host'); });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw bad('That address is private');
  return u;
}
async function safeFetch(url, init = {}, hops = 3) {
  let cur = url;
  for (let i = 0; i <= hops; i++) {
    const u = await assertPublic(cur);
    const res = await fetch(u, { ...init, redirect: 'manual', signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'LoopmatesBot/0.1', ...(init.headers ?? {}) } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { cur = new URL(res.headers.get('location'), u).toString(); continue; }
    return res;
  }
  throw bad('Too many redirects');
}

/* ---------- web search ---------- */
async function search(query) {
  if (env('BRAVE_API_KEY')) {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6`, { headers: { 'x-subscription-token': env('BRAVE_API_KEY'), accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw bad(`Search provider answered ${r.status}`);
    return ((await r.json()).web?.results ?? []).slice(0, 6).map((x) => `${x.title}\n${x.url}\n${textOf(x.description ?? '')}`).join('\n\n');
  }
  // Keyless fallback: DuckDuckGo's HTML endpoint. Unofficial and may rate-limit; set BRAVE_API_KEY for something steadier.
  const r = await fetch('https://html.duckduckgo.com/html/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Mozilla/5.0 (compatible; LoopmatesBot/0.1)' }, body: `q=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw bad(`Search is unavailable right now (${r.status})`);
  const html = await r.text(); const out = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
  let m;
  while ((m = re.exec(html)) && out.length < 6) {
    let href = m[1]; const q = /[?&]uddg=([^&]+)/.exec(href); if (q) href = decodeURIComponent(q[1]);
    out.push(`${textOf(m[2])}\n${href}\n${textOf(m[3] ?? '')}`);
  }
  if (!out.length) throw bad('No results (the search endpoint may be rate-limiting). Try fetch_url on a known page.');
  return out.join('\n\n');
}

/* ---------- helpers ---------- */
const score = (text, terms) => { const low = text.toLowerCase(); return terms.reduce((s, t) => s + (low.includes(t) ? 1 : 0), 0); };
const termsOf = (q) => (String(q).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).slice(0, 10);
const iso = (v, label) => { const t = Date.parse(v); if (!Number.isFinite(t)) throw bad(`${label} must be an ISO date-time like 2026-11-05T09:00:00+05:30`); return new Date(t).toISOString(); };

/** name -> { group, desc, args, run(ctx, args) }  ctx = { uid, settings } */
export const TOOLS = {
  ...MONITOR_TOOLS,
  web_search: { group: 'Web Search', net: true, desc: 'Search the web. Returns titles, URLs and snippets.', args: '{"query": "text"}', run: async (_c, a) => cap(await search(String(a.query ?? '').slice(0, 200))) },
  fetch_url: { group: 'Web Search', net: true, desc: 'Open a public web page and read its text.', args: '{"url": "https://..."}', run: async (_c, a) => {
    const res = await safeFetch(String(a.url));
    if (!res.ok) throw bad(`The page answered ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!/text|json|xml/.test(type)) throw bad(`Cannot read ${type || 'that file type'}`);
    const body = (await res.text()).slice(0, 400_000);
    return cap(type.includes('html') ? textOf(body) : body, 6000);
  } },
  knowledge_search: { group: 'Vector Search', desc: "Search the owner's Knowledge library (notes, links, files).", args: '{"query": "text"}', run: async (c, a) => {
    const hits = await searchKnowledge(c.uid, String(a.query ?? ''), c.settings?.topK || 5);
    return hits.length ? hits.map((h) => `[${h.name}] ${h.snippet}`).join('\n') : 'No matching knowledge.';
  } },
  memory_save: { group: 'Memory', desc: 'Save something worth remembering about the owner or their work.', args: '{"text": "fact", "kind": "note|idea|decision|fact|journal|link"}', run: async (c, a) => {
    const text = String(a.text ?? '').trim().slice(0, 2000); if (!text) throw bad('text is required');
    const kind = ['note', 'idea', 'decision', 'fact', 'journal', 'link'].includes(a.kind) ? a.kind : 'note';
    const ref = userCol(c.uid, 'memories').doc(); const ts = now();
    await ref.set({ kind, text, scope: c.settings?.memoryScope === 'shared' ? 'shared' : 'private', pinned: false, createdAt: ts, updatedAt: ts, by: c.mate ?? 'mimo' });
    return `Saved memory ${ref.id}.`;
  } },
  memory_recall: { group: 'Memory', desc: 'Look up saved memories by keywords.', args: '{"query": "keywords"}', run: async (c, a) => {
    const terms = termsOf(a.query); const snap = await userCol(c.uid, 'memories').limit(300).get();
    const hits = snap.docs.map((d) => ({ ...d.data() })).map((m) => ({ m, s: terms.length ? score(m.text, terms) : 1 })).filter((x) => x.s).sort((x, y) => y.s - x.s).slice(0, 8);
    return hits.length ? hits.map((h) => `- (${h.m.kind}) ${h.m.text}`).join('\n') : 'No matching memories.';
  } },
  calendar_add: { group: 'Calendar', desc: 'Add an event or a reminder to the calendar. Reminders ping the owner on Telegram at that time.', args: '{"title": "text", "start": "ISO date-time with offset", "end": "optional ISO", "kind": "event|reminder", "notes": "optional"}', run: async (c, a) => {
    const start = iso(a.start, 'start'); const end = a.end ? iso(a.end, 'end') : new Date(Date.parse(start) + 30 * 60_000).toISOString();
    const doc = { title: String(a.title ?? '').slice(0, 200) || 'Untitled', start, end, kind: a.kind === 'event' ? 'event' : 'reminder', notes: String(a.notes ?? '').slice(0, 1000), createdAt: now(), updatedAt: now() };
    const ref = userCol(c.uid, 'events').doc(); await ref.set(doc); await hooks.events?.(c.uid, ref.id, doc, 'set');
    return `Added ${doc.kind} "${doc.title}" at ${start}.`;
  } },
  calendar_list: { group: 'Calendar', desc: 'List calendar events and reminders (optionally from/to ISO dates).', args: '{"from": "optional ISO", "to": "optional ISO"}', run: async (c, a) => {
    const from = a.from ? Date.parse(a.from) : Date.now() - 86_400_000, to = a.to ? Date.parse(a.to) : Date.now() + 30 * 86_400_000;
    const snap = await userCol(c.uid, 'events').limit(300).get();
    const rows = snap.docs.map((d) => d.data()).filter((e) => { const t = Date.parse(e.start); return t >= from && t <= to; }).sort((x, y) => x.start.localeCompare(y.start)).slice(0, 25);
    return rows.length ? rows.map((e) => `- ${e.start} [${e.kind}] ${e.title}`).join('\n') : 'Nothing scheduled in that range.';
  } },
  task_add: { group: 'Calendar', desc: 'Add a to-do task (optionally with a due date; due tasks ping on Telegram).', args: '{"title": "text", "detail": "optional", "dueAt": "optional ISO"}', run: async (c, a) => {
    const doc = { title: String(a.title ?? '').slice(0, 200) || 'Untitled', detail: String(a.detail ?? '').slice(0, 2000), status: 'todo', tags: [], ...(a.dueAt ? { dueAt: iso(a.dueAt, 'dueAt') } : {}), createdAt: now(), updatedAt: now() };
    const ref = userCol(c.uid, 'tasks').doc(); await ref.set(doc); await hooks.tasks?.(c.uid, ref.id, doc, 'set');
    return `Added task "${doc.title}".`;
  } },
  task_list: { group: 'Calendar', desc: 'List tasks (status: todo|doing|done, default not done).', args: '{"status": "optional"}', run: async (c, a) => {
    const snap = await userCol(c.uid, 'tasks').limit(300).get();
    const rows = snap.docs.map((d) => d.data()).filter((t) => (a.status ? t.status === a.status : t.status !== 'done')).slice(0, 25);
    return rows.length ? rows.map((t) => `- [${t.status}] ${t.title}${t.dueAt ? ` (due ${t.dueAt})` : ''}`).join('\n') : 'No tasks.';
  } },
  file_write: { group: 'File System', desc: 'Save a text file (Markdown, CSV, code...) to the owner\'s Drive.', args: '{"name": "report.md", "content": "text"}', needsApproval: true, run: async (c, a) => {
    if (!artifactsReady()) throw bad('File storage is not configured yet.');
    const name = String(a.name ?? 'file.txt').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100); const content = String(a.content ?? '');
    const f = await putFile(c.uid, { name, mime: name.endsWith('.md') ? 'text/markdown' : 'text/plain', buf: Buffer.from(content, 'utf8'), source: 'run', runId: c.runId });
    return `Saved ${name} (${f.size} bytes) to Drive.`;
  } },
  calculate: { group: '*', desc: 'Evaluate an arithmetic expression exactly (numbers, + - * / % ** and parentheses).', args: '{"expression": "(12.5*4)/3"}', run: async (_c, a) => {
    const e = String(a.expression ?? '');
    if (!/^[\d\s+\-*/%().]+$/.test(e) || e.length > 200) throw bad('Only numbers and + - * / % ** ( ) are allowed');
    const v = Function(`"use strict"; return (${e});`)();
    if (typeof v !== 'number' || !Number.isFinite(v)) throw bad('Not a finite number');
    return String(v);
  } },
};

/** Which tools a Mate may use, given its configured tool groups and the workspace settings. */
/** Always-on extras per Mate (on top of what its config lists). */
const EXTRA_GROUPS = { ops: ['Run Control'], halo: ['Run Control'], planner: ['Run Control'] };
export function toolsFor(groups = [], settings = {}, mateKey = '') {
  const g = new Set([...groups, ...(EXTRA_GROUPS[mateKey] ?? [])]);
  return Object.entries(TOOLS).filter(([, t]) => (t.group === '*' || g.has(t.group)) && !(t.net && settings.allowNetwork === false) && !(t.needsApproval && settings.permissionMode !== 'auto')).map(([name, t]) => ({ name, ...t }));
}

export async function runTool(name, args, ctx, allowed) {
  const t = allowed.find((x) => x.name === name);
  if (!t) return { ok: false, text: `Unknown or disallowed tool "${name}".` };
  try { return { ok: true, text: cap(String(await t.run(ctx, args && typeof args === 'object' ? args : {}))) }; }
  catch (e) { return { ok: false, text: `Tool error: ${e.tool ? e.message : 'failed'}${e.tool ? '' : ` (${String(e.message).slice(0, 120)})`}` }; }
}
