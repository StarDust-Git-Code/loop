import type { BuiltinMateKey, MateConfig, MateKey } from './types';

/** Static product catalogue (what each Mate is). Not user data. */
export type MateDef = { key: MateKey; name: string; role: string; blurb: string; tools: string[]; core: boolean; tint: string; custom?: boolean; avatar?: BuiltinMateKey };

export const MATE_DEFS: MateDef[] = [
  { key: 'research', tint: '#ffe6e3', name: 'Research', role: 'Core', core: true, blurb: 'Finds information, analyses sources and keeps notes.', tools: ['Web Search', 'Browser', 'File System', 'Vector Search'] },
  { key: 'flow', tint: '#dff5ec', name: 'Flow', role: 'Core', core: true, blurb: 'Designs and edits your workflow canvas from a plain-language goal.', tools: ['Workflows'] },
  { key: 'code', tint: '#e3ebff', name: 'Code', role: 'Core', core: true, blurb: 'Writes, reviews and runs code in a contained container.', tools: ['Terminal', 'File System', 'Code Interpreter'] },
  { key: 'planner', tint: '#f4ecdd', name: 'Planner', role: 'Core', core: true, blurb: 'Breaks big jobs into steps and decides who does each one.', tools: ['File System'] },
  { key: 'writer', tint: '#fff1c9', name: 'Writer', role: 'Core', core: true, blurb: 'Produces reports, scripts and drafts in your voice.', tools: ['File System'] },
  { key: 'browser', tint: '#e2f4d3', name: 'Browser', role: 'Core', core: true, blurb: 'Drives a browser to read pages and fill in forms.', tools: ['Browser'] },
  { key: 'ops', tint: '#ece3ff', name: 'Ops', role: 'Core', core: true, blurb: 'Coordinates operational tasks, files and approvals.', tools: ['File System', 'Terminal'] },
  { key: 'mimo', tint: '#ffe1ee', name: 'Mimo', role: 'Personal', core: false, blurb: 'Your private second brain: memories, reminders and a daily plan.', tools: ['Memory', 'Calendar'] },
  { key: 'orbit', tint: '#e5e9f2', name: 'Orbit', role: 'Personal', core: false, blurb: 'Plans your week and moves things around when plans change.', tools: ['Calendar'] },
  { key: 'recall', tint: '#d6f2f3', name: 'Recall', role: 'Personal', core: false, blurb: 'Finds anything in your memories, files and sources.', tools: ['Memory', 'Vector Search'] },
  { key: 'spark', tint: '#ffe6d3', name: 'Spark', role: 'Creative', core: false, blurb: 'Brainstorms ideas and turns rough thoughts into clear ones.', tools: ['Memory'] },
  { key: 'zen', tint: '#dfecff', name: 'Zen', role: 'Personal', core: false, blurb: 'Protects your focus time and keeps breaks on the calendar.', tools: ['Calendar'] },
  { key: 'luna', tint: '#eadfff', name: 'Luna', role: 'Personal', core: false, blurb: 'Reflects on your day and keeps a journal.', tools: ['Memory'] },
  { key: 'scout', tint: '#f0e2d2', name: 'Scout', role: 'Creative', core: false, blurb: 'Explores topics and places, builds reading lists.', tools: ['Web Search', 'Browser'] },
  { key: 'chef', tint: '#ffebd9', name: 'Chef', role: 'Personal', core: false, blurb: 'Plans meals, grocery lists and routines.', tools: ['Memory'] },
  { key: 'tune', tint: '#d5f1ef', name: 'Tune', role: 'Creative', core: false, blurb: 'Handles audio and music tasks, playlists and notes.', tools: ['File System'] },
  { key: 'data', tint: '#e2dfea', name: 'Data', role: 'Dev', core: false, blurb: 'Cleans data, builds tables and charts and explains them.', tools: ['Code Interpreter', 'File System'] },
  { key: 'byte', tint: '#e1def2', name: 'Byte', role: 'Dev', core: false, blurb: 'Specialist for long coding jobs with checkpoints.', tools: ['Terminal', 'File System', 'Code Interpreter'] },
  { key: 'halo', tint: '#ecebfb', name: 'Halo', role: 'Dev', core: false, blurb: 'Reviews risky actions and asks for your approval.', tools: ['File System'] },
];

const BUILTIN = Object.fromEntries(MATE_DEFS.map((m) => [m.key, m])) as Record<string, MateDef>;
export const isBuiltin = (k: string) => k in BUILTIN;

/* ---------- custom agents: registered from the owner's mate configs (see lib/agents.ts) ---------- */
const custom = new Map<string, MateDef>();
let version = 0; const subs = new Set<() => void>();
export const subscribeAgents = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export const agentsVersion = () => version;
export function registerAgents(cfgs: MateConfig[]) {
  const next = new Map<string, MateDef>();
  for (const c of cfgs) if (c.custom && !isBuiltin(c.id)) {
    const av = (c.avatar && isBuiltin(c.avatar) ? c.avatar : 'orbit') as BuiltinMateKey;
    next.set(c.id, { key: c.id, name: c.name || c.id, role: 'Custom', blurb: c.description || 'A custom agent.', tools: c.tools ?? [], core: false, tint: BUILTIN[av].tint, custom: true, avatar: av });
  }
  const same = next.size === custom.size && [...next].every(([k, d]) => { const o = custom.get(k); return o && o.name === d.name && o.blurb === d.blurb && o.avatar === d.avatar; });
  if (same) return;
  custom.clear(); next.forEach((d, k) => custom.set(k, d)); version++; subs.forEach((f) => f());
}
export const customDefs = () => [...custom.values()];
const fallback = (k: string): MateDef => ({ key: k, name: k ? k[0].toUpperCase() + k.slice(1) : 'Agent', role: 'Custom', blurb: 'A custom agent.', tools: [], core: false, tint: BUILTIN.orbit.tint, custom: true, avatar: 'orbit' });
export const mateDef = (k: MateKey): MateDef => BUILTIN[k] ?? custom.get(k) ?? fallback(k);
/** Any key works: built-ins, registered custom agents, then a neutral fallback (never undefined). */
export const MATES = new Proxy(BUILTIN, { get: (_t, k) => (typeof k === 'string' ? mateDef(k) : undefined), has: (_t, k) => typeof k === 'string' && (k in BUILTIN || custom.has(k)) }) as Record<MateKey, MateDef>;
export const mateImg = (k: MateKey) => `/dots/${isBuiltin(k) ? k : mateDef(k).avatar ?? 'orbit'}.png`;
export const AVATARS = MATE_DEFS.map((m) => m.key) as BuiltinMateKey[];
/** Gemini Live call voices (mirrors backend/src/api/mates.js). Built-ins have their own; '' in a config means that default. */
export const VOICE_NAMES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'] as const;
export const MATE_VOICE: Partial<Record<BuiltinMateKey, string>> = { planner: 'Kore', research: 'Charon', code: 'Fenrir', flow: 'Aoede', writer: 'Leda', browser: 'Puck', ops: 'Orus', mimo: 'Zephyr', orbit: 'Achernar', recall: 'Sulafat', spark: 'Callirrhoe', zen: 'Vindemiatrix', luna: 'Despina', scout: 'Algenib', chef: 'Achird', tune: 'Enceladus', data: 'Iapetus', byte: 'Umbriel', halo: 'Gacrux' };
/** Ready-made personality lines for the New agent screen. The owner can also write their own. */
export const PERSONALITIES = [
  ['', 'Default: plain, friendly and direct'],
  ['Warm and encouraging, like a supportive coach. Celebrates progress, keeps it short.', 'Warm coach'],
  ['Crisp and businesslike. Bullet points, numbers, no small talk.', 'Crisp professional'],
  ['Playful and witty, with light humour, but never at the expense of accuracy.', 'Playful'],
  ['Calm and patient teacher. Explains step by step and checks understanding.', 'Patient teacher'],
  ['Blunt and skeptical. Points out weak spots first, then suggests fixes.', 'Blunt critic'],
] as const;
export const ALL_TOOLS = ['Web Search', 'Browser', 'File System', 'Terminal', 'Code Interpreter', 'Vector Search', 'Memory', 'Calendar', 'Run Control', 'Workflows', 'Company', 'Delegation', 'Notes', 'Google', 'Team Chat', 'Task Apps', 'Music', 'Feeds', 'Health', 'Home'];

/** Card header gradients, from the design boards. */
const GRAD_BASE: Record<string, string> = {
  research: 'linear-gradient(160deg,#FFE1DF,#FFF3EE)', code: 'linear-gradient(160deg,#DCE4FF,#F1F4FF)', planner: 'linear-gradient(160deg,#F1ECFA,#FBF6EA)', flow: 'linear-gradient(160deg,#CDEFE0,#EEF9F4)',
  writer: 'linear-gradient(160deg,#FFEDB0,#FFF8DF)', browser: 'linear-gradient(160deg,#D3F0D1,#EEF9EC)', ops: 'linear-gradient(160deg,#E3D9FF,#F5F1FF)',
  mimo: 'linear-gradient(160deg,#FFD9E6,#FFF0F5)', orbit: 'linear-gradient(160deg,#E4E6EA,#F5F6F8)', recall: 'linear-gradient(160deg,#C9F1F4,#EAFAFB)',
  spark: 'linear-gradient(160deg,#FFD9BF,#FFF1E6)', zen: 'linear-gradient(160deg,#D6E4FF,#F0F5FF)', luna: 'linear-gradient(160deg,#E3D9FF,#F5F1FF)',
  scout: 'linear-gradient(160deg,#EBD3BE,#F8EEE4)', chef: 'linear-gradient(160deg,#FFE2C2,#FFF4E4)', tune: 'linear-gradient(160deg,#BDEFE8,#E6F9F6)',
  data: 'linear-gradient(160deg,#DCD3F5,#F1EDFB)', byte: 'linear-gradient(160deg,#D9D3EE,#EFECF8)', halo: 'linear-gradient(160deg,#E8E4FA,#FBF7FF)',
};
export const GRAD = new Proxy(GRAD_BASE, { get: (t, k) => (typeof k === 'string' ? t[k] ?? t[mateDef(k).avatar ?? 'orbit'] : undefined) }) as Record<MateKey, string>;
export const mateName = (k: MateKey) => `${MATES[k].name}${MATES[k].core ? ' Mate' : ''}`;
