'use client';
import { useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { ago, bytes } from '../../lib/format';
import { useRepo, useSettings } from '../../lib/hooks';
import { mateImg } from '../../lib/mates';
import type { Knowledge as K, KnowledgeIn, SettingsData } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Btn, confirmThen, Empty, ErrorNote, Field, Input, Loading, Modal, Page, Tabs, Textarea, Toggle } from '../ui/ui';
import { Icon } from '../ui/Icon';

type View = 'graph' | 'sources' | 'memory' | 'retrieval';
const card = { background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, boxShadow: '0 2px 6px rgba(31,26,23,.05)' } as const;
const cap = { fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: '#3D3946', margin: '0 0 12px' } as const;
const BADGE = { file: ['FILE', '#FDE8E8', '#B3261E'], url: ['WEB', '#E6EEFF', '#2B4BC0'], note: ['MD', '#FFF3D6', '#8A5A00'] } as const;
const COL = { file: '#9D8CFF', url: '#6A4DF4', note: '#E3DEF3' } as const;
const STEPS = ['Ingest', 'Chunk', 'Embed', 'Index', 'Retrieve', 'Rerank', 'Cite'];

export function Knowledge() {
  const { items, loading, error, create, remove } = useRepo(api.knowledge);
  const mem = useRepo(api.memories);
  const { settings, update } = useSettings();
  const toast = useToast();
  const [view, setView] = useState<View>('graph');
  const [add, setAdd] = useState<'url' | 'note' | null>(null);
  const [form, setForm] = useState({ name: '', url: '', text: '' });
  const [q, setQ] = useState(''); const [g, setG] = useState(''); const [zoom, setZoom] = useState(1); const [sel, setSel] = useState<string | null>(null);
  const [hits, setHits] = useState<{ id: string; name: string; snippet: string }[] | null>(null); const [serr, setSerr] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const d: KnowledgeIn = add === 'url' ? { kind: 'url', name: form.name || form.url, url: form.url, status: 'pending' } : { kind: 'note', name: form.name, text: form.text, status: 'pending' };
    await create(d); setAdd(null); setForm({ name: '', url: '', text: '' }); toast('Added to Knowledge');
  };
  const test = async () => { try { setHits(await api.search.knowledge(q)); setSerr(null); } catch (e) { setSerr(e instanceof Error ? e.message : 'Search failed'); } };
  const set = <T extends keyof SettingsData>(k: T, v: SettingsData[T]) => void update({ [k]: v } as Partial<SettingsData>);

  const nodes = useMemo(() => items.map((k, i) => { const a = (i / Math.max(1, items.length)) * Math.PI * 2 - Math.PI / 2; const r = 150 + (i % 2) * 40; return { k, x: 300 + Math.cos(a) * r, y: 260 + Math.sin(a) * r }; }), [items]);

  const Sources = (
    <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <p style={cap}>SOURCES</p>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {loading ? <Loading /> : items.length === 0 ? <p style={{ color: '#6B6572', fontSize: 13.5, lineHeight: 1.55 }}>Nothing yet. Add a file, a web page or a note, and your Mates can search and cite it.</p> : items.map((k, i) => {
          const b = BADGE[k.kind];
          return (
            <div key={k.id} onClick={() => { setSel(k.id); setView('graph'); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(31,26,23,.08)', cursor: 'pointer', animation: `lm-up .3s ${Math.min(i, 8) * 30}ms ease both` }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: b[1], color: b[2], fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flex: 'none' }}>{b[0]}</span>
              <div style={{ minWidth: 0, flex: 1 }}><b style={{ fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</b><span style={{ fontSize: 12.5, color: k.status === 'indexed' ? '#1E7A46' : k.status === 'error' ? '#B3261E' : '#6B6572' }}>{k.status === 'pending' ? 'Not indexed yet' : k.status === 'indexed' ? 'Indexed' : 'Error'}</span></div>
              <button aria-label={`Remove ${k.name}`} onClick={(e) => { e.stopPropagation(); confirmThen(`Remove “${k.name}”?`, () => remove(k.id)); }} style={{ border: 0, background: 'none', color: '#6B6572', cursor: 'pointer', fontSize: 16 }}><Icon name="close" size={16} /></button>
            </div>);
        })}
      </div>
      <div style={{ background: '#F4F0FF', border: '1px solid rgba(106,77,244,.2)', borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.5, color: '#3D3946', marginTop: 14 }}>WhatsApp and Telegram sources only include chats you pick on the Connections page.</div>
    </div>);

  const Graph = (
    <div style={{ ...card, position: 'relative', overflow: 'hidden', minHeight: 420, background: '#FCFBFE radial-gradient(circle,#DDD8EA 1px,transparent 1px) 0 0/22px 22px' }}>
      <input value={g} onChange={(e) => setG(e.target.value)} placeholder="Search the graph" aria-label="Search the graph" style={{ position: 'absolute', top: 20, left: 20, width: 260, height: 42, border: '1px solid rgba(27,24,34,.17)', borderRadius: 10, padding: '0 14px', font: 'inherit', fontSize: 14, zIndex: 2 }} />
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 8, zIndex: 2 }}>{(['+', '−'] as const).map((s) => <button key={s} aria-label={s === '+' ? 'Zoom in' : 'Zoom out'} onClick={() => setZoom((z) => Math.min(2, Math.max(0.5, +(z + (s === '+' ? 0.15 : -0.15)).toFixed(2))))} style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid rgba(27,24,34,.17)', background: '#fff', fontSize: 18, cursor: 'pointer' }}>{s}</button>)}</div>
      {items.length === 0 ? <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><img src={mateImg('recall')} alt="" width={72} style={{ display: 'block', margin: '0 auto 6px', animation: 'lm-bob 3.6s ease-in-out infinite' }} /><p style={{ color: '#6B6572', maxWidth: 320 }}>Your graph grows as you add sources. Each one becomes a node linked to the Mate that reads it.</p></div></div> : (
        <svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
          <g style={{ transform: `scale(${zoom})`, transformOrigin: '300px 260px', transition: 'transform .3s' }}>
            {nodes.map((n) => <line key={n.k.id} x1={300} y1={260} x2={n.x} y2={n.y} stroke="#C9BDFB" strokeWidth="1.5" strokeDasharray={n.k.status === 'indexed' ? '' : '5 4'} pathLength={1} style={{ animation: 'lm-draw .8s ease both' }} />)}
            {nodes.map((n) => { const dim = g && !n.k.name.toLowerCase().includes(g.toLowerCase()); const on = sel === n.k.id; return (
              <g key={n.k.id} onClick={() => setSel(on ? null : n.k.id)} style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1, transition: 'opacity .2s' }}>
                <circle cx={n.x} cy={n.y} r={on ? 20 : 15} fill={COL[n.k.kind]} stroke={on ? '#1B1822' : '#fff'} strokeWidth="2.5" style={{ transition: 'r .2s' }} />
                <text x={n.x} y={n.y + 32} textAnchor="middle" fontSize="11" fill="#3D3946">{n.k.name.length > 22 ? `${n.k.name.slice(0, 21)}…` : n.k.name}</text>
              </g>); })}
            <image href={mateImg('research')} x={272} y={232} width={56} height={56} />
          </g>
        </svg>)}
      <div style={{ position: 'absolute', left: 20, bottom: 20, background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 12, padding: '10px 16px', display: 'flex', gap: 16, fontSize: 13, zIndex: 2 }}>{([['Web', COL.url], ['File', COL.file], ['Note', COL.note]] as const).map(([l, c]) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />{l}</span>)}</div>
      {sel && (() => { const k = items.find((x) => x.id === sel) as K | undefined; return k ? <div style={{ position: 'absolute', right: 20, bottom: 20, width: 260, background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 14, padding: 14, zIndex: 2, animation: 'lm-pop .3s both' }}><b>{k.name}</b><div style={{ color: '#6B6572', fontSize: 12.5, margin: '4px 0 8px' }}>{k.kind}{k.size ? ` · ${bytes(k.size)}` : ''} · added {ago(k.createdAt)}</div>{k.url && k.kind === 'url' && <a href={k.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, wordBreak: 'break-all' }}>{k.url}</a>}{k.text && <p style={{ fontSize: 13, margin: '6px 0 0', color: '#3D3946' }}>{k.text.slice(0, 140)}</p>}</div> : null; })()}
    </div>);

  const Rag = !settings ? <Loading /> : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflow: 'auto' }}>
      <div style={{ ...card, padding: 20 }}>
        <p style={cap}>HOW AGENTS FIND THINGS (RAG)</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{STEPS.map((s) => <span key={s} style={{ background: '#ECE7FF', color: '#4F34D6', borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 500 }}>{s}</span>)}</div>
        {([['Chunk size', 'chunkSize', 'tokens'], ['Overlap', 'overlap', 'tokens'], ['Top results', 'topK', '']] as const).map(([l, k, u]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(31,26,23,.08)', fontSize: 14.5 }}>
            <span style={{ flex: 1 }}>{l}</span><input type="number" min={1} value={settings[k]} onChange={(e) => set(k, Math.max(1, +e.target.value || 1))} aria-label={l} style={{ width: 80, textAlign: 'right', border: '1px solid rgba(27,24,34,.17)', borderRadius: 8, padding: '5px 8px', font: 'inherit', fontSize: 13 }} /><span style={{ width: 52, paddingLeft: 6, color: '#6B6572', fontSize: 12.5 }}>{u}</span>
          </label>))}
        {([['Hybrid search (keyword + meaning)', 'hybrid'], ['Rerank results', 'rerank'], ['Always cite sources', 'citeAlways']] as const).map(([l, k]) => <div key={k} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(31,26,23,.08)', fontSize: 14.5 }}><span style={{ flex: 1 }}>{l}</span><Toggle label={l} checked={settings[k]} onChange={(v) => set(k, v)} /></div>)}
      </div>
      <div style={{ ...card, padding: 20 }}>
        <p style={cap}>MEMORY SCOPE</p>
        <Tabs value={settings.memoryScope} onChange={(v) => set('memoryScope', v)} options={[{ id: 'private', label: 'Private' }, { id: 'shared', label: 'Shared' }, { id: 'project', label: 'Project' }]} />
        <p style={{ color: '#6B6572', fontSize: 13.5, lineHeight: 1.55, margin: '12px 0 0' }}>{{ private: 'Each Mate keeps its own notes. Nothing is visible to the others.', shared: 'Each Mate keeps its own notes, and anything marked shared becomes visible to every Mate in this workspace.', project: 'Memory is shared only between Mates working in the same project.' }[settings.memoryScope]}</p>
      </div>
      <div style={{ ...card, padding: 20, background: '#F4F0FF', borderColor: 'rgba(106,77,244,.25)' }}>
        <p style={{ ...cap, color: '#4F34D6' }}>TEST A QUERY</p>
        <form onSubmit={(e) => { e.preventDefault(); void test(); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask your knowledge anything" aria-label="Test query" style={{ width: '100%', height: 44, border: '1px solid rgba(27,24,34,.17)', borderRadius: 10, padding: '0 14px', font: 'inherit', fontSize: 14.5 }} /></form>
        <p style={{ color: '#3D3946', fontSize: 13.5, lineHeight: 1.5, margin: '10px 0' }}>Top passages come back ranked, each with its source so the agent can cite it.</p>
        {serr && <p style={{ color: '#B3261E', fontSize: 13 }}>{serr}</p>}
        {hits && (hits.length === 0 ? <p style={{ color: '#6B6572', fontSize: 13 }}>{api.capabilities.backend ? 'No matches.' : 'Needs the backend to index and search.'}</p> : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{hits.map((h, i) => <span key={h.id} className="mono" style={{ background: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12 }} title={h.snippet}>{h.name} · #{i + 1}</span>)}</div>)}
      </div>
    </div>);

  const Memory = (
    <div style={{ ...card, padding: 22, minHeight: 0, overflow: 'auto' }}>
      <p style={cap}>MEMORY</p>
      {mem.items.length === 0 ? <p style={{ color: '#6B6572' }}>Nothing remembered yet. Save notes, ideas and decisions in My Space and they show up here.</p> : mem.items.map((m) => <div key={m.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(31,26,23,.08)' }}><span style={{ background: '#ECE7FF', color: '#4F34D6', borderRadius: 6, padding: '2px 8px', fontSize: 12, height: 22 }}>{m.kind}</span><span style={{ flex: 1, fontSize: 14.5, lineHeight: 1.5 }}>{m.text}</span><span style={{ color: '#6B6572', fontSize: 12.5 }}>{m.scope} · {ago(m.createdAt)}</span></div>)}
    </div>);

  return (
    <Page fill title="Knowledge" sub="What your agents know, where it came from, and how they find it." actions={<>
      <Tabs value={view} onChange={setView} options={[{ id: 'graph', label: 'Graph' }, { id: 'sources', label: 'Sources' }, { id: 'memory', label: 'Memory' }, { id: 'retrieval', label: 'Retrieval' }]} />
      <Btn onClick={() => setAdd('note')}>Add note</Btn><Btn onClick={() => setAdd('url')}>Add URL</Btn><Btn variant="primary" onClick={() => pick.current?.click()}>Add source</Btn>
      <input ref={pick} type="file" hidden multiple onChange={async (e) => { for (const f of Array.from(e.target.files ?? [])) { const up = await api.files.upload(f); await create({ kind: 'file', name: f.name, size: f.size, url: up.id, status: 'pending' }); } e.target.value = ''; toast('Source added'); }} /></>}>
      <ErrorNote message={error} />
      <div key={view} style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: view === 'graph' ? 'minmax(240px,300px) minmax(0,1fr) minmax(280px,340px)' : view === 'sources' ? 'minmax(0,1fr)' : 'minmax(0,1fr)', gap: 18, animation: 'lm-up .35s ease both' }}>
        {view === 'graph' && <>{Sources}{Graph}{Rag}</>}
        {view === 'sources' && (items.length === 0 ? <Empty mate="recall" title="No sources yet" text="Upload a file, add a URL or write a note." /> : <div style={{ ...card, overflow: 'auto' }}>{items.map((k) => <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid rgba(31,26,23,.08)' }}><span style={{ width: 40, height: 40, borderRadius: 10, background: BADGE[k.kind][1], color: BADGE[k.kind][2], fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{BADGE[k.kind][0]}</span><div style={{ flex: 1, minWidth: 0 }}><b>{k.name}</b><div style={{ color: '#6B6572', fontSize: 12.5 }}>{k.kind}{k.size ? ` · ${bytes(k.size)}` : ''}{k.url && k.kind === 'url' ? ` · ${k.url}` : ''} · added {ago(k.createdAt)}</div></div><span style={{ fontSize: 12.5, color: k.status === 'indexed' ? '#1E7A46' : '#6B6572' }}>{k.status === 'pending' ? 'Not indexed' : k.status}</span><Btn small variant="danger" onClick={() => confirmThen(`Remove “${k.name}”?`, () => remove(k.id))}>Remove</Btn></div>)}</div>)}
        {view === 'memory' && Memory}
        {view === 'retrieval' && <div style={{ maxWidth: 560 }}>{Rag}</div>}
      </div>
      {add && (
        <Modal title={add === 'url' ? 'Add a web page' : 'Add a note'} onClose={() => setAdd(null)} onSubmit={submit} canSubmit={add === 'url' ? /^https?:\/\//.test(form.url) : !!form.name.trim() && !!form.text.trim()}>
          {add === 'url' ? <Field label="URL"><Input type="url" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field> : null}
          <Field label={add === 'url' ? 'Name (optional)' : 'Title'}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          {add === 'note' && <Field label="Note"><Textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></Field>}
        </Modal>)}
    </Page>
  );
}
