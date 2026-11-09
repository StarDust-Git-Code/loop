// What an agent may reach, and the tools to reach it. The system prompt only LISTS what is available (names and one
// line each: skills, MCP servers, memory and graph counts); details are loaded on demand with these tools. Access is
// enforced here, on the server, not by the prompt.
//
// access (on the agent's config) = {
//   memory: { personal: true|false, shared: 'read'|'write'|'none' },
//   graph: 'read'|'write'|'none', skills: 'all'|'none'|[skillIds], mcp: 'all'|'none'|[serverIds], knowledge: true|false }
import { userCol } from './db.js';
import { addMemory, recall, memoryCounts } from './memory.js';
import { searchGraph, neighbours, link, graphStats } from './graph.js';
import { listMcpTools, callMcp } from './mcp.js';

export const DEFAULT_ACCESS = Object.freeze({ memory: { personal: true, shared: 'write' }, graph: 'write', skills: 'all', mcp: 'all', knowledge: true });
const LEVEL = ['none', 'read', 'write'];
const ids = (v, dflt) => (v === 'all' || v === 'none' ? v : Array.isArray(v) ? v.map(String).slice(0, 100) : dflt);

/** A complete, validated access object from whatever is stored. */
export function accessOf(cfg = {}) {
  const a = cfg.access ?? {};
  return {
    memory: { personal: a.memory?.personal !== false, shared: LEVEL.includes(a.memory?.shared) ? a.memory.shared : DEFAULT_ACCESS.memory.shared },
    graph: LEVEL.includes(a.graph) ? a.graph : DEFAULT_ACCESS.graph,
    skills: ids(a.skills, 'all'), mcp: ids(a.mcp, 'all'), knowledge: a.knowledge !== false,
  };
}
const allowed = (list, id) => list === 'all' || (Array.isArray(list) && list.includes(id));
const bad = (m) => Object.assign(new Error(m), { tool: true });
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const access = (c) => c.access ?? accessOf();

/** The skills and MCP servers this agent may use (enabled, assigned to it, and inside its access). */
export async function reachable(uid, mateKey, acc) {
  const [sk, mc] = await Promise.all([
    acc.skills === 'none' ? [] : userCol(uid, 'skills').limit(100).get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
    acc.mcp === 'none' ? [] : userCol(uid, 'mcp').limit(50).get().then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
  ]);
  return {
    skills: sk.filter((s) => s.enabled && (!s.mates?.length || s.mates.includes(mateKey)) && allowed(acc.skills, s.id)),
    mcp: mc.filter((s) => s.enabled !== false && allowed(acc.mcp, s.id)),
  };
}
const findByName = (list, name) => { const n = str(name, 120).toLowerCase(); return list.find((x) => x.id === name || String(x.name ?? '').toLowerCase() === n) ?? list.find((x) => String(x.name ?? '').toLowerCase().includes(n)); };

/** The "# What you can reach" catalog for the prompt. Names and one line each; nothing is loaded in full. */
export async function catalog(uid, mateKey, acc, { tools = [] } = {}) {
  const r = await reachable(uid, mateKey, acc);
  const [mem, g] = await Promise.all([memoryCounts(uid, mateKey).catch(() => ({ shared: 0, personal: 0 })), acc.graph === 'none' ? null : graphStats(uid).catch(() => null)]);
  const has = (t) => tools.includes(t);
  const out = [];
  if (r.skills.length && has('skill_load')) out.push(`**Skills** (load one with \`skill_load\` before you follow it):\n${r.skills.slice(0, 40).map((s) => `- ${s.name}: ${str(s.description, 120) || 'no description'}`).join('\n')}`);
  if (r.mcp.length && has('mcp_call')) out.push(`**MCP servers** (see a server's tools with \`mcp_tools\`, then use \`mcp_call\`):\n${r.mcp.slice(0, 20).map((s) => `- ${s.name}: ${str(s.description, 120) || 'no description'}${s.tools?.length ? ` (${s.tools.length} tools)` : ''}`).join('\n')}`);
  const m = [];
  if (acc.memory.shared !== 'none' && has('memory_recall')) m.push(`shared memory: ${mem.shared} items (${acc.memory.shared === 'write' ? 'read and write' : 'read only'})`);
  if (acc.memory.personal && has('memory_recall')) m.push(`your personal notes: ${mem.personal} items (only you see them)`);
  if (g && has('graph_search')) m.push(`knowledge graph: ${g.nodes} entities, ${g.edges} relations (${acc.graph === 'write' ? 'read and write' : 'read only'}; \`graph_search\`, \`graph_query\`)`);
  if (acc.knowledge && has('knowledge_search')) m.push('Knowledge library: `knowledge_search`');
  if (m.length) out.push(`**Memory**: ${m.join('; ')}. Look things up with the tools when the answer depends on the owner's facts; do not guess.`);
  return out.join('\n\n');
}

/** Remove tools this agent's access does not allow. */
export function filterByAccess(tools, acc, { mcpCount = 1, skillCount = 1 } = {}) {
  return tools.filter((t) => {
    if (['memory_recall', 'memory_save'].includes(t.name) && !acc.memory.personal && acc.memory.shared === 'none') return false;
    if (t.name.startsWith('graph_') && acc.graph === 'none') return false;
    if (t.name === 'graph_link' && acc.graph !== 'write') return false;
    if (t.name.startsWith('mcp_') && (acc.mcp === 'none' || !mcpCount)) return false;
    if (t.name === 'skill_load' && (acc.skills === 'none' || !skillCount)) return false;
    if (t.name === 'knowledge_search' && !acc.knowledge) return false;
    return true;
  });
}

/* ---------- tools ---------- */
const T = (group, desc, args, run, more = {}) => ({ group, desc, args, run, ...more });
export const REACH_TOOLS = {
  memory_save: T('Memory', 'Save something worth remembering. scope "shared" (default) = every agent can use it: facts about the owner, their people, work, company. scope "personal" = only you will see it: notes for your own job.', '{"text": "one tidy sentence", "kind?": "note|idea|decision|fact|journal|link", "scope?": "shared|personal"}', async (c, a) => {
    const acc = access(c); const text = str(a.text, 2000); if (!text) throw bad('text is required');
    let scope = a.scope === 'personal' ? 'personal' : 'shared';
    if (scope === 'shared' && acc.memory.shared !== 'write') { if (!acc.memory.personal) throw bad('You may not save memories.'); scope = 'personal'; }
    if (scope === 'personal' && !acc.memory.personal) throw bad('Personal notes are switched off for you. Use scope "shared".');
    const r = await addMemory(c.uid, { text, kind: a.kind, by: c.mate ?? '', scope, mate: c.mate ?? '' });
    return r?.dup ? `Already remembered (memory ${r.id}).` : `Saved ${scope} memory ${r?.id}.`;
  }, { write: true }),
  memory_recall: T('Memory', 'Look up saved memories by meaning (shared memories plus your own personal notes).', '{"query": "what to look up", "scope?": "shared|personal (default both)"}', async (c, a) => {
    const hits = await recall(c.uid, str(a.query, 300), { k: 8, pinned: 0, mate: c.mate ?? '', access: access(c), scope: ['shared', 'personal'].includes(a.scope) ? a.scope : '' });
    return hits.length ? hits.map((h) => `- (${h.kind}${h.scope === 'personal' ? ', personal' : ''}) ${h.text}`).join('\n') : 'No matching memories.';
  }),
  graph_search: T('Memory', 'Find entities in the knowledge graph (people, orgs, teams, projects, places, tools, preferences) by name or meaning.', '{"query": "name or topic"}', async (c, a) => {
    const hits = await searchGraph(c.uid, str(a.query, 200), 10);
    return hits.length ? hits.map((h) => `- ${h.name} [${h.type}]${h.summary ? `: ${h.summary}` : ''} (${h.degree} links)`).join('\n') : 'Nothing in the graph matches.';
  }),
  graph_query: T('Memory', 'Everything the graph knows around one entity: its relations, 1 or 2 hops out. Use "Owner" for the owner.', '{"entity": "name", "depth?": "1 or 2", "history?": "true to include past values"}', async (c, a) => {
    const r = await neighbours(c.uid, str(a.entity, 120), { depth: Number(a.depth) === 2 ? 2 : 1, history: a.history === true || a.history === 'true' });
    if (!r) return 'That entity is not in the graph yet.';
    return `${r.node.name} [${r.node.type}]${r.node.summary ? `: ${r.node.summary}` : ''}${r.node.aliases.length ? `\nAlso called: ${r.node.aliases.join(', ')}` : ''}\n${r.lines.map((l) => `- ${l}`).join('\n') || '(no relations yet)'}`;
  }),
  graph_link: T('Memory', 'Record a relation in the knowledge graph, e.g. {"from":"Priya","rel":"reports_to","to":"Arun"}. One-value relations (lives_in, works_at, reports_to, role_is, status_is...) replace the old value. Only for facts the owner stated or confirmed.', '{"from": "entity", "rel": "snake_case verb", "to": "entity", "fromType?": "person|org|team|project|place|preference|tool|topic|event|goal|thing", "toType?": "same list"}', async (c, a) => {
    if (access(c).graph !== 'write') throw bad('You may only read the graph.');
    const e = await link(c.uid, { from: str(a.from, 80), rel: str(a.rel, 40), to: str(a.to, 80), fromType: a.fromType, toType: a.toType, by: c.mate ?? '' });
    return e ? `Linked: ${a.from} —${e.rel}→ ${a.to}.` : 'Could not link those (empty names, the same entity twice, or the graph is full).';
  }, { write: true }),
  skill_load: T('*', 'Load the full instructions of one of your skills (listed under "What you can reach") before following it.', '{"name": "skill name"}', async (c, a) => {
    const { skills } = await reachable(c.uid, c.mate ?? '', access(c));
    const s = findByName(skills, a.name); if (!s) throw bad(`No skill called "${str(a.name, 60)}" is available to you.`);
    return `# Skill: ${s.name}\n${s.description ? `${s.description}\n\n` : ''}${String(s.instructions ?? '').slice(0, 8000)}`;
  }),
  mcp_tools: T('*', 'List the tools of one MCP server you may use, with their arguments.', '{"server": "server name"}', async (c, a) => {
    const { mcp } = await reachable(c.uid, c.mate ?? '', access(c));
    const s = findByName(mcp, a.server); if (!s) throw bad(`No MCP server called "${str(a.server, 60)}" is available to you.`);
    const tools = await listMcpTools(c.uid, s.id, s).catch((e) => { throw bad(`Could not reach ${s.name}: ${e.message}`); });
    return tools.length ? tools.slice(0, 60).map((t) => `- ${t.name}${t.readOnly ? ' (read-only)' : ''}: ${t.description || ''}\n  args: ${JSON.stringify(t.inputSchema?.properties ?? {}).slice(0, 400)}`).join('\n') : `${s.name} offers no tools.`;
  }),
  mcp_call: T('*', 'Call a tool on an MCP server you may use. Check its arguments with mcp_tools first. Tools that change things count as risky actions: only when the owner asked.', '{"server": "server name", "tool": "tool name", "args?": {}}', async (c, a) => {
    const { mcp } = await reachable(c.uid, c.mate ?? '', access(c));
    const s = findByName(mcp, a.server); if (!s) throw bad(`No MCP server called "${str(a.server, 60)}" is available to you.`);
    const tools = await listMcpTools(c.uid, s.id, s).catch((e) => { throw bad(`Could not reach ${s.name}: ${e.message}`); });
    const t = tools.find((x) => x.name === a.tool); if (!t) throw bad(`${s.name} has no tool "${str(a.tool, 60)}". Use mcp_tools to see the list.`);
    if (!t.readOnly && c.readOnly) throw bad('You are in read-only mode here, and that tool may change things.');
    let args = a.args; if (typeof args === 'string') { try { args = JSON.parse(args); } catch { throw bad('args must be a JSON object'); } }
    return (await callMcp(c.uid, s.id, s, t.name, args ?? {}).catch((e) => { throw bad(`${s.name}/${t.name} failed: ${e.message}`); })).slice(0, 12_000);
  }, { write: true, props: { args: { type: 'object', description: 'Arguments for the MCP tool' } } }),
};
