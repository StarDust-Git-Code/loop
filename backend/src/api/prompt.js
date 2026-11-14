// Dynamic system prompt: rebuilt on every turn from the Mate, the owner's settings, memories, skills and knowledge.
import { recall, lessonsFor } from './memory.js';
import { readFileSync } from 'node:fs';
import { env } from '../lib/env.js';
import { MATE, PLANNER_GUIDE, FLOW_GUIDE, LEADER_GUIDE, rosterText } from './mates.js';
import { loadRoster } from './roster.js';
import { effortOf, providerSummary } from './llm.js';
import { userCol } from './db.js';
import { accessOf, catalog } from './reach.js';

const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n)}…` : String(s));
const terms = (q) => (String(q).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).slice(0, 10);

function clock(tz) {
  const d = new Date();
  try { return `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: tz }).format(d)} (${tz})`; }
  catch { return d.toISOString(); }
}

/** A few memories stay inline every turn: pinned shared ones (max 5) and the top `autoRecall` hits for this message. */
// Lessons have their own block ({{lessons}}), so they are left out here.
async function memoriesFor(uid, query, mateKey, access, n) {
  if (!n && n !== undefined) return (await recall(uid, '', { k: 0, pinned: 5, mate: mateKey, access })).filter((m) => m.kind !== 'lesson').map((m) => `- (${m.kind}) ${clip(m.text, 300)}`);
  const hits = await recall(uid, query, { k: (n ?? 3) + 2, pinned: 5, mate: mateKey, access });
  return hits.filter((m) => m.kind !== 'lesson').slice(0, 5 + (n ?? 3)).map((m) => `- (${m.kind}${m.scope === 'personal' ? ', your note' : ''}) ${clip(m.text, 300)}`);
}

export function toolBlock(tools) {
  if (!tools.length) return '';
  return `Tools: you can call tools through the tool-calling interface. Work like a careful engineer:
- Use a tool only when it actually helps; answer directly when you already know.
- When several lookups are independent, request them together in one turn.
${tools.some((t) => t.name === 'web_search') ? '- For quick lookups (specs, prices, facts, news) use web_search: it is fast and Google-grounded. Open pages or a browser only when you must read a specific page or interact with one.\n' : ''}- Never repeat a call you already made; read the result before deciding the next step.
- If a tool fails, say what failed and try another approach or ask the owner.
- Ground claims in tool results and cite them. Never invent results or pretend to have run something.
- Write actions (saving, scheduling, stopping runs) only when the owner asked for them.`;
}

export const THINK_TEXT = {
  low: 'Thinking level: LOW. Answer directly and quickly. Do not over-explain.',
  medium: 'Thinking level: MEDIUM. Think briefly before answering and sanity-check the result.',
  high: 'Thinking level: HIGH. Think carefully before answering: break the problem down, weigh alternatives, and check your answer for mistakes. Keep your reasoning private and output only the final answer.',
  xhigh: 'Thinking level: XHIGH. Think very thoroughly: draft an answer, critique the draft for errors and gaps, then revise it. Verify facts with your tools whenever you can. Keep your reasoning private and output only the final, polished answer.',
};

/* ------------------------------------------------------------------ the agent system prompt template
   prompts/agent-system-prompt.md is loaded once. Each turn it is filled in: {{placeholders}} get values, [[if X]] blocks
   are kept only when X holds, and section 4 (role cards) is cut down to the speaking Mate's own card. */
const TEMPLATE = readFileSync(new URL('../../prompts/agent-system-prompt.md', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->\s*/, '');
const CARDS = (() => {
  const sec = /# 4\. Role cards[\s\S]*?(?=\n# 5\.)/.exec(TEMPLATE)?.[0] ?? '';
  const out = {};
  for (const para of sec.split(/\n\s*\n/)) { const m = /^\*\*(\w+)\*\*/.exec(para.trim()); if (m) out[m[1].toLowerCase()] = para.trim(); }
  return out;
})();

/** A first card for a custom agent the owner did not write one for, so it still has a voice and an ending of its own. */
const starterCard = (name, blurb) => `**${name}** (custom agent). ${blurb}
How you work: do the job above with your tools; anything outside it goes to the right colleague (section 5).
Voice: plain, friendly and direct, in the first person.
Ends with: the one next step, when there is one.
Sign-off: — ${name}`;

/** The line added under a Mate's pings and notifications (the card's Sign-off line, else "— Name"). */
export function signoffFor(mateKey, cfg = {}, def = null) {
  const m = def ?? MATE[mateKey];
  return /^Sign-off:\s*(.+)$/m.exec(cardFor(mateKey, cfg, def))?.[1]?.trim().slice(0, 80) || (m ? `— ${m.name}` : '');
}

/**
 * The speaking Mate's role card: the owner's edited card, else the built-in one, else a starter card (custom agents).
 * The owner's Personality line (Agents → Configure) is added last and overrides the card's Voice.
 */
export function cardFor(mateKey, cfg = {}, def = null) {
  const m = def ?? MATE[mateKey];
  let card = cfg.card && String(cfg.card).trim() ? clip(cfg.card, 3000) : (MATE[mateKey] ? CARDS[MATE[mateKey].name.toLowerCase()] ?? '' : '');
  if (!card && m) card = starterCard(m.name, m.blurb || 'A custom agent.');
  const p = String(cfg.personality ?? '').trim();
  return p ? `${card}\nVoice (set by the owner, this wins over the Voice line above): ${clip(p, 400)}` : card;
}

/** A short system prompt for one-shot writing (run files, final reports, failure reports): the same card and voice as chat. */
export function briefPersona(mateKey, cfg = {}, def = null) {
  const m = def ?? MATE[mateKey] ?? MATE.planner;
  return `You are ${m.name}, one of the Mates in Loopmates. Your role card, including how you sound:\n\n${cardFor(mateKey, cfg, def)}\n\nWrite in that voice. Be honest: never invent facts or results, and say so when you are unsure.${cfg.instructions ? `\n\nThe owner's instructions for you:\n${clip(cfg.instructions, 2000)}` : ''}`;
}

/** Fill the template. Conditions: mode=X, surface=X, tool=X, a placeholder name (non-empty), each optionally negated with "!". */
export function renderTemplate(vars, { mode, surface, tools }) {
  const truthy = (cond) => {
    const neg = cond.startsWith('!'); const c = neg ? cond.slice(1) : cond;
    let v;
    if (c.startsWith('mode=')) v = mode === c.slice(5);
    else if (c.startsWith('surface=')) v = surface === c.slice(8);
    else if (c.startsWith('tool=')) v = tools.includes(c.slice(5));
    else v = !!String(vars[c] ?? '').trim();
    return neg ? !v : v;
  };
  let t = TEMPLATE;
  for (let i = 0; i < 3; i++) t = t.replace(/\[\[if ([^\]]+)\]\]\n?([\s\S]*?)\[\[\/if\]\]\n?/g, (_, cond, body) => (truthy(cond.trim()) ? body : ''));
  t = t.replace(/# 4\. Role cards[\s\S]*?(?=\n# 5\.)/, vars['mate.card'] ? `# 4. Your role card\n\n${vars['mate.card']}\n` : '');
  // A line that is only an empty placeholder (plus punctuation) disappears; other empty placeholders become ''.
  t = t.split('\n').filter((line) => {
    const ph = [...line.matchAll(/\{\{([\w.]+)\}\}/g)];
    if (!ph.length || ph.some((m) => String(vars[m[1]] ?? '').trim())) return true;
    return line.replace(/\{\{[\w.]+\}\}/g, '').replace(/[\s:*`.,()-]/g, '').length > 25;
  }).join('\n');
  t = t.replace(/\{\{([\w.]+)\}\}/g, (_, k) => String(vars[k] ?? ''));
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/** One line per channel, for {{connections}}. */
async function connectionsFor(uid) {
  const [conns, devices] = await Promise.all([
    userCol(uid, 'connections').limit(50).get().then((s) => s.docs.map((d) => d.data())).catch(() => []),
    userCol(uid, 'devices').limit(20).get().then((s) => s.docs.map((d) => d.data())).catch(() => []),
  ]);
  const linked = (p) => conns.some((c) => c.provider === p && c.status === 'connected');
  const line = (name, ok, how) => `- ${name}: ${ok ? 'linked' : `not linked${how ? ` (${how})` : ''}`}`;
  return [
    line('App push (dashboard / phone)', devices.length > 0, 'the owner can turn on notifications in Settings'),
    line('Telegram', linked('telegram') && !!env('TELEGRAM_BOT_TOKEN'), 'Connections → Telegram'),
    line('Discord', linked('discord') && !!env('DISCORD_BOT_TOKEN'), 'Connections → Discord'),
    line('Google Drive', !!env('GOOGLE_REFRESH_TOKEN') || env('DRIVE_FAKE') === '1', 'Connections → Google Drive'),
    line('GitHub', linked('github') || !!env('GITHUB_TOKEN'), 'Connections → GitHub'),
  ].join('\n');
}
const serverLine = () => `${process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'} computer${env('PUBLIC_URL') ? ', reachable online' : ''}; features: ${[env('GEMINI_API_KEY') && 'voice calls', (env('GOOGLE_REFRESH_TOKEN') || env('DRIVE_FAKE') === '1') && 'Google Drive', 'browser', 'sandboxed coding'].filter(Boolean).join(', ')}`;

export async function buildSystem({ uid, mateKey, cfg = {}, mode = 'chat', query = '', settings, tools = [], others = [], effort, surface = 'chat', run = '', call = '', access = accessOf(cfg) }) {
  const ro = await loadRoster(uid);
  const m = ro.byKey[mateKey] ?? MATE[mateKey] ?? MATE.planner;
  const isLeader = mateKey === ro.leader;
  const style = [];
  if (cfg.outputFormat) style.push(`Answer format: ${cfg.outputFormat}.`);
  if (settings.prefersShort) style.push('Keep answers short: a few sentences unless asked for more.');
  if (settings.citeAlways) style.push('When you use web pages, knowledge or memories, cite the source (URL or name).');
  const own = mateKey === 'flow' ? FLOW_GUIDE(ro) : mateKey === 'planner' ? PLANNER_GUIDE(ro) : '';
  const playbook = [isLeader ? LEADER_GUIDE(ro, m.name) : '', own].filter(Boolean).join('\n\n');
  const prov = (await providerSummary(uid).catch(() => []))[0];
  const toolList = tools.map((t) => t.name);
  const memOk = access.memory.shared !== 'none' || access.memory.personal;
  const [mem, reach, connections, lessons] = await Promise.all([
    memOk ? memoriesFor(uid, query, mateKey, access, settings.autoRecall).catch(() => []) : [],
    catalog(uid, mateKey, access, { tools: toolList }).catch(() => ''),
    connectionsFor(uid),
    access.memory.personal ? lessonsFor(uid, mateKey, query, 4).catch(() => []) : [],
  ]);
  const guards = [];
  if (settings.guardPurchases) guards.push('Never buy, pay for, or subscribe to anything.');
  if (settings.guardContainer) guards.push('Never touch anything outside the sandbox; no destructive commands.');
  if (settings.allowNetwork === false) guards.push('Network access is switched off: do not try to browse the web.');
  guards.push(`Permission mode: ${settings.permissionMode === 'auto' ? 'auto (risky actions run without asking)' : 'ask (risky actions wait for the owner\'s approval)'}.`);
  if (settings.quietHoursOn) guards.push(`Quiet hours ${settings.quietFrom}–${settings.quietTo} (owner's time): do not ring or ping the owner then unless it is urgent.`);
  const toolNames = mode === 'plan' ? [] : tools.map((t) => t.name);
  const vars = {
    'mate.key': mateKey, 'mate.name': m.name, 'mate.role': cfg.description || m.blurb, 'mate.card': cardFor(mateKey, cfg, m), 'mate.leader': isLeader ? 'yes' : '', leader: ro.name(ro.leader),
    'owner.name': settings.displayName || 'your owner', 'owner.timezone': settings.timezone, now: clock(settings.timezone),
    'owner.instructions': cfg.instructions ? clip(cfg.instructions, 2000) : '', 'owner.style': style.join(' '),
    surface, mode, thinking: THINK_TEXT[effort ?? effortOf(cfg.thinking)], others: others.join(', '),
    roster: playbook ? '' : rosterText(ro), playbook,
    tools: toolNames.join(', '), connections, 'connections.push': ', and app push to the dashboard and phone', server: serverLine(),
    'runtime.provider': prov?.name ?? '', 'runtime.model': prov?.model ?? '',
    reach, memories: mem.join('\n'), lessons: lessons.map((l) => `- ${clip(l.text, 240)}`).join('\n'),
    guards: guards.map((g) => `- ${g}`).join('\n'), run, call,
  };
  const full = renderTemplate(vars, { mode, surface, tools: toolNames });
  // A small context window (developer setting) gets a compact prompt: the reference sections go, the essentials stay.
  const budget = settings.maxContextTokens > 0 ? settings.maxContextTokens * 4 : 0;
  return budget && full.length > budget * 0.35 ? compact(full, budget * 0.35) : full;
}

const KEEP_ORDER = [/^# Who you are/, /^# 4\. /, /^# 9\. /, /^# 11\. /, /^# Inside a run/, /^# Voice call rules/, /^# 10\. /, /^# 5\. /, /^# 6\. /, /^# 3\. /, /^# 2\. /];
/** Keep the most important sections, in their original order, until the budget is used. */
function compact(text, maxChars) {
  const secs = text.split(/\n(?=# )/);
  const keep = new Set(); let used = 0;
  for (const re of KEEP_ORDER) {
    const i = secs.findIndex((s) => re.test(s)); if (i < 0) continue;
    if (used + secs[i].length > maxChars && keep.size) continue;
    keep.add(i); used += secs[i].length;
  }
  return secs.filter((_, i) => keep.has(i)).join('\n').slice(0, Math.max(2000, maxChars));
}

/** The built-in role card of every Mate (by key), for the Agents screen. */
export const defaultCards = () => Object.fromEntries(Object.values(MATE).map((m) => [m.key, CARDS[m.name.toLowerCase()] ?? '']));
