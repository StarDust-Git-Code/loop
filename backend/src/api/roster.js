// The owner's roster: the built-in Mates (minus the ones the owner removed) plus custom agents they created, and which
// one leads. Built-ins live in mates.js; custom agents are users/{uid}/mates/{key} docs with custom: true.
// Cached per user for 30 s; any write to mates or settings clears the cache.
import { userCol } from './db.js';
import { getSettings } from './settings.js';
import { MATE_DEFS, MATE, defaultConfig, VOICE_NAMES } from './mates.js';
import { now } from '../lib/env.js';

const TTL = 30_000;
const cache = new Map();
export const MAX_AGENTS = 60;
export const KEY_RE = /^[a-z][a-z0-9]{1,23}$/; // no dashes: @mentions are [a-z0-9]+
export const AVATARS = MATE_DEFS.map((m) => m.key); // custom agents reuse a mascot image
const bad = (m, code = 400) => Object.assign(new Error(m), { statusCode: code });

export function invalidateRoster(uid) { if (uid) cache.delete(uid); else cache.clear(); }

const defOf = (key, c) => {
  const b = MATE[key];
  if (b) return { ...b, builtin: true, custom: false, avatar: key, name: b.name, blurb: c?.description || b.blurb, tools: c?.tools ?? b.tools };
  return { key, name: String(c.name || key).slice(0, 40), core: false, blurb: String(c.description || '').slice(0, 300) || 'A custom agent.', tools: Array.isArray(c.tools) ? c.tools : [], builtin: false, custom: true, avatar: AVATARS.includes(c.avatar) ? c.avatar : 'orbit' };
};

/** { list, byKey, cfgs, leader, removed, on(k), has(k), name(k) } */
export async function loadRoster(uid) {
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < TTL) return hit.r;
  const [snap, settings] = await Promise.all([userCol(uid, 'mates').limit(200).get().catch(() => ({ docs: [] })), getSettings(uid)]);
  const cfgs = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  const list = [], removed = [];
  for (const d of MATE_DEFS) (cfgs[d.key]?.removed ? removed : list).push(defOf(d.key, cfgs[d.key]));
  for (const [k, c] of Object.entries(cfgs)) if (c?.custom && !MATE[k]) (c.removed ? removed : list).push(defOf(k, c));
  const byKey = Object.fromEntries(list.map((d) => [d.key, d]));
  const enabled = (k) => (cfgs[k] ? cfgs[k].enabled !== false : !!byKey[k]?.core);
  const pick = [settings.leader, 'mimo', ...list.filter((d) => enabled(d.key)).map((d) => d.key), list[0]?.key].find((k) => k && byKey[k]);
  const r = {
    list, byKey, cfgs, removed, leader: pick || 'mimo',
    has: (k) => !!byKey[k],
    on: (k) => !!byKey[k] && (k === (pick || 'mimo') || enabled(k)), // the leader is always reachable
    name: (k) => byKey[k]?.name ?? MATE[k]?.name ?? cfgs[k]?.name ?? k,
    /** A valid, switched-on agent key, or the leader. */
    resolve: (k) => (k && byKey[k] && (k === (pick || 'mimo') || enabled(k)) ? k : (pick || 'mimo')),
  };
  cache.set(uid, { at: Date.now(), r });
  return r;
}

/** Roster text for prompts: one line per agent, leader marked. */
export const rosterLines = (r) => r.list.map((d) => `- ${d.key}${d.key === r.leader ? ' (LEADER)' : ''} [${r.on(d.key) ? 'ON' : 'OFF'}] ${d.name}: ${d.blurb} Tools: ${(r.cfgs[d.key]?.tools ?? d.tools).join(', ') || 'none'}.`).join('\n');

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '').slice(0, 20);

/** Create a custom agent. */
export async function createAgent(uid, body = {}) {
  const name = String(body.name ?? '').trim().slice(0, 40);
  if (!name) throw bad('A name is required.');
  const r = await loadRoster(uid);
  if (r.list.length + r.removed.length >= MAX_AGENTS) throw bad(`At most ${MAX_AGENTS} agents. Delete one first.`);
  let key = slug(body.key || name); if (!/^[a-z]/.test(key)) key = `a${key}`;
  if (key.length < 2) key = `${key}agent`;
  const taken = (k) => MATE[k] || r.cfgs[k];
  for (let i = 2; taken(key); i++) key = `${slug(body.key || name).slice(0, 18) || 'agent'}${i}`;
  if (!KEY_RE.test(key)) throw bad('Use letters and numbers for the name.');
  const ts = now();
  const doc = {
    ...defaultConfig({ key, core: false, blurb: '', tools: [] }, ts),
    custom: true, name, enabled: body.enabled !== false,
    description: String(body.description ?? '').slice(0, 300),
    card: String(body.card ?? '').slice(0, 6000), instructions: String(body.instructions ?? '').slice(0, 4000),
    tools: Array.isArray(body.tools) ? body.tools.map(String).slice(0, 20) : ['Memory', 'Web Search'],
    avatar: AVATARS.includes(body.avatar) ? body.avatar : AVATARS[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARS.length],
    model: String(body.model ?? '').slice(0, 120),
    personality: String(body.personality ?? '').trim().slice(0, 400),
    voice: VOICE_NAMES.includes(body.voice) ? body.voice : '', // '' = a spare voice no built-in uses (voiceFor)
  };
  await userCol(uid, 'mates').doc(key).set(doc);
  invalidateRoster(uid);
  return { id: key, ...doc };
}

/** Remove an agent: custom ones are deleted, built-ins are hidden and can be restored. The leader cannot be removed. */
export async function removeAgent(uid, key) {
  const r = await loadRoster(uid);
  if (!r.has(key)) throw bad('No such agent.', 404);
  if (key === r.leader) throw bad(`${r.name(key)} is the leader. Make another agent the leader first.`, 409);
  const ref = userCol(uid, 'mates').doc(key);
  if (MATE[key]) { const cur = r.cfgs[key] ?? defaultConfig(MATE[key], now()); await ref.set({ ...cur, removed: true, enabled: false, updatedAt: now() }); }
  else await ref.delete();
  invalidateRoster(uid);
}

export async function restoreAgent(uid, key) {
  if (!MATE[key]) throw bad('Only built-in agents can be restored.', 404);
  const ref = userCol(uid, 'mates').doc(key);
  const cur = (await ref.get()).data() ?? defaultConfig(MATE[key], now());
  await ref.set({ ...cur, removed: false, enabled: true, updatedAt: now() });
  invalidateRoster(uid);
}

/** Checks a mate config patch from the dashboard. Returns the cleaned patch. */
export async function guardMatePatch(uid, key, patch) {
  for (const k of ['custom', 'removed', 'mate']) delete patch[k];
  const r = await loadRoster(uid);
  if (patch.enabled === false && key === r.leader) throw bad(`${r.name(key)} is the leader and cannot be switched off. Make another agent the leader first.`, 409);
  if (!MATE[key]) { // custom agents may rename themselves and change avatar
    if ('name' in patch) { patch.name = String(patch.name ?? '').trim().slice(0, 40); if (!patch.name) delete patch.name; }
    if ('avatar' in patch && !AVATARS.includes(patch.avatar)) delete patch.avatar;
  } else { delete patch.name; delete patch.avatar; }
  // Every agent, built-in or custom, may get its own call voice and a personality line ('' = back to the default).
  if ('voice' in patch && patch.voice !== '' && !VOICE_NAMES.includes(patch.voice)) delete patch.voice;
  if ('personality' in patch) patch.personality = String(patch.personality ?? '').trim().slice(0, 400);
  return patch;
}
