// Knowledge graph: what the agents learn about the owner and their world, as entities and relations.
// graph_nodes {name, type, aliases[], summary, vec?, vm?, mentions, by, createdAt, updatedAt}
// graph_edges {from, rel, to, memoryIds[], confidence, by, createdAt, updatedAt, endedAt?}
// Fed by learnFromTurn (every agent, every surface) and the graph_link tool. Cached per user for 60 s.
import { userCol } from './db.js';
import { embed, embedReady, rank } from './vec.js';
import { now } from '../lib/env.js';

export const NODE_TYPES = ['person', 'org', 'team', 'project', 'place', 'preference', 'tool', 'topic', 'event', 'goal', 'thing'];
/** One current value per subject: a new edge closes the old one (kept as history with endedAt). */
export const FUNCTIONAL = new Set(['lives_in', 'works_at', 'reports_to', 'role_is', 'married_to', 'located_in', 'manages_team', 'status_is', 'studies_at', 'birthday_is']);
const MAX_NODES = 3000, MAX_EDGES = 10000, TTL = 60_000;
const cache = new Map();
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const relOf = (s) => norm(s).replace(/\s+/g, '_').slice(0, 40) || 'related_to';
const clip = (s, n) => String(s ?? '').trim().slice(0, n);

async function load(uid) {
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < TTL) return hit;
  const [n, e] = await Promise.all([userCol(uid, 'graph_nodes').limit(MAX_NODES).get(), userCol(uid, 'graph_edges').limit(MAX_EDGES).get()]);
  const g = { at: Date.now(), nodes: new Map(n.docs.map((d) => [d.id, { id: d.id, ...d.data() }])), edges: e.docs.map((d) => ({ id: d.id, ...d.data() })) };
  cache.set(uid, g);
  return g;
}
export const invalidateGraph = (uid) => cache.delete(uid);

function findByName(g, name) {
  const k = norm(name); if (!k) return null;
  for (const n of g.nodes.values()) if (norm(n.name) === k || (n.aliases ?? []).some((a) => norm(a) === k)) return n;
  return null;
}

/** Find or create an entity. Matches the name or an alias, then (same type) meaning above 0.9. Returns the node. */
export async function upsertNode(uid, { name, type = 'thing', summary = '', aliases = [], by = '' }) {
  name = clip(name, 80); if (!name) return null;
  const g = await load(uid);
  type = NODE_TYPES.includes(type) ? type : 'thing';
  let node = findByName(g, name);
  if (!node && embedReady()) {
    const e = await embed([name]).catch(() => null);
    if (e?.vecs[0]) {
      const pool = [...g.nodes.values()].filter((n) => n.type === type && n.vec && n.vm === e.vm);
      const top = rank(e.vecs[0], e.vm, pool, 1)[0];
      if (top && top.sim > 0.9) node = g.nodes.get(top.id);
      if (!node) node = { _vec: e };
    }
  }
  const ts = now();
  const al = [...new Set([...(node?.aliases ?? []), ...aliases.map((a) => clip(a, 80)), ...(node?.name && norm(node.name) !== norm(name) ? [name] : [])].filter(Boolean))].slice(0, 12);
  if (node?.id) {
    const patch = { aliases: al, mentions: (node.mentions ?? 0) + 1, updatedAt: ts, ...(summary && summary.length > (node.summary ?? '').length * 0.6 ? { summary: clip(summary, 400) } : {}), ...(node.type === 'thing' && type !== 'thing' ? { type } : {}) };
    await userCol(uid, 'graph_nodes').doc(node.id).set(patch, { merge: true });
    Object.assign(node, patch);
    return node;
  }
  if (g.nodes.size >= MAX_NODES) return null;
  const ref = userCol(uid, 'graph_nodes').doc();
  const doc = { name, type, aliases: al, summary: clip(summary, 400), mentions: 1, by, createdAt: ts, updatedAt: ts, ...(node?._vec ? { vec: node._vec.vecs[0], vm: node._vec.vm } : {}) };
  await ref.set(doc);
  const out = { id: ref.id, ...doc }; g.nodes.set(ref.id, out);
  return out;
}

/** Add or confirm a relation. Functional relations replace the current value (the old edge gets endedAt). */
export async function link(uid, { from, rel, to, fromType, toType, by = '', memoryId = '', confidence = 0.8 }) {
  const a = await upsertNode(uid, { name: from, type: fromType, by }); const b = await upsertNode(uid, { name: to, type: toType, by });
  if (!a || !b || a.id === b.id) return null;
  const g = await load(uid); rel = relOf(rel); const ts = now(); const col = userCol(uid, 'graph_edges');
  const same = g.edges.find((e) => !e.endedAt && e.from === a.id && e.rel === rel && e.to === b.id);
  if (same) {
    const patch = { updatedAt: ts, confidence: Math.min(1, Math.max(same.confidence ?? 0.5, confidence) + 0.05), memoryIds: [...new Set([...(same.memoryIds ?? []), memoryId].filter(Boolean))].slice(-10) };
    await col.doc(same.id).set(patch, { merge: true }); Object.assign(same, patch); return same;
  }
  if (FUNCTIONAL.has(rel)) for (const e of g.edges.filter((x) => !x.endedAt && x.from === a.id && x.rel === rel)) { e.endedAt = ts; await col.doc(e.id).set({ endedAt: ts, updatedAt: ts }, { merge: true }); }
  if (g.edges.length >= MAX_EDGES) return null;
  const ref = col.doc(); const doc = { from: a.id, rel, to: b.id, memoryIds: memoryId ? [memoryId] : [], confidence, by, createdAt: ts, updatedAt: ts };
  await ref.set(doc); const out = { id: ref.id, ...doc }; g.edges.push(out);
  return out;
}

/** Store what learnFromTurn extracted. entities [{name,type,summary,aliases}], relations [{from,rel,to}]. Never throws. */
export async function ingest(uid, { entities = [], relations = [], by = '', memoryIds = [] }) {
  let n = 0;
  try {
    for (const e of entities.slice(0, 8)) if (await upsertNode(uid, { name: e?.name, type: e?.type, summary: e?.summary, aliases: Array.isArray(e?.aliases) ? e.aliases : [], by })) n++;
    const types = Object.fromEntries(entities.map((e) => [norm(e?.name), e?.type]));
    for (const r of relations.slice(0, 8)) if (r?.from && r?.to && await link(uid, { from: r.from, rel: r.rel, to: r.to, fromType: types[norm(r.from)], toType: types[norm(r.to)], by, memoryId: memoryIds[0] ?? '' })) n++;
  } catch (e) { console.error('graph ingest failed', e.message); }
  return n;
}

const label = (g, id) => g.nodes.get(id)?.name ?? '?';
const edgeLine = (g, e) => `${label(g, e.from)} —${e.rel}→ ${label(g, e.to)}${e.endedAt ? ` (until ${e.endedAt.slice(0, 10)})` : ''}`;

/** Entities matching a query: name/alias words first, then meaning. */
export async function searchGraph(uid, query, k = 8) {
  const g = await load(uid); const q = norm(query); const words = q.split(' ').filter((w) => w.length > 2);
  const scored = [...g.nodes.values()].map((n) => {
    const hay = norm([n.name, ...(n.aliases ?? []), n.summary].join(' '));
    return { n, s: (hay.includes(q) ? 3 : 0) + words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0) };
  }).filter((x) => x.s).sort((a, b) => b.s - a.s || (b.n.mentions ?? 0) - (a.n.mentions ?? 0)).slice(0, k).map((x) => x.n);
  if (scored.length < k && embedReady() && q) {
    const e = await embed([query], { query: true }).catch(() => null);
    if (e?.vecs[0]) for (const h of rank(e.vecs[0], e.vm, [...g.nodes.values()].filter((n) => n.vec && n.vm === e.vm), k)) if (h.sim > 0.4 && !scored.some((s) => s.id === h.id)) scored.push(g.nodes.get(h.id));
  }
  return scored.slice(0, k).map((n) => ({ id: n.id, name: n.name, type: n.type, summary: n.summary ?? '', degree: g.edges.filter((e) => !e.endedAt && (e.from === n.id || e.to === n.id)).length }));
}

/** An entity and what it connects to, up to 2 hops. History (ended edges) only with history=true. */
export async function neighbours(uid, name, { depth = 1, history = false, max = 40 } = {}) {
  const g = await load(uid); const start = findByName(g, name) ?? g.nodes.get((await searchGraph(uid, name, 1))[0]?.id);
  if (!start) return null;
  const seen = new Set([start.id]); let frontier = [start.id]; const lines = [];
  for (let d = 0; d < Math.min(2, Math.max(1, depth)); d++) {
    const next = [];
    for (const e of g.edges) {
      if (!history && e.endedAt) continue;
      const hit = frontier.includes(e.from) ? e.to : frontier.includes(e.to) ? e.from : null;
      if (!hit) continue;
      const line = edgeLine(g, e); if (!lines.includes(line)) lines.push(line);
      if (!seen.has(hit)) { seen.add(hit); next.push(hit); }
      if (lines.length >= max) break;
    }
    frontier = next;
  }
  return { node: { name: start.name, type: start.type, summary: start.summary ?? '', aliases: start.aliases ?? [] }, lines };
}

export async function graphStats(uid) { const g = await load(uid); return { nodes: g.nodes.size, edges: g.edges.filter((e) => !e.endedAt).length }; }

/** For the dashboard: nodes without vectors, active edges (history optional). */
export async function graphSnapshot(uid, { history = false } = {}) {
  const g = await load(uid);
  return {
    nodes: [...g.nodes.values()].map(({ vec, vm, ...n }) => n),
    edges: g.edges.filter((e) => history || !e.endedAt),
  };
}

export async function deleteNode(uid, id) {
  const g = await load(uid);
  await userCol(uid, 'graph_nodes').doc(id).delete();
  for (const e of g.edges.filter((x) => x.from === id || x.to === id)) await userCol(uid, 'graph_edges').doc(e.id).delete();
  invalidateGraph(uid);
}
/** Merge node `from` into `into`: edges move, the name becomes an alias. */
export async function mergeNodes(uid, from, into) {
  const g = await load(uid); const a = g.nodes.get(from), b = g.nodes.get(into);
  if (!a || !b || a.id === b.id) throw Object.assign(new Error('Pick two different entities'), { statusCode: 400 });
  for (const e of g.edges.filter((x) => x.from === from || x.to === from)) await userCol(uid, 'graph_edges').doc(e.id).set({ from: e.from === from ? into : e.from, to: e.to === from ? into : e.to, updatedAt: now() }, { merge: true });
  await userCol(uid, 'graph_nodes').doc(into).set({ aliases: [...new Set([...(b.aliases ?? []), a.name, ...(a.aliases ?? [])])].slice(0, 12), mentions: (b.mentions ?? 0) + (a.mentions ?? 0), updatedAt: now() }, { merge: true });
  await userCol(uid, 'graph_nodes').doc(from).delete();
  invalidateGraph(uid);
}
