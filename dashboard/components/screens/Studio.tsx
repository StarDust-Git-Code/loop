'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { uid } from '../../lib/format';
import { useItem } from '../../lib/hooks';
import { MATE_DEFS, MATES } from '../../lib/mates';
import type { FlowEdge, FlowNode, MateKey, NodeType } from '../../lib/types';
import { Btn, Card, Field, Input, Loading, MateAvatar, Page, Select, Textarea } from '../ui/ui';

const W = 168, H = 64;
const KIND: Record<NodeType, string> = { trigger: 'Trigger', mate: 'Mate', tool: 'Tool', condition: 'Condition', output: 'Output' };

export function Studio() {
  const router = useRouter();
  const id = useSearchParams().get('id');
  const { item, loading } = useItem(api.workflows, id);
  const [name, setName] = useState('Untitled workflow');
  const [description, setDescription] = useState('');
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [mateToAdd, setMateToAdd] = useState<MateKey>('research');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState('');
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const board = useRef<HTMLDivElement>(null);

  // Hydrating the editor form from the loaded workflow is the one legitimate effect-driven setState here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { if (item) { setName(item.name); setDescription(item.description); setNodes(item.nodes); setEdges(item.edges); setDirty(false); } }, [item]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const touch = () => { setDirty(true); setSaved(''); };

  const add = (type: NodeType, mate?: MateKey) => {
    const n: FlowNode = { id: uid(), type, mate, label: mate ? `${MATES[mate].name} Mate` : KIND[type], x: 40 + (nodes.length % 4) * 190, y: 40 + Math.floor(nodes.length / 4) * 110 };
    setNodes((a) => [...a, n]); setSel(n.id); touch();
  };
  const connect = (to: string) => {
    if (linkFrom && linkFrom !== to && !edges.some((e) => e.from === linkFrom && e.to === to)) { setEdges((e) => [...e, { id: uid(), from: linkFrom, to }]); touch(); }
    setLinkFrom(null);
  };
  const del = (nid: string) => { setNodes((a) => a.filter((n) => n.id !== nid)); setEdges((e) => e.filter((x) => x.from !== nid && x.to !== nid)); setSel(null); touch(); };

  const onDown = (e: React.PointerEvent, n: FlowNode) => {
    if (linkFrom) return connect(n.id);
    const r = board.current!.getBoundingClientRect();
    drag.current = { id: n.id, dx: e.clientX - r.left - n.x, dy: e.clientY - r.top - n.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setSel(n.id);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const r = board.current!.getBoundingClientRect();
    setNodes((a) => a.map((n) => (n.id === d.id ? { ...n, x: Math.max(0, e.clientX - r.left - d.dx), y: Math.max(0, e.clientY - r.top - d.dy) } : n)));
    touch();
  };

  const save = async (): Promise<string | null> => {
    const data = { name: name.trim() || 'Untitled workflow', description, nodes, edges };
    let wid = id;
    if (id) await api.workflows.update(id, data);
    else { const w = await api.workflows.create(data); wid = w.id; router.replace(`/studio?id=${w.id}`); }
    setDirty(false); setSaved('Saved');
    return wid;
  };
  const run = async () => {
    const wid = dirty || !id ? await save() : id;
    const r = await api.runs.start({ prompt: `Run workflow: ${name}`, workflowId: wid ?? undefined, askFirst: true });
    router.push(`/run?id=${r.id}`);
  };

  const selected = nodes.find((n) => n.id === sel);
  const pt = (n: FlowNode, side: 'l' | 'r') => ({ x: n.x + (side === 'r' ? W : 0), y: n.y + H / 2 });
  if (id && loading) return <Page title="Studio"><Loading /></Page>;

  return (
    <Page title="Agent Studio" sub="Place Mates and tools on the canvas, then connect them in the order they should run."
      actions={<>{saved && <span style={{ color: 'var(--done)', fontSize: 12.5 }}>{saved}</span>}<Btn onClick={() => void save()} disabled={!dirty && !!id}>Save</Btn><Btn variant="primary" onClick={run} disabled={nodes.length === 0}>Run</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
            {(['trigger', 'tool', 'condition', 'output'] as NodeType[]).map((t) => <Btn key={t} small onClick={() => add(t)}>+ {KIND[t]}</Btn>)}
            <Select style={{ width: 150 }} value={mateToAdd} onChange={(e) => setMateToAdd(e.target.value as MateKey)} aria-label="Mate to add">{MATE_DEFS.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</Select>
            <Btn small onClick={() => add('mate', mateToAdd)}>+ Mate</Btn>
            <Btn small variant={linkFrom ? 'primary' : undefined} disabled={!sel} onClick={() => setLinkFrom(linkFrom ? null : sel)}>{linkFrom ? 'Pick target…' : 'Connect from selected'}</Btn>
          </div>
          <div ref={board} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onClick={(e) => e.target === board.current && setSel(null)}
            style={{ position: 'relative', height: 560, border: '1px solid var(--line-soft)', borderRadius: 16, overflow: 'auto', background: 'radial-gradient(circle, #d9d4e6 1px, transparent 1px) 0 0/22px 22px', touchAction: 'none' }}>
            {nodes.length === 0 && <p style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--muted)', margin: 0 }}>Add your first node from the toolbar.</p>}
            <svg style={{ position: 'absolute', inset: 0, width: 2000, height: 1200, pointerEvents: 'none' }}>
              {edges.map((e) => { const a = nodes.find((n) => n.id === e.from), b = nodes.find((n) => n.id === e.to); if (!a || !b) return null; const p = pt(a, 'r'), q = pt(b, 'l'); const m = (p.x + q.x) / 2;
                return <path key={e.id} d={`M${p.x},${p.y} C${m},${p.y} ${m},${q.y} ${q.x},${q.y}`} fill="none" stroke="#6a4df4" strokeWidth="2" pathLength={1} strokeDasharray="1" style={{ animation: 'lm-draw 0.6s ease both' }} />; })}
            </svg>
            {nodes.map((n) => (
              <div key={n.id} onPointerDown={(e) => onDown(e, n)} tabIndex={0} role="button" aria-label={n.label}
                onKeyDown={(e) => { if (e.key === 'Delete') del(n.id); if (e.key === 'Enter') setSel(n.id); }}
                style={{ position: 'absolute', left: n.x, top: n.y, width: W, height: H, background: '#fff', border: `2px solid ${sel === n.id ? '#6a4df4' : linkFrom === n.id ? '#1e7a46' : 'rgba(27,24,34,.17)'}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', cursor: linkFrom ? 'crosshair' : 'grab', userSelect: 'none', animation: 'lm-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both', transition: 'border-color .15s, box-shadow .15s', boxShadow: sel === n.id ? '0 8px 22px rgba(106,77,244,.25)' : 'none' }}>
                {n.mate ? <MateAvatar mate={n.mate} size={34} /> : <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--chip)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>{KIND[n.type][0]}</span>}
                <span style={{ minWidth: 0 }}><b style={{ display: 'block', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</b><small style={{ color: 'var(--muted)' }}>{KIND[n.type]}</small></span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Name"><Input value={name} onChange={(e) => { setName(e.target.value); touch(); }} /></Field>
              <Field label="Description"><Textarea value={description} onChange={(e) => { setDescription(e.target.value); touch(); }} /></Field>
            </div>
          </Card>
          <Card>
            {selected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <b>{KIND[selected.type]} node</b>
                <Field label="Label"><Input value={selected.label} onChange={(e) => { setNodes((a) => a.map((n) => (n.id === selected.id ? { ...n, label: e.target.value } : n))); touch(); }} /></Field>
                <Field label="Instruction for this step"><Textarea value={selected.config?.instruction ?? ''} onChange={(e) => { setNodes((a) => a.map((n) => (n.id === selected.id ? { ...n, config: { ...n.config, instruction: e.target.value } } : n))); touch(); }} /></Field>
                {edges.filter((e) => e.from === selected.id || e.to === selected.id).map((e) => (
                  <Btn key={e.id} small onClick={() => { setEdges((x) => x.filter((y) => y.id !== e.id)); touch(); }}>Remove link to {nodes.find((n) => n.id === (e.from === selected.id ? e.to : e.from))?.label}</Btn>
                ))}
                <Btn variant="danger" small onClick={() => del(selected.id)}>Delete node</Btn>
              </div>
            ) : <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Select a node to edit it. Drag to move. Press Delete to remove.</p>}
          </Card>
        </div>
      </div>
    </Page>
  );
}
