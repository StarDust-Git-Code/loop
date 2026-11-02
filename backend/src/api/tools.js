// Tool registry. Each Mate gets only the tools its "tools" setting grants (Web Search, Memory, Calendar...).
// Tools are called through a JSON protocol (works with any model, no native function-calling needed).
import dns from 'node:dns/promises';
import net from 'node:net';
import { env, now, uid as rid } from '../lib/env.js';
import { MATE } from './mates.js';
import { userCol } from './db.js';
import { searchKnowledge } from './knowledge.js';
import { putFile, artifactsReady } from './files.js';

import { hooks, setToolHooks } from './toolhooks.js';
import { MONITOR_TOOLS } from './monitor.js';
import { TOOLKIT, bindWeb } from './toolkit.js';
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

const NODE_TYPES = ['trigger', 'knowledge', 'input', 'mate', 'tool', 'condition', 'transform', 'filter', 'output'];
const WF_TOOLS = {
  workflow_list: { group: 'Workflows', desc: 'List the owner\'s workflows.', args: '{}', run: async (c) => {
    const rows = (await userCol(c.uid, 'workflows').limit(100).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    return rows.length ? rows.map((w) => `${w.id} | ${w.name} | ${(w.nodes ?? []).length} nodes | ${w.state ?? 'draft'}`).join('\n') : 'No workflows yet.';
  } },
  workflow_get: { group: 'Workflows', desc: 'Read one workflow: its nodes in order.', args: '{"id": "workflow id"}', run: async (c, a) => {
    const w = (await userCol(c.uid, 'workflows').doc(String(a.id ?? '')).get()).data(); if (!w) throw bad('No such workflow');
    const byId = new Map(w.nodes.map((n) => [n.id, n])); const next = new Map((w.edges ?? []).map((e) => [e.from, e.to]));
    const hasIn = new Set((w.edges ?? []).map((e) => e.to)); let cur = w.nodes.find((n) => !hasIn.has(n.id)) ?? w.nodes[0]; const seen = new Set(); const out = [];
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.push(`${out.length + 1}. [${cur.type}${cur.mate ? `:${cur.mate}` : ''}] ${cur.label}${cur.config && Object.keys(cur.config).length ? ` ${JSON.stringify(cur.config)}` : ''}`); cur = byId.get(next.get(cur.id)); }
    return `${w.name}: ${w.description ?? ''}\n${out.join('\n') || '(empty)'}`;
  } },
  workflow_save: { group: 'Workflows', write: true, desc: 'Create or replace a workflow on the Studio canvas as a chain of steps. Pass id to update an existing one, otherwise a new one is created.',
    args: '{"id?": "existing workflow id to update", "name": "workflow name", "description?": "one-line purpose", "steps": "ordered steps"}',
    props: { steps: { type: 'array', description: 'Ordered steps of the chain.', items: { type: 'object', properties: { type: { type: 'string', enum: NODE_TYPES }, mate: { type: 'string', description: 'Roster key for mate/tool steps, e.g. research, writer, code' }, label: { type: 'string', description: 'What this step does and outputs' }, config: { type: 'object', description: 'Optional, e.g. {"repo":"owner/name"} for code steps' } }, required: ['label'] } } },
    run: async (c, a) => {
      let steps = a.steps; if (typeof steps === 'string') { try { steps = JSON.parse(steps); } catch { throw bad('steps must be a JSON array'); } }
      if (!Array.isArray(steps) || !steps.length) throw bad('steps must be a non-empty array'); if (steps.length > 12) throw bad('At most 12 steps');
      const name = String(a.name ?? '').trim().slice(0, 80); if (!name) throw bad('name is required');
      const cfgs = Object.fromEntries((await userCol(c.uid, 'mates').get()).docs.map((d) => [d.id, d.data()]));
      const warn = []; const nodes = steps.map((s, i) => {
        const type = NODE_TYPES.includes(s?.type) ? s.type : 'mate'; const label = String(s?.label ?? '').trim().slice(0, 100); if (!label) throw bad(`Step ${i + 1} needs a label`);
        let mate = s?.mate && MATE[s.mate] ? s.mate : undefined;
        if ((type === 'mate' || type === 'tool') && !mate) { if (s?.mate) throw bad(`Step ${i + 1}: unknown mate "${s.mate}"`); mate = type === 'tool' ? 'ops' : 'research'; warn.push(`Step ${i + 1} had no mate, using ${mate}.`); }
        if (mate && cfgs[mate]?.enabled === false) warn.push(`${mate} is switched off; turn it on in Agents or the run will use Ops.`);
        if (!['mate', 'tool', 'output', 'trigger'].includes(type)) warn.push(`Step ${i + 1} (${type}) is documentation only: the engine skips it.`);
        const config = s?.config && typeof s.config === 'object' ? Object.fromEntries(Object.entries(s.config).slice(0, 6).map(([k, v]) => [k, String(v).slice(0, 200)])) : undefined;
        return { id: rid(), type, label, ...(mate && (type === 'mate' || type === 'tool') ? { mate } : {}), x: 40 + i * 240, y: 80, ...(config && Object.keys(config).length ? { config } : {}) };
      });
      const edges = nodes.slice(1).map((n, i) => ({ id: rid(), from: nodes[i].id, to: n.id }));
      const col = userCol(c.uid, 'workflows'); let ref = a.id ? col.doc(String(a.id)) : null; const prev = ref ? (await ref.get()).data() : null;
      if (a.id && !prev) throw bad('No workflow with that id');
      if (!ref) { const same = (await col.limit(100).get()).docs.find((d) => d.data().name?.toLowerCase() === name.toLowerCase()); ref = same ? same.ref : col.doc(); }
      const ts = now(); const existing = prev ?? (await ref.get()).data();
      await ref.set({ ...(existing ?? { createdAt: ts, state: 'draft' }), name, description: String(a.description ?? existing?.description ?? '').slice(0, 300), nodes, edges, updatedAt: ts });
      return `Saved workflow "${name}" (${ref.id}) with ${nodes.length} steps.${warn.length ? `\nWarnings:\n- ${warn.join('\n- ')}` : ''}\nThe owner can open Studio to review it and press Test Run.`;
    } },
};

bindWeb({ safeFetch });

/** name -> { group, desc, args, run(ctx, args) }  ctx = { uid, settings } */
export const TOOLS = {
  ...MONITOR_TOOLS,
  ...TOOLKIT,
  ...WF_TOOLS,
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
  memory_save: { group: 'Memory', write: true, desc: 'Save something worth remembering about the owner or their work.', args: '{"text": "fact", "kind?": "note|idea|decision|fact|journal|link"}', run: async (c, a) => {
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
  calendar_add: { group: 'Calendar', write: true, desc: 'Add an event or a reminder to the calendar. Reminders ping the owner on Telegram at that time.', args: '{"title": "text", "start": "ISO date-time with offset", "end": "optional ISO", "kind?": "event|reminder", "notes": "optional"}', run: async (c, a) => {
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
  task_add: { group: 'Calendar', write: true, desc: 'Add a to-do task (optionally with a due date; due tasks ping on Telegram).', args: '{"title": "text", "detail": "optional", "dueAt": "optional ISO"}', run: async (c, a) => {
    const doc = { title: String(a.title ?? '').slice(0, 200) || 'Untitled', detail: String(a.detail ?? '').slice(0, 2000), status: 'todo', tags: [], ...(a.dueAt ? { dueAt: iso(a.dueAt, 'dueAt') } : {}), createdAt: now(), updatedAt: now() };
    const ref = userCol(c.uid, 'tasks').doc(); await ref.set(doc); await hooks.tasks?.(c.uid, ref.id, doc, 'set');
    return `Added task "${doc.title}".`;
  } },
  task_list: { group: 'Calendar', desc: 'List tasks (status: todo|doing|done, default not done).', args: '{"status": "optional"}', run: async (c, a) => {
    const snap = await userCol(c.uid, 'tasks').limit(300).get();
    const rows = snap.docs.map((d) => d.data()).filter((t) => (a.status ? t.status === a.status : t.status !== 'done')).slice(0, 25);
    return rows.length ? rows.map((t) => `- [${t.status}] ${t.title}${t.dueAt ? ` (due ${t.dueAt})` : ''}`).join('\n') : 'No tasks.';
  } },
  file_write: { group: 'File System', write: true, desc: 'Save a text file (Markdown, CSV, code...) to the owner\'s Drive.', args: '{"name": "report.md", "content": "text"}', needsApproval: true, run: async (c, a) => {
    if (!artifactsReady()) throw bad('File storage is not configured yet.');
    const name = String(a.name ?? 'file.txt').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100); const content = String(a.content ?? '');
    const f = await putFile(c.uid, { name, mime: name.endsWith('.md') ? 'text/markdown' : 'text/plain', buf: Buffer.from(content, 'utf8'), source: 'run', runId: c.runId });
    return `Saved ${name} (${f.size} bytes) to Drive.`;
  } },
  chat_history: { group: '*', desc: 'Look back in THIS chat beyond what is shown: the first messages, the latest ones, or messages matching words.', args: '{"which?": "start|end", "query?": "words to find", "n?": "how many, max 20"}', run: async (c, a) => {
    if (!c.convId) throw bad('No chat is open');
    const conv = (await userCol(c.uid, 'conversations').doc(c.convId).get()).data(); const msgs = (conv?.messages ?? []).filter((m) => m.role !== 'system');
    const n = Math.min(Number(a.n) || 8, 20); let rows;
    if (a.query) { const t = termsOf(a.query); rows = msgs.map((m, i) => ({ m, i, s: score(m.text, t) })).filter((x) => x.s).sort((x, y) => y.s - x.s).slice(0, n).sort((x, y) => x.i - y.i); }
    else rows = (a.which === 'end' ? msgs.slice(-n) : msgs.slice(0, n)).map((m, i) => ({ m, i: a.which === 'end' ? msgs.length - n + i : i }));
    return rows.length ? rows.map(({ m, i }) => `#${i + 1} ${m.role === 'user' ? 'owner' : m.mate ?? 'mate'} (${m.at?.slice(0, 16)}): ${m.text.slice(0, 400)}`).join('\n') : 'Nothing found.';
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
const DELEGATORS = ['Delegation', 'Run Control'];
const EXTRA_GROUPS = { '*': ['Utilities'], ops: DELEGATORS, halo: DELEGATORS, planner: DELEGATORS, flow: ['Delegation'], research: ['Delegation'] };
export function toolsFor(groups = [], settings = {}, mateKey = '') {
  const g = new Set([...groups, ...EXTRA_GROUPS['*'], ...(EXTRA_GROUPS[mateKey] ?? [])]);
  return Object.entries(TOOLS).filter(([, t]) => (t.group === '*' || g.has(t.group)) && !(t.net && settings.allowNetwork === false) && !(t.needsApproval && settings.permissionMode !== 'auto')).map(([name, t]) => ({ name, ...t }));
}

export async function runTool(name, args, ctx, allowed) {
  const t = allowed.find((x) => x.name === name);
  if (!t) return { ok: false, text: `Unknown or disallowed tool "${name}".` };
  try { return { ok: true, text: cap(String(await t.run(ctx, args && typeof args === 'object' ? args : {}))) }; }
  catch (e) { return { ok: false, text: `Tool error: ${e.tool ? e.message : 'failed'}${e.tool ? '' : ` (${String(e.message).slice(0, 120)})`}` }; }
}
