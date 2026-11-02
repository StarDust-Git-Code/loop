'use client';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import type { CalEvent, CalEventIn } from '../../lib/types';
import { Btn, confirmThen, ErrorNote, Field, Input, Modal, Page, Select, Textarea } from '../ui/ui';

const KINDS: CalEventIn['kind'][] = ['event', 'reminder', 'run', 'automation'];
const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function Schedule() {
  const { items, error, create, update, remove } = useRepo(api.events);
  const [start, setStart] = useState(() => mondayOf(new Date()));
  const [edit, setEdit] = useState<(CalEventIn & { id?: string }) | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const shift = (n: number) => setStart((s) => { const d = new Date(s); d.setDate(d.getDate() + n * 7); return d; });
  const draft = (d: Date, h = 9): CalEventIn => { const a = new Date(d); a.setHours(h, 0, 0, 0); const b = new Date(a); b.setHours(h + 1); return { title: '', notes: '', kind: 'event', start: a.toISOString(), end: b.toISOString() }; };
  const save = async () => { if (!edit) return; const { id, ...d } = edit; await (id ? update(id, d) : create(d)); setEdit(null); };
  const on = (d: Date) => items.filter((e) => new Date(e.start).toDateString() === d.toDateString()).sort((a, b) => a.start.localeCompare(b.start));
  const e0 = edit as (CalEventIn & { id?: string }) | null;
  return (
    <Page title="Schedule" sub={`${days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${days[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
      actions={<><Btn onClick={() => shift(-1)} aria-label="Previous week">←</Btn><Btn onClick={() => setStart(mondayOf(new Date()))}>Today</Btn><Btn onClick={() => shift(1)} aria-label="Next week">→</Btn><Btn variant="primary" onClick={() => setEdit(draft(new Date()))}>New event</Btn></>}>
      <ErrorNote message={error} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(130px,1fr))', gap: 8, overflowX: 'auto' }}>
        {days.map((d) => (
          <div key={d.toISOString()} style={{ border: '1px solid var(--line-soft)', borderRadius: 14, padding: 10, minHeight: 280, background: d.toDateString() === new Date().toDateString() ? '#faf8ff' : '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 12.5 }}>{d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</b><Btn small aria-label={`Add event on ${d.toDateString()}`} onClick={() => setEdit(draft(d))}>+</Btn></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {on(d).map((e: CalEvent) => (
                <button key={e.id} type="button" onClick={() => setEdit(e)} style={{ textAlign: 'left', border: 0, background: e.kind === 'event' ? '#ece7ff' : '#f3f1f8', borderRadius: 9, padding: '6px 8px', fontSize: 12 }}>
                  <b>{new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b> {e.title}</button>))}
            </div>
          </div>))}
      </div>
      {e0 && (
        <Modal title={e0.id ? 'Edit event' : 'New event'} onClose={() => setEdit(null)} onSubmit={save} canSubmit={!!e0.title.trim() && e0.end > e0.start}>
          <Field label="Title"><Input value={e0.title} onChange={(e) => setEdit({ ...e0, title: e.target.value })} /></Field>
          <Field label="Type"><Select value={e0.kind} onChange={(e) => setEdit({ ...e0, kind: e.target.value as CalEventIn['kind'] })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="Starts"><Input type="datetime-local" value={local(new Date(e0.start))} onChange={(e) => e.target.value && setEdit({ ...e0, start: new Date(e.target.value).toISOString() })} /></Field>
          <Field label="Ends"><Input type="datetime-local" value={local(new Date(e0.end))} onChange={(e) => e.target.value && setEdit({ ...e0, end: new Date(e.target.value).toISOString() })} /></Field>
          <Field label="Notes"><Textarea value={e0.notes} onChange={(e) => setEdit({ ...e0, notes: e.target.value })} /></Field>
          {e0.id && <Btn variant="danger" onClick={() => confirmThen('Delete this event?', () => { void remove(e0.id!); setEdit(null); })}>Delete event</Btn>}
        </Modal>)}
    </Page>
  );
}
