'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { ago, bytes, uid } from '../../lib/format';
import { useItem, useRepo } from '../../lib/hooks';
import { ALL_TOOLS, MATE_DEFS, MATES, mateImg, mateName } from '../../lib/mates';
import type { FlowEdge, FlowNode, MateKey, NodeType } from '../../lib/types';
import { ModelPicker } from '../ui/ModelPicker';
import { useToast } from '../ui/toast';
import { Btn, Loading, Page, Tabs, Toggle } from '../ui/ui';
import s from './studio.module.css';

const W = 200, H = 84;
const KIND: Record<NodeType, { name: string; sub: string; icon: string }> = {
  trigger: { name: 'Trigger', sub: 'Starts the workflow', icon: '⚡' }, knowledge: { name: 'Knowledge', sub: 'Search my notes', icon: '▤' }, input: { name: 'Input', sub: 'User message', icon: '◌' },
  mate: { name: 'Agent', sub: 'Mate', icon: '✦' }, tool: { name: 'Tool', sub: 'Run a tool', icon: '⚒' }, condition: { name: 'Condition', sub: 'Branch on a check', icon: '⑃' },
  transform: { name: 'Transform', sub: 'Reshape the data', icon: '⇄' }, filter: { name: 'Filter', sub: 'Keep what matches', icon: '▽' }, output: { name: 'Output', sub: 'Send result', icon: '➤' },
};
const PALETTE: NodeType[] = ['mate', 'tool', 'condition', 'transform', 'filter', 'output'];

export function Studio() {
  const router = useRouter(); const toast = useToast();
  const id = useSearchParams().get('id');
  const { item, loading } = useItem(api.workflows, id);
  const allRuns = useRepo(api.runs).items; const files = useRepo(api.files).items;
  const [name, setName] = useState('Untitled workflow');
  const [nodes, setNodes] = useState<FlowNode[]>([]); const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [sel, setSel] = useState<string | null>(null); const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [mate, setMate] = useState<MateKey>('research'); const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(1); const [top, setTop] = useState<'canvas' | 'runs' | 'logs'>('canvas');
  const [cfgTab, setCfgTab] = useState<'config' | 'tools' | 'memory'>('config'); const [side, setSide] = useState<'terminal' | 'files'>('terminal');
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null); const board = useRef<HTMLDivElement>(null);

  // Hydrating the editor form from the loaded workflow is the one legitimate effect-driven setState here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { if (item) { setName(item.name); setNodes(item.nodes); setEdges(item.edges); setDirty(false); } }, [item]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const touch = () => setDirty(true);
  const buildWithFlow = async () => {
    const c = await api.conversations.create({ title: `Build: ${name}`.slice(0, 42), mate: 'flow', messages: [], mode: 'chat', members: [] });
    router.push(`/chat?c=${c.id}&draft=${encodeURIComponent(`Build my workflow "${name}"${id ? ` (id ${id})` : ''}: `)}`);
  };
  const patch = (nid: string, p: Partial<FlowNode>) => { setNodes((a) => a.map((n) => (n.id === nid ? { ...n, ...p } : n))); touch(); };
  const cfg = (n: FlowNode, k: string, v: string) => patch(n.id, { config: { ...n.config, [k]: v } });

  const add = (type: NodeType, m?: MateKey) => {
    const last = nodes[nodes.length - 1];
    const n: FlowNode = { id: uid(), type, mate: type === 'mate' ? (m ?? mate) : undefined, label: type === 'mate' ? mateName(m ?? mate) : KIND[type].name, x: last ? last.x + 240 : 40, y: last ? last.y : 80 };
    setNodes((a) => [...a, n]); if (last) setEdges((e) => [...e, { id: uid(), from: last.id, to: n.id }]); setSel(n.id); touch();
  };
  const connect = (to: string) => { if (linkFrom && linkFrom !== to && !edges.some((e) => e.from === linkFrom && e.to === to)) { setEdges((e) => [...e, { id: uid(), from: linkFrom, to }]); touch(); } setLinkFrom(null); };
  const del = (nid: string) => { setNodes((a) => a.filter((n) => n.id !== nid)); setEdges((e) => e.filter((x) => x.from !== nid && x.to !== nid)); setSel(null); touch(); };

  const onDown = (e: React.PointerEvent, n: FlowNode) => {
    if (linkFrom) return connect(n.id);
    const r = board.current!.getBoundingClientRect();
    drag.current = { id: n.id, dx: (e.clientX - r.left + board.current!.scrollLeft) / zoom - n.x, dy: (e.clientY - r.top + board.current!.scrollTop) / zoom - n.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setSel(n.id);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return; const r = board.current!.getBoundingClientRect();
    patch(d.id, { x: Math.max(0, Math.round((e.clientX - r.left + board.current!.scrollLeft) / zoom - d.dx)), y: Math.max(0, Math.round((e.clientY - r.top + board.current!.scrollTop) / zoom - d.dy)) });
  };

  const save = async (extra: Partial<{ state: 'active' | 'scheduled' | 'manual' | 'draft'; trigger: string }> = {}): Promise<string | null> => {
    const trig = nodes.find((n) => n.type === 'trigger');
    const data = { name: name.trim() || 'Untitled workflow', description: item?.description ?? '', nodes, edges, trigger: extra.trigger ?? item?.trigger ?? trig?.config?.when ?? 'manual', state: extra.state ?? item?.state ?? 'draft' };
    let wid = id;
    if (id) await api.workflows.update(id, data); else { const w = await api.workflows.create(data); wid = w.id; router.replace(`/studio?id=${w.id}`); }
    setDirty(false); return wid;
  };
  const test = async () => { const wid = await save(); const r = await api.runs.start({ prompt: `Test run: ${name}`, workflowId: wid ?? undefined, askFirst: true }); router.push(`/run?id=${r.id}`); };
  const deploy = async () => { await save({ state: nodes.some((n) => n.type === 'trigger' && n.config?.when) ? 'scheduled' : 'active' }); toast('Deployed. It shows as Active in Workflows'); };

  const selected = nodes.find((n) => n.id === sel);
  const mine = allRuns.filter((r) => r.workflowId && r.workflowId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const last = mine[0];
  const centre = (n: FlowNode, right: boolean) => ({ x: n.x + (right ? W : 0), y: n.y + H / 2 });
  const size = nodes.reduce((m, n) => ({ w: Math.max(m.w, n.x + W + 120), h: Math.max(m.h, n.y + H + 120) }), { w: 900, h: 480 });
  if (id && loading) return <Page title="Agent Studio"><Loading /></Page>;

  return (
    <Page fill title="Agent Studio" sub="Design, connect and run your agents."
      actions={<><Btn href="/workflows">Library</Btn><Btn onClick={deploy} disabled={nodes.length === 0} style={{ background: '#15121A', color: '#fff', borderColor: '#15121A' }}>Deploy</Btn></>}>
      <div className={s.body}>
        <div className={s.canvasCol}>
          <div className={s.bar}>
            <Tabs value={top} onChange={(v) => setTop(v)} options={[{ id: 'canvas', label: 'Canvas' }, { id: 'runs', label: 'Runs' }, { id: 'logs', label: 'Logs' }]} />
            <Btn onClick={() => void buildWithFlow()}>✨ Build with Flow</Btn>
            <input value={name} onChange={(e) => { setName(e.target.value); touch(); }} aria-label="Workflow name" style={{ flex: 1, minWidth: 120, height: 40, border: '1px solid transparent', borderRadius: 10, padding: '0 10px', font: 'inherit', fontWeight: 700, fontSize: 15, background: 'transparent' }} onFocus={(e) => (e.target.style.borderColor = 'rgba(27,24,34,.17)')} onBlur={(e) => (e.target.style.borderColor = 'transparent')} />
            <div className={s.zoom}><button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))}>+</button></div>
            <Btn onClick={() => void save().then(() => toast('Saved'))} disabled={!dirty && !!id}>Save</Btn>
            <Btn onClick={test} disabled={nodes.length === 0}>▶ Test Run</Btn>
          </div>

          {top === 'canvas' && <>
            <div ref={board} className={s.board} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) { setSel(null); setLinkFrom(null); } }}>
              {nodes.length === 0 && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#6B6572', pointerEvents: 'none' }}><div><img src={mateImg('planner')} alt="" width={64} style={{ display: 'block', margin: '0 auto 6px', animation: 'lm-bob 3.6s ease-in-out infinite' }} /><p style={{ margin: '8px 0 0' }}>Empty canvas. Add a node below. Each new node links to the last one.</p></div></div>}
              <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: size.w, height: size.h, position: 'relative' }} data-bg="1">
                <svg style={{ position: 'absolute', inset: 0, width: size.w, height: size.h, pointerEvents: 'none' }}>
                  {edges.map((e) => { const a = nodes.find((n) => n.id === e.from), b = nodes.find((n) => n.id === e.to); if (!a || !b) return null; const p = centre(a, true), q = centre(b, false), m = (p.x + q.x) / 2;
                    return <path key={e.id} d={`M${p.x},${p.y} C${m},${p.y} ${m},${q.y} ${q.x},${q.y}`} fill="none" stroke="#9D8CFF" strokeWidth="2" />; })}
                </svg>
                {nodes.map((n) => {
                  const k = KIND[n.type]; const m = n.mate ? MATES[n.mate] : null;
                  return (
                    <div key={n.id} role="button" tabIndex={0} aria-label={n.label} className={`${s.node} ${sel === n.id ? s.sel : ''} ${linkFrom === n.id ? s.src : ''}`} style={{ left: n.x, top: n.y, minHeight: H, cursor: linkFrom ? 'crosshair' : 'grab' }}
                      onPointerDown={(e) => onDown(e, n)} onKeyDown={(e) => { if (e.key === 'Delete' || e.key === 'Backspace') del(n.id); if (e.key === 'Enter') setSel(n.id); }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {n.mate ? <img src={mateImg(n.mate)} alt="" width={36} height={36} draggable={false} /> : <span className={s.ico}>{k.icon}</span>}
                        <div style={{ minWidth: 0 }}><b style={{ display: 'block', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</b><small style={{ color: '#6B6572', fontSize: 12 }}>{m ? m.blurb.slice(0, 26) : n.config?.when || k.sub}</small></div>
                      </div>
                      <span className={`${s.port} ${linkFrom === n.id ? s.on : ''}`} role="button" aria-label={`Connect from ${n.label}`} onPointerDown={(e) => { e.stopPropagation(); setLinkFrom(linkFrom === n.id ? null : n.id); }} />
                    </div>);
                })}
              </div>
            </div>
            <div className={s.pal}>
              <b>Add node</b>
              {PALETTE.map((t) => <button key={t} className={s.palBtn} onClick={() => add(t)}><span className={s.ico}>{KIND[t].icon}</span>{KIND[t].name}</button>)}
              <button className={s.palBtn} onClick={() => add('trigger')}><span className={s.ico}>{KIND.trigger.icon}</span>Trigger</button>
              <select value={mate} onChange={(e) => setMate(e.target.value as MateKey)} aria-label="Mate for Agent node" className={s.sel2} style={{ width: 150, marginLeft: 'auto' }}>{MATE_DEFS.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</select>
              {linkFrom && <span style={{ fontSize: 12.5, color: '#4F34D6', fontWeight: 600 }}>Click a node to connect…</span>}
            </div>
          </>}

          {top === 'runs' && <div className={s.panel} style={{ flex: 1 }}>{mine.length === 0 ? <p style={{ color: '#6B6572', margin: 0 }}>{id ? 'This workflow has not run yet. Hit Test Run.' : 'Save the workflow first, then Test Run.'}</p> : mine.map((r) => <Link key={r.id} href={`/run?id=${r.id}`} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(31,26,23,.07)', textDecoration: 'none', color: 'inherit' }}><b style={{ flex: 1 }}>{r.title}</b><span style={{ color: '#6B6572' }}>{r.status} · {ago(r.createdAt)}</span></Link>)}</div>}
          {top === 'logs' && <div className={`${s.term} mono`} style={{ flex: 1 }}>{last && last.log.length ? last.log.map((l, i) => <div key={i}><span style={{ color: '#9D8CFF' }}>{l.source}</span> {l.text}</div>) : 'No logs yet.'}</div>}
        </div>

        <aside className={`${s.panel} ${s.cfg}`} aria-label="Node settings">
          {!selected ? <div style={{ margin: 'auto', textAlign: 'center', color: '#6B6572', fontSize: 13.5, lineHeight: 1.6 }}><img src={mateImg('mimo')} alt="" width={56} style={{ display: 'block', margin: '0 auto 6px', animation: 'lm-bob 3.6s ease-in-out infinite' }} /><p>Select a node to configure it.<br />Drag to move, use the dot on its right edge to link, press Delete to remove.</p></div> : <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{selected.mate ? <img src={mateImg(selected.mate)} alt="" width={40} /> : <span className={s.ico}>{KIND[selected.type].icon}</span>}<input value={selected.label} onChange={(e) => patch(selected.id, { label: e.target.value })} aria-label="Node label" style={{ flex: 1, border: 0, background: 'none', font: 'inherit', fontWeight: 700, fontSize: 17, minWidth: 0 }} /></div>
            <Tabs value={cfgTab} onChange={setCfgTab} options={[{ id: 'config', label: 'Config' }, { id: 'tools', label: 'Tools' }, { id: 'memory', label: 'Memory' }]} />
            <div key={cfgTab + selected.id} style={{ animation: 'lm-up .3s ease both', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cfgTab === 'config' && <>
                {selected.type === 'trigger' && <div><p className={s.lbl}>When should it start?</p><input className={s.sel2} value={selected.config?.when ?? ''} onChange={(e) => cfg(selected, 'when', e.target.value)} placeholder="e.g. every weekday 10:00, or new task" /></div>}
                <div><p className={s.lbl}>Description</p><textarea className={s.area} value={selected.config?.description ?? ''} onChange={(e) => cfg(selected, 'description', e.target.value)} placeholder={selected.mate ? MATES[selected.mate].blurb : 'What does this step do?'} /></div>
                {selected.type === 'mate' && <div><p className={s.lbl}>Model</p><ModelPicker value={selected.config?.model ?? ''} onChange={(v) => cfg(selected, 'model', v)} /></div>}
                <div><p className={s.lbl}>{selected.type === 'mate' ? 'Persona / system prompt' : 'Instruction for this step'}</p><textarea className={s.area} style={{ minHeight: 110 }} value={selected.config?.instruction ?? ''} onChange={(e) => cfg(selected, 'instruction', e.target.value)} /></div>
                <div><p className={s.lbl}>Output format</p><select className={s.sel2} value={selected.config?.format ?? 'Markdown'} onChange={(e) => cfg(selected, 'format', e.target.value)}>{['Markdown', 'Plain text', 'JSON', 'Table'].map((f) => <option key={f}>{f}</option>)}</select></div>
              </>}
              {cfgTab === 'tools' && (() => { const on = (selected.config?.tools ?? (selected.mate ? MATES[selected.mate].tools.join(',') : '')).split(',').filter(Boolean); return ALL_TOOLS.map((t) => <div key={t} className={s.tool}><span>{t}</span><Toggle label={t} checked={on.includes(t)} onChange={(v) => cfg(selected, 'tools', (v ? [...on, t] : on.filter((x) => x !== t)).join(','))} /></div>); })()}
              {cfgTab === 'memory' && (['private', 'shared', 'project'] as const).map((m) => <label key={m} className={s.tool}><input type="radio" name="mem" checked={(selected.config?.memory ?? 'private') === m} onChange={() => cfg(selected, 'memory', m)} /><span style={{ textTransform: 'capitalize' }}>{m}</span></label>)}
            </div>
            <div style={{ flex: 1 }} />
            {edges.filter((e) => e.from === selected.id || e.to === selected.id).map((e) => <Btn key={e.id} small onClick={() => { setEdges((x) => x.filter((y) => y.id !== e.id)); touch(); }}>Unlink {nodes.find((n) => n.id === (e.from === selected.id ? e.to : e.from))?.label}</Btn>)}
            <Btn variant="primary" style={{ height: 48 }} onClick={() => void save().then(() => toast('Changes saved'))}>Save Changes</Btn>
            <Btn variant="danger" small onClick={() => del(selected.id)}>Delete node</Btn>
          </>}
        </aside>

        <aside className={`${s.panel} ${s.side}`} style={{ background: '#fff' }} aria-label="Workspace">
          <Tabs value={side} onChange={setSide} options={[{ id: 'terminal', label: 'Terminal' }, { id: 'files', label: 'Files' }]} />
          <div key={side} style={{ animation: 'lm-up .3s ease both', flex: 1, minHeight: 0 }}>
            {side === 'terminal' ? <div className={`${s.term} mono`} style={{ height: '100%' }}>{last && last.log.length ? last.log.map((l, i) => <div key={i}><span style={{ color: '#9D8CFF' }}>{l.source}</span> {l.text}</div>) : '$ waiting for a run…'}</div>
              : files.length === 0 ? <p style={{ color: '#6B6572', fontSize: 13.5 }}>No files yet.</p> : files.slice(0, 12).map((f) => <div key={f.id} style={{ display: 'flex', gap: 8, padding: '7px 0', fontSize: 13.5, borderBottom: '1px solid rgba(31,26,23,.07)' }}><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span><span style={{ color: '#6B6572' }}>{bytes(f.size)}</span></div>)}
          </div>
        </aside>
      </div>
    </Page>
  );
}
