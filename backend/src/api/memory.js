// Memory: semantic recall + automatic fact extraction. After a chat turn, a small background pass pulls durable facts
// about the owner ("likes Genshin Impact") into the memories collection, merging with what is already known, and feeds
// the knowledge graph (graph.js) with the entities and relations it found, in the same model call.
// Scopes: 'shared' = every agent may read it (facts about the owner, their people, work and company);
// 'personal' = only the agent that wrote it (`mate`) sees it: its own working notes. Old 'private' docs count as shared.
import { userCol } from './db.js';
import { chat, extractJson } from './llm.js';
import { embed, embedReady, rank } from './vec.js';
import { now } from '../lib/env.js';
import { ingest } from './graph.js';

const KINDS = ['note', 'idea', 'decision', 'fact', 'journal', 'link'];
export const scopeOf = (m) => (m.scope === 'personal' ? 'personal' : 'shared');
/** Can this agent see this memory? access.memory = { personal: bool, shared: 'read'|'write'|'none' }. */
export const visible = (m, mate, access) => (scopeOf(m) === 'personal' ? !!mate && m.mate === mate && access?.memory?.personal !== false : (access?.memory?.shared ?? 'write') !== 'none');
const words = (s) => (String(s).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
const kw = (text, terms) => terms.reduce((a, t) => a + (text.toLowerCase().includes(t) ? 1 : 0), 0);

async function allMemories(uid) {
  return (await userCol(uid, 'memories').limit(500).get()).docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}

/** Make sure memories have vectors (lazy backfill, max 40 per call). Mutates the objects. */
async function ensureVectors(uid, mems, vm) {
  const todo = mems.filter((m) => !m.vec || m.vm !== vm).slice(0, 40);
  if (!todo.length) return;
  const e = await embed(todo.map((m) => m.text));
  if (!e) return;
  await Promise.all(todo.map(async (m, i) => { m.vec = e.vecs[i]; m.vm = e.vm; await m.ref.set({ vec: m.vec, vm: m.vm }, { merge: true }).catch(() => {}); }));
}

/** Most relevant memories for a query: pinned first, then by meaning (falls back to keywords). */
export async function recall(uid, query, { k = 6, pinned = 6, mate = '', access = null, scope = '' } = {}) {
  const mems = (await allMemories(uid)).filter((m) => (!mate && !access ? true : visible(m, mate, access)) && (!scope || scopeOf(m) === scope));
  const pins = mems.filter((m) => m.pinned).slice(0, pinned);
  const rest = mems.filter((m) => !m.pinned);
  let hits = [];
  const q = await (embedReady() && String(query).trim() ? embed([query], { query: true }) : null);
  if (q?.vecs[0]) {
    await ensureVectors(uid, rest, q.vm);
    hits = rank(q.vecs[0], q.vm, rest, k).filter((x) => x.sim > 0.35);
  }
  if (!hits.length) {
    const terms = words(query).slice(0, 12);
    hits = rest.map((m) => ({ ...m, sim: kw(m.text, terms) })).filter((x) => x.sim).sort((a, b) => b.sim - a.sim).slice(0, k);
  }
  return [...pins, ...hits].map((m) => ({ id: m.id, kind: m.kind, text: m.text, scope: scopeOf(m), mate: m.mate ?? '' }));
}

/** Counts for the prompt catalog: shared items and this agent's personal ones. */
export async function memoryCounts(uid, mate) {
  const mems = await allMemories(uid);
  return { shared: mems.filter((m) => scopeOf(m) === 'shared').length, personal: mems.filter((m) => scopeOf(m) === 'personal' && m.mate === mate).length, pinned: mems.filter((m) => m.pinned && scopeOf(m) === 'shared').length };
}

/** Add one memory unless an almost identical one exists. Returns { id, dup }. */
export async function addMemory(uid, { text, kind = 'fact', by = 'auto', scope = 'shared', mate = '' }) {
  text = String(text).trim().slice(0, 2000); if (!text) return null;
  scope = scope === 'personal' && mate ? 'personal' : 'shared';
  const e = embedReady() ? await embed([text]) : null;
  if (e?.vecs[0]) {
    const mems = (await allMemories(uid)).filter((m) => scopeOf(m) === scope && (scope === 'shared' || m.mate === mate));
    await ensureVectors(uid, mems, e.vm);
    const top = rank(e.vecs[0], e.vm, mems, 1)[0];
    if (top && top.sim > 0.92) return { id: top.id, dup: true };
  }
  const ref = userCol(uid, 'memories').doc(); const ts = now();
  await ref.set({ kind: KINDS.includes(kind) ? kind : 'fact', text, scope, ...(scope === 'personal' ? { mate } : {}), pinned: false, createdAt: ts, updatedAt: ts, by, ...(e?.vecs[0] ? { vec: e.vecs[0], vm: e.vm } : {}) });
  return { id: ref.id, dup: false };
}

const SYS = `You maintain a long-term memory about the OWNER of a personal AI workspace.
From the latest exchange, extract only durable facts worth remembering weeks from now: preferences and tastes ("likes Genshin Impact"), people and relationships, goals, projects, routines, constraints, decisions, important dates.
Rules:
- Write each fact as one short third-person sentence starting with "Owner" or "User" (e.g. "User likes the game Genshin Impact").
- Only things the OWNER said or clearly confirmed. Never facts that only the assistant said. Skip small talk, one-off questions, anything transient (today's weather, a single task).
- Never store passwords, keys, card or ID numbers, or health diagnoses or other sensitive personal data unless the owner explicitly asked to remember it.
- If a fact updates or contradicts an existing memory, return an update with that memory's id instead of a new one.
- scope "shared" for facts about the owner, their people, projects, company and preferences (every agent should know them); scope "personal" only for working notes that matter to THIS agent's own job (e.g. "Owner wants my reports under 200 words").
- Feedback on how this agent did its job ("too long", "less formal please", "always add the sources", "perfect, keep doing it like this") is a personal working note: write it as "Owner wants me to …" with scope "personal" and kind "note". This is the agent's journal of how to work for this owner.
- Also list the entities and relations behind the facts, for a knowledge graph: people, orgs, teams, projects, places, tools, preferences, goals, events. Relations are short snake_case verbs, e.g. likes, works_at, reports_to, lives_in, member_of, owns, uses, prefers, deadline_is, related_to. Use the owner as "Owner".
- If nothing is worth saving, return {"ops":[],"entities":[],"relations":[]}.
Reply with JSON only: {"ops":[{"op":"add","text":"...","kind":"fact|idea|decision|note","scope":"shared|personal"},{"op":"update","id":"existing id","text":"..."}],"entities":[{"name":"Genshin Impact","type":"thing","summary":"a game the owner plays"}],"relations":[{"from":"Owner","rel":"likes","to":"Genshin Impact"}]}`;

/** Fire-and-forget after a chat turn. Never throws. */
export async function learnFromTurn(uid, { user, assistant = '', mate = 'mimo', settings = {} }) {
  try {
    if (settings.autoMemory === false) return [];
    const u = String(user ?? '').trim();
    if (u.length < 12 || u.startsWith('/')) return [];
    const near = await recall(uid, u, { k: 8, pinned: 0, mate, access: { memory: { personal: true, shared: 'read' } } });
    const r = await chat(uid, {
      model: settings.fastModel || '', json: true, temperature: 0.1, maxTokens: 800, effort: 'low',
      messages: [{ role: 'system', content: SYS }, { role: 'user', content: `Existing memories:\n${near.map((m) => `${m.id}: ${m.text}`).join('\n') || '(none)'}\n\nOwner said: ${u.slice(0, 1500)}\n\nThe agent "${mate}" replied: ${String(assistant).slice(0, 600)}` }],
    });
    const j = extractJson(r.text) ?? {};
    const ops = (Array.isArray(j.ops) ? j.ops : []).slice(0, 4);
    const saved = []; const ids = [];
    for (const o of ops) {
      const text = String(o?.text ?? '').trim(); if (text.length < 6) continue;
      if (o.op === 'update' && o.id) {
        const ref = userCol(uid, 'memories').doc(String(o.id).slice(0, 60)); const cur = (await ref.get()).data();
        if (!cur) { const a = await addMemory(uid, { text, kind: o.kind, by: mate, scope: o.scope, mate }); if (a && !a.dup) { saved.push(text); ids.push(a.id); } continue; }
        if (cur.scope === 'personal' && cur.mate !== mate) continue; // never rewrite another agent's personal notes
        const e = embedReady() ? await embed([text]) : null;
        await ref.set({ text: text.slice(0, 2000), updatedAt: now(), ...(e?.vecs[0] ? { vec: e.vecs[0], vm: e.vm } : { vec: null, vm: null }) }, { merge: true }); saved.push(text);
      } else if (o.op === 'add') { const a = await addMemory(uid, { text, kind: o.kind, by: mate, scope: o.scope, mate }); if (a && !a.dup) { saved.push(text); ids.push(a.id); } }
    }
    if (settings.autoGraph !== false && (j.entities?.length || j.relations?.length)) await ingest(uid, { entities: Array.isArray(j.entities) ? j.entities : [], relations: Array.isArray(j.relations) ? j.relations : [], by: mate, memoryIds: ids });
    return saved;
  } catch (e) { console.error('learning failed', e.message); return []; }
}
