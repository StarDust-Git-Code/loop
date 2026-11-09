'use client';
// Memory: what the agents know. Shared memory (every agent), each agent's personal notes, and the knowledge graph.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAgents } from '../../lib/agents';
import { useRepo } from '../../lib/hooks';
import { MATES, mateImg } from '../../lib/mates';
import type { GraphEdge, GraphNode, Memory as Mem, MateKey } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Btn, confirmThen, Empty, ErrorNote, Input, Loading, Page, Select, Tabs } from '../ui/ui';

type Tab = 'shared' | 'personal' | 'graph';
const scopeOf = (m: Mem) => (m.scope === 'personal' ? 'personal' : 'shared');
const TYPE_COLOR: Record<string, string> = { person: '#2F6BFF', org: '#7A5AF8', team: '#0E9384', project: '#DC6803', place: '#16B364', preference: '#DD2590', tool: '#475467', topic: '#0BA5EC', event: '#F04438', goal: '#B54708', thing: '#667085' };
const box = { background: '#fff', border: '1px solid rgba(15,23,42,.14)', borderRadius: 16 } as const;

export function Memory() {
  const [tab, setTab] = useState<Tab>('shared');
  return (
    <Page title="Memory" sub="What your agents have learned. Shared memory is used by every agent; personal notes belong to one agent; the graph links people, projects and preferences."
      actions={<Tabs value={tab} onChange={setTab} options={[{ id: 'shared', label: 'Shared' }, { id: 'personal', label: 'Personal notes' }, { id: 'graph', label: 'Graph' }]} />}>
      {tab === 'graph' ? <Graph /> : <List scope={tab} />}
    </Page>
  );
}

function List({ scope }: { scope: 'shared' | 'personal' }) {
  const { items, loading, error, update, remove } = useRepo(api.memories);
  const { defs } = useAgents(); const toast = useToast();
  const [q, setQ] = useState(''); const [who, setWho] = useState<MateKey | ''>('');
  const rows = items.filter((m) => scopeOf(m) === scope && (!who || m.mate === who) && (!q || m.text.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const owners = [...new Set(items.filter((m) => scopeOf(m) === 'personal').map((m) => m.mate).filter(Boolean))] as MateKey[];
  return (
    <>
      <ErrorNote message={error} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memories" aria-label="Search memories" style={{ flex: 1, minWidth: 200 }} />
        {scope === 'personal' && <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Agent" style={{ width: 200 }}><option value="">All agents</option>{defs.filter((d) => owners.includes(d.key)).map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}</Select>}
      </div>
      {loading ? <Loading /> : !rows.length ? <Empty title={scope === 'shared' ? 'Nothing shared yet' : 'No personal notes yet'} text={scope === 'shared' ? 'Agents learn facts from your chats and calls automatically. You can also say "remember…" to any agent.' : 'Agents keep notes here that only matter to their own job.'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((m) => (
            <div key={m.id} style={{ ...box, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
              {m.mate && <img src={mateImg(m.mate)} alt="" width={28} height={28} title={MATES[m.mate].name} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{m.text}</div>
                <div style={{ color: '#5B6474', fontSize: 12 }}>{m.kind}{m.pinned ? ' · pinned' : ''}{m.by ? ` · learned by ${MATES[m.by]?.name ?? m.by}` : ''}{scope === 'personal' && m.mate ? ` · ${MATES[m.mate].name} only` : ''}</div>
              </div>
              {scope === 'shared' && <Btn small onClick={() => update(m.id, { pinned: !m.pinned }).catch((e: Error) => toast(e.message, 'bad'))}>{m.pinned ? 'Unpin' : 'Pin'}</Btn>}
              {scope === 'personal' && <Btn small onClick={() => update(m.id, { scope: 'shared' }).then(() => toast('Shared with every agent')).catch((e: Error) => toast(e.message, 'bad'))}>Share</Btn>}
              <Btn small onClick={() => confirmThen('Forget this memory?', () => { remove(m.id).catch((e: Error) => toast(e.message, 'bad')); })}>Forget</Btn>
            </div>))}
        </div>)}
    </>
  );
}

/* ---------- graph: a small force layout, computed once per data change ---------- */
type P = { id: string; x: number; y: number };
function layout(nodes: GraphNode[], edges: GraphEdge[], W: number, H: number): Map<string, P> {
  const pos = new Map<string, P>(nodes.map((n, i) => { const a = (i / Math.max(1, nodes.length)) * Math.PI * 2; const r = Math.min(W, H) * 0.38; return [n.id, { id: n.id, x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r }]; }));
  const list = [...pos.values()]; const k = Math.sqrt((W * H) / Math.max(1, list.length)) * 0.75;
  for (let it = 0; it < 220; it++) {
    const t = 1 - it / 220; const d = new Map(list.map((p) => [p.id, { x: 0, y: 0 }]));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j]; let dx = a.x - b.x, dy = a.y - b.y; const dist = Math.max(0.01, Math.hypot(dx, dy)); const f = (k * k) / dist / dist;
      dx *= f; dy *= f; d.get(a.id)!.x += dx; d.get(a.id)!.y += dy; d.get(b.id)!.x -= dx; d.get(b.id)!.y -= dy;
    }
    for (const e of edges) {
      const a = pos.get(e.from), b = pos.get(e.to); if (!a || !b) continue;
      const dx = a.x - b.x, dy = a.y - b.y; const dist = Math.max(0.01, Math.hypot(dx, dy)); const f = dist / k;
      d.get(a.id)!.x -= dx * f * 0.5; d.get(a.id)!.y -= dy * f * 0.5; d.get(b.id)!.x += dx * f * 0.5; d.get(b.id)!.y += dy * f * 0.5;
    }
    for (const p of list) { const v = d.get(p.id)!; const len = Math.max(0.01, Math.hypot(v.x, v.y)); const step = Math.min(len, 12 * t + 0.5); p.x = Math.min(W - 30, Math.max(30, p.x + (v.x / len) * step)); p.y = Math.min(H - 20, Math.max(20, p.y + (v.y / len) * step)); }
  }
  return pos;
}

function Graph() {
  const toast = useToast();
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [err, setErr] = useState<string | null>(null); const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState(''); const [into, setInto] = useState(''); const [tick, setTick] = useState(0);
  useEffect(() => { let live = true; api.graph.get(true).then((d) => { if (live) { setData(d); setErr(null); } }).catch((e: Error) => { if (live) setErr(e.message); }); return () => { live = false; }; }, [tick]);
  const W = 900, H = 560;
  const shown = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    const active = data.edges.filter((e) => !e.endedAt);
    const deg = new Map<string, number>(); for (const e of active) { deg.set(e.from, (deg.get(e.from) ?? 0) + 1); deg.set(e.to, (deg.get(e.to) ?? 0) + 1); }
    const nodes = [...data.nodes].sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0) || (b.mentions ?? 0) - (a.mentions ?? 0)).slice(0, 120);
    const ids = new Set(nodes.map((n) => n.id));
    return { nodes, edges: active.filter((e) => ids.has(e.from) && ids.has(e.to)) };
  }, [data]);
  const pos = useMemo(() => layout(shown.nodes, shown.edges, W, H), [shown]);
  if (err) return <ErrorNote message={err} />;
  if (!data) return <Loading />;
  if (!data.nodes.length) return <Empty title="The graph is empty" text="As you chat, call and run jobs, your agents add the people, projects, places and preferences they learn about, and how they connect." />;
  const node = (id: string) => data.nodes.find((n) => n.id === id);
  const s = sel ? node(sel) : null;
  const rel = s ? data.edges.filter((e) => e.from === s.id || e.to === s.id) : [];
  const match = q ? new Set(data.nodes.filter((n) => [n.name, ...(n.aliases ?? [])].some((x) => x.toLowerCase().includes(q.toLowerCase()))).map((n) => n.id)) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(240px,320px)', gap: 14 }} className="lm-graph">
      <style>{'@media (max-width: 860px){.lm-graph{grid-template-columns:1fr !important}}'}</style>
      <div style={{ ...box, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, padding: 10, borderBottom: '1px solid rgba(15,23,42,.08)', alignItems: 'center' }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an entity" aria-label="Find an entity" style={{ flex: 1 }} />
          <span style={{ color: '#5B6474', fontSize: 12.5, whiteSpace: 'nowrap' }}>{data.nodes.length} entities · {data.edges.filter((e) => !e.endedAt).length} links</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Knowledge graph" style={{ width: '100%', height: 'auto', display: 'block', background: 'linear-gradient(180deg,#FBFCFF,#F5F8FF)' }}>
          {shown.edges.map((e) => { const a = pos.get(e.from)!, b = pos.get(e.to)!; const on = sel && (e.from === sel || e.to === sel); return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? '#2F6BFF' : 'rgba(15,23,42,.16)'} strokeWidth={on ? 2 : 1} />; })}
          {shown.nodes.map((n) => { const p = pos.get(n.id)!; const dim = match && !match.has(n.id); const c = TYPE_COLOR[n.type] ?? TYPE_COLOR.thing; return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} onClick={() => setSel(n.id)} style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1 }} role="button" aria-label={`${n.name}, ${n.type}`} tabIndex={0} onKeyDown={(ev) => { if (ev.key === 'Enter') setSel(n.id); }}>
              <circle r={sel === n.id ? 9 : 6} fill={c} stroke="#fff" strokeWidth={2} />
              <text y={-11} textAnchor="middle" fontSize={11.5} fill="#0F172A" style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}>{n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}</text>
            </g>); })}
        </svg>
      </div>
      <aside style={{ ...box, padding: 14, alignSelf: 'start' }}>
        {!s ? <p style={{ margin: 0, color: '#5B6474', fontSize: 13 }}>Pick an entity to see what your agents know about it.</p> : <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: TYPE_COLOR[s.type] ?? TYPE_COLOR.thing }} /><b style={{ fontSize: 16 }}>{s.name}</b><span style={{ color: '#5B6474', fontSize: 12 }}>{s.type}</span></div>
          {s.summary && <p style={{ margin: '6px 0 0', fontSize: 13 }}>{s.summary}</p>}
          {!!s.aliases?.length && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#5B6474' }}>Also called {s.aliases.join(', ')}</p>}
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            {rel.length ? rel.map((e) => <li key={e.id} style={{ color: e.endedAt ? '#98A2B3' : '#0F172A' }}>{node(e.from)?.name} <b style={{ color: e.endedAt ? '#98A2B3' : '#1F55E6' }}>{e.rel.replace(/_/g, ' ')}</b> {node(e.to)?.name}{e.endedAt ? ` (until ${e.endedAt.slice(0, 10)})` : ''}</li>) : <li style={{ color: '#5B6474' }}>No links yet.</li>}
          </ul>
          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            <Select value={into} onChange={(e) => setInto(e.target.value)} aria-label="Merge into" style={{ flex: 1, minWidth: 140 }}><option value="">Same as…</option>{data.nodes.filter((n) => n.id !== s.id).sort((a, b) => a.name.localeCompare(b.name)).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</Select>
            <Btn small disabled={!into} onClick={() => api.graph.merge(s.id, into).then(() => { toast('Merged'); setSel(into); setInto(''); setTick((t) => t + 1); }).catch((e: Error) => toast(e.message, 'bad'))}>Merge</Btn>
            <Btn small onClick={() => confirmThen(`Forget ${s.name} and its links?`, () => { api.graph.removeNode(s.id).then(() => { setSel(null); setTick((t) => t + 1); }).catch((e: Error) => toast(e.message, 'bad')); })}>Forget</Btn>
          </div>
        </>}
      </aside>
    </div>
  );
}
