'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { day } from '../../lib/format';
import { useRepo, useSettings } from '../../lib/hooks';
import { mateImg } from '../../lib/mates';
import { parseWhen } from '../../lib/parse';
import type { MemoryIn } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Btn, Chips, confirmThen, ErrorNote, Field, Modal, Page, Tabs, Textarea, Toggle } from '../ui/ui';
import { Icon } from '../ui/Icon';

type Kind = MemoryIn['kind'];
type Filter = 'all' | Kind;
const KC: Record<Kind, [string, string]> = { decision: ['#ECE7FF', '#4F34D6'], idea: ['#FFF3D6', '#8A5A00'], fact: ['#E3EEFF', '#2B4BC0'], journal: ['#FDE8EE', '#B3265A'], link: ['#DFF3E3', '#1E7A46'], note: ['#F1EFF6', '#3D3946'] };
const card = { background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, boxShadow: '0 2px 6px rgba(31,26,23,.05)' } as const;
const cap = { fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: '#3D3946', margin: 0 } as const;
const TAG = { event: ['You', '#ECE7FF', '#4F34D6'], reminder: ['You', '#ECE7FF', '#4F34D6'], run: ['Agent', '#E6F4EA', '#1E7A46'], automation: ['Automation', '#FFF3D6', '#8A5A00'] } as const;
const QUICK = ['Plan my day', 'What did I forget?', 'Add a memory', 'Summarise my week'];

export function MySpace() {
  const router = useRouter();
  const mem = useRepo(api.memories), ev = useRepo(api.events), convs = useRepo(api.conversations);
  const { settings, update } = useSettings(); const toast = useToast();
  const [tab, setTab] = useState<'journal' | 'recall'>('journal'); const [f, setF] = useState<Filter>('all'); const [q, setQ] = useState('');
  const [text, setText] = useState(''); const [sched, setSched] = useState(''); const [add, setAdd] = useState<MemoryIn | null>(null); const [recall, setRecall] = useState('');
  const today = day(new Date());
  const todays = ev.items.filter((e) => day(new Date(e.start)) === today).sort((a, b) => a.start.localeCompare(b.start));
  const conv = convs.items.find((c) => c.mate === 'mimo');
  const shown = mem.items.filter((m) => (f === 'all' || m.kind === f) && m.text.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt));
  const found = recall.trim() ? mem.items.filter((m) => m.text.toLowerCase().includes(recall.toLowerCase())) : [];

  const openMimo = async (draft?: string) => {
    let c = conv; if (!c) c = await convs.create({ title: 'Chat with Mimo', mate: 'mimo', messages: [], mode: 'chat', members: [] });
    router.push(`/chat?c=${c.id}${draft ? `&draft=${encodeURIComponent(draft)}` : ''}`);
  };
  const journal = async () => { if (!text.trim()) return; await mem.create({ kind: 'journal', text: text.trim(), scope: 'private' }); setText(''); toast('Saved to your journal'); };
  const addEvent = async () => { const p = parseWhen(sched); await ev.create({ title: p.title, start: p.start.toISOString(), end: p.end.toISOString(), kind: 'event', notes: '' }); setSched(''); toast(`Added for ${p.start.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`); };
  const preview = sched.trim() ? parseWhen(sched) : null;
  const scopeLine = (m: MemoryIn) => (m.scope === 'shared' ? 'Shared with Mates' : 'Only Mimo');

  return (
    <Page fill title="My Space" sub="Your private second brain: today's schedule, memories, journal and recall. Talk to Mimo in Chat." actions={<><span style={{ background: '#F1ECFF', color: '#4F34D6', borderRadius: 99, padding: '8px 16px', fontSize: 13, fontWeight: 600 }}><Icon name="lock" size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Private. Other Mates see only what you share.</span><Btn variant="primary" onClick={() => setAdd({ kind: 'idea', text: '', scope: 'private' })}>+ Add memory</Btn></>}>
      <ErrorNote message={mem.error ?? ev.error} />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(260px,330px) minmax(0,1fr) minmax(280px,380px)', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          <section style={{ ...card, padding: 20, flex: 1, minHeight: 0, overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}><b style={{ fontSize: 18, flex: 1 }}>Today</b><span style={{ color: '#6B6572', fontSize: 13 }}>{new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
            {todays.length === 0 ? <p style={{ color: '#6B6572', fontSize: 13.5, lineHeight: 1.5 }}>Nothing scheduled today. Add something below, like “Gym tomorrow at 6am”.</p> : todays.map((e, i) => { const t = TAG[e.kind]; return (
              <div key={e.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: i ? '1px solid rgba(31,26,23,.08)' : 0, animation: `lm-up .3s ${i * 30}ms ease both` }}>
                <span className="mono" style={{ fontSize: 12.5, color: '#3D3946', paddingTop: 2 }}>{new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14.5 }}>{e.title}</b><div style={{ color: '#6B6572', fontSize: 12.5 }}>{e.notes || 'Added by you'}</div></div>
                <span style={{ background: t[1], color: t[2], borderRadius: 6, padding: '2px 8px', fontSize: 12, height: 22, fontWeight: 600 }}>{t[0]}</span>
              </div>); })}
          </section>
          <section style={{ ...card, padding: 18 }}>
            <p style={{ ...cap, marginBottom: 10, color: '#6B6572' }}>ADD TO SCHEDULE</p>
            <form onSubmit={(e) => { e.preventDefault(); if (sched.trim()) void addEvent(); }} style={{ display: 'flex', gap: 10 }}>
              <input value={sched} onChange={(e) => setSched(e.target.value)} aria-label="Add to schedule" placeholder="Gym tomorrow at 6am" style={{ flex: 1, minWidth: 0, height: 44, border: '1px solid rgba(27,24,34,.17)', borderRadius: 10, padding: '0 14px', font: 'inherit', fontSize: 14.5, background: '#F4F2FA' }} />
              <button type="submit" aria-label="Add" disabled={!sched.trim()} style={{ width: 44, height: 44, borderRadius: 10, border: 0, background: '#6A4DF4', color: '#fff', fontSize: 20, opacity: sched.trim() ? 1 : 0.4, cursor: 'pointer' }}>+</button>
            </form>
            <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#6B6572' }}>{preview ? `${preview.title} · ${preview.start.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}${preview.understood ? '' : ' (no time found, using 09:00 today)'}` : 'Type a task with a day and time.'}</p>
          </section>
        </div>

        <section style={{ ...card, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(160deg,#FFE6EE,#FFF3F6)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <img src={mateImg('mimo')} alt="" width={46} height={46} style={{ display: 'block', margin: '0 auto 6px', animation: 'lm-bob 3.6s ease-in-out infinite' }} />
            <div style={{ flex: 1, minWidth: 180 }}><b style={{ fontSize: 18 }}>Mimo</b><div style={{ color: '#6B6572', fontSize: 13 }}>Your second-brain buddy. Remembers, reminds, and talks things through.</div></div>
            <Tabs value={tab} onChange={setTab} options={[{ id: 'journal', label: 'Journal' }, { id: 'recall', label: 'Recall' }]} />
          </div>
          <div key={tab} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, animation: 'lm-up .3s ease both' }}>
            {tab === 'journal' && <><p style={{ color: '#6B6572', margin: 0, fontSize: 14 }}>A private place to write. Entries are saved as Journal memories, visible only to you.</p><Textarea style={{ minHeight: 180 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="How did today go?" aria-label="Journal entry" /><Btn variant="primary" style={{ alignSelf: 'flex-start' }} disabled={!text.trim()} onClick={journal}>Save entry</Btn>
              {mem.items.filter((m) => m.kind === 'journal').slice(0, 5).map((m) => <div key={m.id} style={{ borderTop: '1px solid rgba(31,26,23,.08)', paddingTop: 10, fontSize: 14, lineHeight: 1.5 }}><span style={{ color: '#6B6572', fontSize: 12.5 }}>{new Date(m.createdAt).toLocaleDateString()}</span><div>{m.text}</div></div>)}</>}
            {tab === 'recall' && <><input value={recall} onChange={(e) => setRecall(e.target.value)} aria-label="Recall" placeholder="What are you trying to remember?" style={{ height: 44, border: '1px solid rgba(27,24,34,.17)', borderRadius: 10, padding: '0 14px', font: 'inherit', fontSize: 14.5 }} />
              {recall.trim() && (found.length === 0 ? <p style={{ color: '#6B6572' }}>Nothing matches “{recall}”. Meaning-based recall arrives with the backend; this searches your words.</p> : found.map((m) => <div key={m.id} style={{ borderRadius: 12, background: '#F4F2FA', padding: 12, fontSize: 14 }}><span style={{ background: KC[m.kind][0], color: KC[m.kind][1], borderRadius: 6, padding: '2px 8px', fontSize: 12, marginRight: 8 }}>{m.kind}</span>{m.text}</div>))}</>}
          </div>
          <div style={{ borderTop: '1px solid rgba(31,26,23,.08)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: '#6B6572' }}>Want to talk it through? Mimo lives in Chat, with the same memories you see here.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{QUICK.map((q2) => <button key={q2} onClick={() => (q2 === 'Add a memory' ? setAdd({ kind: 'note', text: '', scope: 'private' }) : void openMimo(q2))} style={{ border: '1px solid rgba(27,24,34,.17)', borderRadius: 99, padding: '7px 14px', background: '#F7F5FB', font: 'inherit', fontSize: 13.5, cursor: 'pointer', transition: 'background .15s' }}>{q2}</button>)}<button onClick={() => void openMimo()} style={{ border: 0, borderRadius: 99, padding: '7px 14px', background: '#6A4DF4', color: '#fff', font: 'inherit', fontSize: 13.5, cursor: 'pointer' }}>Open chat with Mimo</button></div>
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><b style={{ fontSize: 18, flex: 1 }}>Memories</b><img src={mateImg('recall')} alt="" width={30} /><span style={{ color: '#6B6572', fontSize: 12.5 }}>Recall finds them</span></div>
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search memories" placeholder="Search your memories" style={{ height: 44, border: '1px solid rgba(27,24,34,.17)', borderRadius: 12, padding: '0 14px', font: 'inherit', fontSize: 14.5, background: '#fff' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(['all', 'idea', 'decision', 'fact', 'journal', 'link'] as Filter[]).map((k) => <button key={k} onClick={() => setF(k)} style={{ border: '1px solid rgba(27,24,34,.17)', borderRadius: 99, padding: '5px 14px', font: 'inherit', fontSize: 13.5, cursor: 'pointer', background: f === k ? '#ECE7FF' : '#fff', color: f === k ? '#4F34D6' : 'inherit', borderColor: f === k ? 'rgba(106,77,244,.5)' : 'rgba(27,24,34,.17)', transition: 'all .2s', textTransform: 'capitalize' }}>{k === 'all' ? 'All' : `${k}s`.replace('journals', 'Journal').replace('links', 'Links')}</button>)}</div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mem.items.length === 0 ? <p style={{ color: '#6B6572', fontSize: 13.5, lineHeight: 1.55 }}>Nothing remembered yet. Press “Add memory”, or tell Mimo what to remember.</p> : shown.length === 0 ? <p style={{ color: '#6B6572', fontSize: 13.5 }}>No matches.</p> : shown.map((m, i) => (
              <article key={m.id} style={{ ...card, padding: '12px 16px', animation: `lm-up .3s ${Math.min(i, 6) * 30}ms ease both` }}>
                <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ background: KC[m.kind][0], color: KC[m.kind][1], borderRadius: 6, padding: '2px 8px', fontSize: 12, textTransform: 'capitalize' }}>{m.kind}</span><span style={{ marginLeft: 'auto', color: '#6B6572', fontSize: 12.5 }}>{m.pinned ? 'Pinned' : new Date(m.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span></div>
                <b style={{ display: 'block', fontSize: 14.5, margin: '8px 0', lineHeight: 1.4 }}>{m.text}</b>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B6572', fontSize: 12.5 }}><Icon name="lock" size={14} />{scopeLine(m)}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button onClick={() => mem.update(m.id, { pinned: !m.pinned })} style={{ border: 0, background: 'none', color: '#4F34D6', cursor: 'pointer', fontSize: 12.5 }}>{m.pinned ? 'Unpin' : 'Pin'}</button>
                    <button onClick={() => mem.update(m.id, { scope: m.scope === 'shared' ? 'private' : 'shared' })} style={{ border: 0, background: 'none', color: '#4F34D6', cursor: 'pointer', fontSize: 12.5 }}>{m.scope === 'shared' ? 'Make private' : 'Share'}</button>
                    <button aria-label="Delete memory" onClick={() => confirmThen('Delete this memory?', () => mem.remove(m.id))} style={{ border: 0, background: 'none', color: '#6B6572', cursor: 'pointer' }}><Icon name="close" size={16} /></button>
                  </span></div>
              </article>))}
          </div>
          <section style={{ ...card, padding: '14px 18px' }}>
            <p style={{ ...cap, color: '#6B6572', marginBottom: 6 }}>ABOUT ME</p>
            {!settings ? null : ([['Prefers short, clear answers', settings.prefersShort, (v: boolean) => update({ prefersShort: v })], ['Share my schedule with agents', settings.shareSchedule, (v: boolean) => update({ shareSchedule: v })]] as const).map(([l, v, fn]) => <div key={l} style={{ display: 'flex', alignItems: 'center', padding: '9px 0', borderTop: '1px solid rgba(31,26,23,.08)', fontSize: 14 }}><span style={{ flex: 1 }}>{l}</span><Toggle label={l} checked={v} onChange={fn} /></div>)}
            <div style={{ padding: '9px 0 2px', borderTop: '1px solid rgba(31,26,23,.08)', fontSize: 14 }}>Time zone: {settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
          </section>
        </div>
      </div>
      {add && <Modal title="Add a memory" submitLabel="Save memory" onClose={() => setAdd(null)} canSubmit={!!add.text.trim()} onSubmit={async () => { await mem.create(add); setAdd(null); toast('Memory saved'); }}>
        <Field label="Kind"><Chips options={['idea', 'decision', 'fact', 'journal', 'link', 'note'] as Kind[]} value={[add.kind]} onChange={(v) => setAdd({ ...add, kind: v[v.length - 1] ?? add.kind })} /></Field>
        <Field label="What should be remembered?"><Textarea autoFocus value={add.text} onChange={(e) => setAdd({ ...add, text: e.target.value })} /></Field>
        <Field label="Who can see it?"><Tabs value={add.scope} onChange={(v) => setAdd({ ...add, scope: v })} options={[{ id: 'private', label: 'Only me and Mimo' }, { id: 'shared', label: 'Share with Mates' }]} /></Field></Modal>}
    </Page>
  );
}
