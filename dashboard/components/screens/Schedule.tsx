'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { parseWhen } from '../../lib/parse';
import type { CalEvent, CalEventIn } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Btn, confirmThen, ErrorNote, Field, Input, Modal, Page, Select, Tabs, Textarea, Toggle } from '../ui/ui';

type View = 'day' | 'week' | 'month'; type K = CalEventIn['kind'];
const KINDS: K[] = ['event', 'reminder', 'run', 'automation'];
const CAL: Record<K, { label: string; bg: string; bd: string }> = { event: { label: 'You', bg: '#ECE7FF', bd: '#8E78F6' }, run: { label: 'Agents', bg: '#DFF3E3', bd: '#4DA36A' }, automation: { label: 'Automations', bg: '#FFF3D6', bd: '#D79A2B' }, reminder: { label: 'Reminders', bg: '#E3F0FF', bd: '#5B9BE0' } };
const H0 = 6, H1 = 22, HP = 52;
const startOf = (d: Date, v: View) => { const x = new Date(d); x.setHours(0, 0, 0, 0); if (v === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); if (v === 'month') { x.setDate(1); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); } return x; };
const addD = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const hm = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export function Schedule() {
  const { items, error, create, update, remove } = useRepo(api.events); const toast = useToast();
  const [view, setView] = useState<View>('week'); const [anchor, setAnchor] = useState(() => new Date());
  const [edit, setEdit] = useState<(CalEventIn & { id?: string }) | null>(null); const [typed, setTyped] = useState('');
  const [hide, setHide] = useState<K[]>([]); const [tick, setTick] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setTick(new Date()), 60000); return () => clearInterval(t); }, []);
  const first = startOf(anchor, view); const n = view === 'day' ? 1 : 7;
  const days = Array.from({ length: n }, (_, i) => addD(view === 'day' ? new Date(new Date(anchor).setHours(0, 0, 0, 0)) : first, i));
  const shift = (s: number) => setAnchor((a) => { const d = new Date(a); if (view === 'month') d.setMonth(d.getMonth() + s); else d.setDate(d.getDate() + s * (view === 'week' ? 7 : 1)); return d; });
  const title = view === 'month' ? anchor.toLocaleDateString([], { month: 'long', year: 'numeric' }) : view === 'day' ? anchor.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) : `${days[0].toLocaleDateString([], { day: 'numeric', month: 'short' })} to ${days[6].toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
  const draft = (d: Date, h = 9): CalEventIn => { const a = new Date(d); a.setHours(h, 0, 0, 0); return { title: '', notes: '', kind: 'event', start: a.toISOString(), end: new Date(a.getTime() + 36e5).toISOString() }; };
  const save = async () => { if (!edit) return; const { id, ...d } = edit; await (id ? update(id, d) : create(d)); setEdit(null); };
  const vis = items.filter((e) => !hide.includes(e.kind));
  const on = (d: Date) => vis.filter((e) => new Date(e.start).toDateString() === d.toDateString()).sort((a, b) => a.start.localeCompare(b.start));
  const p = typed.trim() ? parseWhen(typed) : null;
  const add = async () => { if (!p) return; await create({ title: p.title, start: p.start.toISOString(), end: p.end.toISOString(), kind: 'event', notes: '' }); setTyped(''); setAnchor(p.start); toast('Added to your schedule'); };
  const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
  const e0 = edit;

  const block = (e: CalEvent, lane: number, lanes: number) => { const s = new Date(e.start), en = new Date(e.end); const top = Math.max(0, ((s.getHours() - H0) + s.getMinutes() / 60) * HP); const h = Math.max(24, ((en.getTime() - s.getTime()) / 36e5) * HP - 2); const c = CAL[e.kind]; return (
    <button key={e.id} onClick={() => setEdit(e)} style={{ position: 'absolute', top, height: h, left: `calc(${(lane / lanes) * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)`, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 7, padding: '3px 7px', textAlign: 'left', font: 'inherit', fontSize: 12, overflow: 'hidden', cursor: 'pointer', animation: 'lm-pop .3s both', transition: 'transform .15s, box-shadow .15s' }} onMouseEnter={(x) => (x.currentTarget.style.boxShadow = '0 4px 14px rgba(31,26,23,.15)')} onMouseLeave={(x) => (x.currentTarget.style.boxShadow = '')}><b style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</b><span style={{ color: '#6B6572', fontSize: 11 }}>{hm(s)} · {c.label}</span></button>); };
  const lanesFor = (list: CalEvent[]) => { const out: { e: CalEvent; lane: number; lanes: number }[] = []; let grp: { e: CalEvent; lane: number }[] = []; let end = 0; const flush = () => { const m = Math.max(1, ...grp.map((g) => g.lane + 1)); grp.forEach((g) => out.push({ ...g, lanes: m })); grp = []; };
    for (const e of list) { const s = new Date(e.start).getTime(); if (grp.length && s >= end) { flush(); end = 0; } const used = grp.filter((g) => new Date(g.e.end).getTime() > s).map((g) => g.lane); let lane = 0; while (used.includes(lane)) lane++; grp.push({ e, lane }); end = Math.max(end, new Date(e.end).getTime()); } flush(); return out; };

  return (
    <Page fill crumb={<><Link href="/my-space" style={{ color: 'inherit' }}>My Space</Link> / Schedule</>} title={title} actions={<>
      <Btn aria-label="Previous" onClick={() => shift(-1)}>‹</Btn><Btn aria-label="Next" onClick={() => shift(1)}>›</Btn><Btn onClick={() => setAnchor(new Date())}>Today</Btn>
      <Tabs value={view} onChange={setView} options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} />
      <Btn variant="primary" onClick={() => setEdit(draft(anchor))}>+ New event</Btn></>}>
      <ErrorNote message={error} />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(260px,360px)', gap: 18 }}>
        <div key={view} style={{ background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, overflow: 'auto', minHeight: 0, animation: 'lm-up .3s ease both' }}>
          {view !== 'month' ? (
            <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${n},minmax(90px,1fr))`, minWidth: n * 100 + 56 }}>
              <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 3, borderBottom: '1px solid rgba(31,26,23,.08)' }} />
              {days.map((d) => { const t = d.toDateString() === tick.toDateString(); return <div key={d.toISOString()} style={{ position: 'sticky', top: 0, zIndex: 3, textAlign: 'center', padding: '8px 0', borderBottom: '1px solid rgba(31,26,23,.08)', borderLeft: '1px solid rgba(31,26,23,.08)', background: t ? '#F4F0FF' : '#fff', color: t ? '#4F34D6' : 'inherit' }}><div style={{ fontSize: 12, color: t ? '#4F34D6' : '#6B6572' }}>{d.toLocaleDateString([], { weekday: 'short' })}</div><b style={{ fontSize: 18 }}>{d.getDate()}</b></div>; })}
              <div>{hours.map((h) => <div key={h} className="mono" style={{ height: HP, fontSize: 11, color: '#6B6572', textAlign: 'right', paddingRight: 8, transform: 'translateY(-7px)' }}>{String(h).padStart(2, '0')}:00</div>)}</div>
              {days.map((d) => { const t = d.toDateString() === tick.toDateString(); const list = lanesFor(on(d)); const ny = ((tick.getHours() - H0) + tick.getMinutes() / 60) * HP;
                return (
                  <div key={d.toISOString()} style={{ position: 'relative', height: hours.length * HP, borderLeft: '1px solid rgba(31,26,23,.08)', background: t ? '#FAF8FF' : 'none' }}>
                    {hours.map((h) => <div key={h} onClick={() => setEdit(draft(d, h))} aria-label={`Add event ${d.toDateString()} ${h}:00`} style={{ height: HP, borderTop: '1px solid rgba(31,26,23,.06)', cursor: 'pointer' }} />)}
                    {list.map((x) => block(x.e, x.lane, x.lanes))}
                    {t && ny >= 0 && ny <= hours.length * HP && <div style={{ position: 'absolute', left: 0, right: 0, top: ny, height: 2, background: '#D8542B', pointerEvents: 'none' }}><i style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#D8542B' }} /></div>}
                  </div>); })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(90px,1fr))', gridAutoRows: 'minmax(110px,1fr)', minHeight: '100%' }}>
              {Array.from({ length: 42 }, (_, i) => addD(first, i)).map((d) => { const t = d.toDateString() === tick.toDateString(); const list = on(d); return (
                <div key={d.toISOString()} onClick={() => setEdit(draft(d))} style={{ borderTop: '1px solid rgba(31,26,23,.07)', borderLeft: '1px solid rgba(31,26,23,.07)', padding: 6, background: t ? '#F4F0FF' : 'none', opacity: d.getMonth() === anchor.getMonth() ? 1 : 0.45, cursor: 'pointer', minWidth: 0 }}>
                  <b style={{ fontSize: 12.5, color: t ? '#4F34D6' : 'inherit' }}>{d.getDate()}</b>
                  {list.slice(0, 3).map((e) => <button key={e.id} onClick={(x) => { x.stopPropagation(); setEdit(e); }} style={{ display: 'block', width: '100%', textAlign: 'left', border: `1px solid ${CAL[e.kind].bd}`, background: CAL[e.kind].bg, borderRadius: 6, margin: '3px 0 0', padding: '1px 6px', fontSize: 11.5, font: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{e.title}</button>)}
                  {list.length > 3 && <span style={{ fontSize: 11.5, color: '#6B6572' }}>+{list.length - 3} more</span>}
                </div>); })}
            </div>)}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', minHeight: 0 }}>
          <section style={{ background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, padding: 18 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: '#3D3946', margin: '0 0 10px' }}>ADD BY TYPING</p>
            <form onSubmit={(e) => { e.preventDefault(); void add(); }}><input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Add by typing" placeholder="Review Loop design Saturday 6pm" style={{ width: '100%', height: 44, border: '1px solid rgba(27,24,34,.17)', borderRadius: 10, padding: '0 14px', font: 'inherit', fontSize: 14.5, background: '#F4F2FA' }} /></form>
            {p && <div style={{ background: '#F4F0FF', border: '1px solid rgba(106,77,244,.25)', borderRadius: 12, padding: 14, marginTop: 12, animation: 'lm-pop .3s both' }}>
              <div style={{ fontSize: 12.5, color: '#4F34D6', fontWeight: 600 }}>Here is what I understood</div><b style={{ display: 'block', fontSize: 16, margin: '2px 0' }}>{p.title}</b>
              <div style={{ fontSize: 13, color: '#3D3946' }}>{p.start.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · {hm(p.start)} to {hm(p.end)}{p.understood ? '' : ' (no day or time found, using 09:00 today)'}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}><Btn style={{ flex: 1 }} onClick={() => { setEdit({ title: p.title, notes: '', kind: 'event', start: p.start.toISOString(), end: p.end.toISOString() }); setTyped(''); }}>Edit details</Btn><Btn variant="primary" style={{ flex: 1 }} onClick={add}>Add to schedule</Btn></div></div>}
          </section>
          <section style={{ background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, padding: 18 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: '#6B6572', margin: '0 0 6px' }}>CALENDARS</p>
            {KINDS.map((k) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid rgba(31,26,23,.08)', fontSize: 14.5 }}><i style={{ width: 14, height: 14, borderRadius: 4, background: CAL[k].bg, border: `1.5px solid ${CAL[k].bd}` }} /><span style={{ flex: 1 }}>{CAL[k].label}</span><Toggle label={`Show ${CAL[k].label}`} checked={!hide.includes(k)} onChange={(v) => setHide((h) => (v ? h.filter((x) => x !== k) : [...h, k]))} /></div>)}
          </section>
          {items.length === 0 && <p style={{ color: '#6B6572', fontSize: 13.5, lineHeight: 1.55, margin: '0 4px' }}>Nothing scheduled yet. Click any slot on the grid, or type an event above.</p>}
        </aside>
      </div>
      {e0 && (
        <Modal title={e0.id ? 'Edit event' : 'New event'} onClose={() => setEdit(null)} onSubmit={save} canSubmit={!!e0.title.trim() && e0.end > e0.start}>
          <Field label="Title"><Input autoFocus value={e0.title} onChange={(e) => setEdit({ ...e0, title: e.target.value })} /></Field>
          <Field label="Calendar"><Select value={e0.kind} onChange={(e) => setEdit({ ...e0, kind: e.target.value as K })}>{KINDS.map((k) => <option key={k} value={k}>{CAL[k].label}</option>)}</Select></Field>
          <Field label="Starts"><Input type="datetime-local" value={local(new Date(e0.start))} onChange={(e) => e.target.value && setEdit({ ...e0, start: new Date(e.target.value).toISOString() })} /></Field>
          <Field label="Ends"><Input type="datetime-local" value={local(new Date(e0.end))} onChange={(e) => e.target.value && setEdit({ ...e0, end: new Date(e.target.value).toISOString() })} /></Field>
          <Field label="Notes"><Textarea value={e0.notes} onChange={(e) => setEdit({ ...e0, notes: e.target.value })} /></Field>
          {e0.id && <Btn variant="danger" onClick={() => confirmThen('Delete this event?', () => { void remove(e0.id!); setEdit(null); })}>Delete event</Btn>}
        </Modal>)}
    </Page>
  );
}
