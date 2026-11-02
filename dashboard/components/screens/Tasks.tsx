'use client';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ago } from '../../lib/format';
import { useRepo, useSettings } from '../../lib/hooks';
import { MATE_DEFS, mateImg } from '../../lib/mates';
import type { MateKey, Task, TaskIn } from '../../lib/types';
import { Btn, Chips, confirmThen, ErrorNote, Field, Input, Loading, Modal, Page, Select, Tabs, Textarea } from '../ui/ui';

type St = Task['status']; type F = 'all' | 'mine' | 'agents';
const COLS: { id: St; label: string; dot: string }[] = [{ id: 'todo', label: 'Pending', dot: '#8A5A00' }, { id: 'doing', label: 'Ongoing', dot: '#6A4DF4' }, { id: 'done', label: 'Completed', dot: '#1E7A46' }];
const TAGS = ['Needs your OK', 'Automation', 'Ultracode', 'From Telegram', 'From WhatsApp', 'Failed once'];
const TAGC: Record<string, [string, string]> = { 'Needs your OK': ['#FFF3D6', '#8A5A00'], Automation: ['#ECE7FF', '#4F34D6'], Ultracode: ['#E4EAFF', '#2B4BC0'], 'From Telegram': ['#DDEEFF', '#1F5FBF'], 'From WhatsApp': ['#DFF3E3', '#1E7A46'], 'Failed once': ['#FDE8E8', '#B3261E'] };
const blank: TaskIn = { title: '', detail: '', status: 'todo', tags: [] };
const card = { background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, boxShadow: '0 2px 6px rgba(31,26,23,.05)' } as const;
const due = (t: Task) => { if (t.status === 'done') return ago(t.updatedAt); if (!t.dueAt) return t.status === 'doing' ? 'Running' : ''; const d = Math.round((new Date(t.dueAt).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d < 0 ? `${-d}d overdue` : new Date(t.dueAt).toLocaleDateString([], { weekday: 'long' }); };

export function Tasks() {
  const { items, loading, error, create, update, remove } = useRepo(api.tasks);
  const { settings } = useSettings();
  const [f, setF] = useState<F>('all'); const [edit, setEdit] = useState<(TaskIn & { id?: string }) | null>(null);
  const [drag, setDrag] = useState<string | null>(null); const [over, setOver] = useState<St | null>(null); const [quick, setQuick] = useState('');
  const me = (settings?.displayName || 'I')[0].toUpperCase();
  const vis = items.filter((t) => f === 'all' || (f === 'mine' ? !t.mate : !!t.mate));
  const stats: [string, number, string][] = [['Waiting on you', items.filter((t) => !t.mate && t.status !== 'done').length, '#8A5A00'], ['Agents working or queued', items.filter((t) => t.mate && t.status !== 'done').length, '#6A4DF4'], ['Completed', items.filter((t) => t.status === 'done').length, '#1E7A46'], ['All tasks', items.length, '#6B6572']];
  const save = async () => { if (!edit) return; const { id, ...d } = edit; await (id ? update(id, d) : create(d)); setEdit(null); };

  return (
    <Page fill title="Tasks" sub="Everything on your plate and your agents’ plate, in one place." actions={<><Tabs value={f} onChange={setF} options={[{ id: 'all', label: 'All' }, { id: 'mine', label: 'Mine' }, { id: 'agents', label: 'Agents' }]} /><Btn variant="primary" onClick={() => setEdit({ ...blank })}>+ New task</Btn></>}>
      <ErrorNote message={error} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
        {stats.map(([l, n, c], i) => <div key={l} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, animation: `lm-up .35s ${i * 50}ms ease both` }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: c }} /><span style={{ flex: 1, fontSize: 14 }}>{l}</span><b style={{ fontSize: 24, fontVariantNumeric: 'tabular-nums' }}>{n}</b></div>)}
      </div>
      <form onSubmit={async (e) => { e.preventDefault(); if (quick.trim()) { await create({ ...blank, title: quick.trim(), mate: f === 'agents' ? 'planner' : undefined }); setQuick(''); } }} style={{ marginBottom: 14 }}>
        <input value={quick} onChange={(e) => setQuick(e.target.value)} aria-label="Quick add a task" placeholder="Type a task and press Enter" style={{ width: '100%', height: 44, border: '1px solid rgba(27,24,34,.17)', borderRadius: 12, padding: '0 16px', font: 'inherit', fontSize: 14.5, background: '#fff' }} />
      </form>
      {loading ? <Loading /> : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, overflow: 'auto' }}>
          {COLS.map((c) => {
            const list = vis.filter((t) => t.status === c.id);
            return (
              <section key={c.id} onDragOver={(e) => { e.preventDefault(); setOver(c.id); }} onDragLeave={() => setOver((o) => (o === c.id ? null : o))} onDrop={() => { if (drag) void update(drag, { status: c.id }); setDrag(null); setOver(null); }}
                style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 200, background: over === c.id ? '#F4F0FF' : '#fff', borderColor: over === c.id ? '#6A4DF4' : card.border, transition: 'background .2s, border-color .2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: c.dot }} />{c.label}<span style={{ marginLeft: 'auto', background: '#F1EFF6', borderRadius: 99, padding: '1px 9px', fontSize: 12 }}>{list.length}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', flex: 1 }}>
                  {list.length === 0 && <p style={{ color: '#6B6572', fontSize: 13, margin: '6px 4px' }}>{drag ? 'Drop here' : 'Nothing here.'}</p>}
                  {list.map((t, i) => (
                    <article key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => setEdit(t)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEdit(t)}
                      style={{ ...card, padding: '14px 16px', cursor: 'grab', opacity: drag === t.id ? 0.4 : 1, animation: `lm-up .3s ${Math.min(i, 6) * 30}ms ease both`, transition: 'transform .2s, box-shadow .2s' }} onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={(e) => (e.currentTarget.style.transform = '')}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <b style={{ flex: 1, fontSize: 14.5, lineHeight: 1.35, textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? '#3D3946' : 'inherit' }}>{t.title}</b>
                        {t.mate ? <img src={mateImg(t.mate)} alt="" width={30} height={30} /> : <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#ECE7FF', color: '#4F34D6', fontWeight: 700, fontSize: 13, display: 'grid', placeItems: 'center', flex: 'none' }}>{me}</span>}
                      </div>
                      {t.detail && <p style={{ margin: '8px 0', color: '#6B6572', fontSize: 13, lineHeight: 1.45 }}>{t.detail}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: t.detail ? 0 : 8 }}>
                        {t.tags.map((g) => <span key={g} style={{ background: (TAGC[g] ?? ['#F1EFF6', '#3D3946'])[0], color: (TAGC[g] ?? ['#F1EFF6', '#3D3946'])[1], borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{g}</span>)}
                        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#6B6572' }}>{due(t)}</span>
                      </div>
                    </article>))}
                </div>
              </section>);
          })}
        </div>)}
      {edit && (
        <Modal title={edit.id ? 'Edit task' : 'New task'} onClose={() => setEdit(null)} onSubmit={save} canSubmit={!!edit.title.trim()} submitLabel={edit.id ? 'Save' : 'Create task'}>
          <Field label="Title"><Input autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <Field label="Details"><Textarea value={edit.detail} onChange={(e) => setEdit({ ...edit, detail: e.target.value })} /></Field>
          <Field label="Status"><Tabs value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={COLS.map((c) => ({ id: c.id, label: c.label }))} /></Field>
          <Field label="Assigned to"><Select value={edit.mate ?? ''} onChange={(e) => setEdit({ ...edit, mate: (e.target.value || undefined) as MateKey | undefined })}><option value="">Me</option>{MATE_DEFS.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</Select></Field>
          <Field label="Due date (optional)"><Input type="date" value={edit.dueAt?.slice(0, 10) ?? ''} onChange={(e) => setEdit({ ...edit, dueAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></Field>
          <Field label="Tags"><Chips options={TAGS} value={edit.tags} onChange={(v) => setEdit({ ...edit, tags: v })} /></Field>
          {edit.id && <Btn variant="danger" small onClick={() => { const id = edit.id!; setEdit(null); confirmThen('Delete this task?', () => remove(id)); }}>Delete task</Btn>}
        </Modal>)}
    </Page>
  );
}
