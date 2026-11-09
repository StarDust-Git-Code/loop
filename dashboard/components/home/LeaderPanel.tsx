'use client';
// The leader's watch on Home: what it keeps an eye on, what it raised, and when it may call.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../lib/hooks';
import { mateImg } from '../../lib/mates';
import type { LeaderState } from '../../lib/types';
import { useToast } from '../ui/toast';
import s from './home.module.css';

const SCORE: Record<number, [string, string, string]> = { 1: ['Low', '#F1F4F8', '#475467'], 2: ['Digest', '#F1F4F8', '#334155'], 3: ['Message', '#EAF1FF', '#1F55E6'], 4: ['Now', '#FFF3D6', '#8A5A00'], 5: ['Called', '#FDE8E8', '#B42318'] };
const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60_000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const field = { height: 34, border: '1px solid var(--line)', borderRadius: 10, padding: '0 10px', font: 'inherit', fontSize: 13, background: '#fff' } as const;
const pill = { height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--line)', background: '#fff', fontSize: 12.5, fontWeight: 600 } as const;

export function LeaderPanel() {
  const toast = useToast(); const { settings, update } = useSettings();
  const [st, setSt] = useState<LeaderState | null>(null); const [err, setErr] = useState('');
  const [topic, setTopic] = useState(''); const [repo, setRepo] = useState(''); const [feed, setFeed] = useState(''); const [open, setOpen] = useState(false);
  const load = useCallback(() => api.leader.get().then((x) => { setSt(x); setErr(''); }).catch((e: Error) => setErr(e.message)), []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 60_000); return () => clearInterval(t); }, [load]);
  const add = async (kind: 'topic' | 'github' | 'feed') => {
    const label = kind === 'topic' ? `News: ${topic}` : kind === 'feed' ? `Feed: ${feed.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}` : `GitHub: ${repo || 'my repos'}`;
    const config = kind === 'topic' ? { query: topic.trim() } : kind === 'feed' ? { url: feed.trim() } : repo.trim() ? { repo: repo.trim() } : {};
    try { await api.watches.create({ kind, label, config, everyMinutes: kind === 'topic' ? 180 : kind === 'feed' ? 60 : 15, enabled: true }); setTopic(''); setRepo(''); setFeed(''); toast('Watching'); void load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not add', 'bad'); }
  };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (err && !st) return <section className={s.panel}><div className={s.panelHead}><h2 className={s.h3}>Keeping watch</h2></div><p className={s.empty}>{err}</p></section>;
  if (!st) return null;
  return (
    <section aria-labelledby="watch" className={s.panel} style={{ flexBasis: '100%' }}>
      <div className={s.panelHead} style={{ gap: 10, alignItems: 'center' }}>
        <img src={mateImg(st.leader)} alt="" width={28} height={28} />
        <h2 id="watch" className={s.h3}>{st.name} is keeping watch</h2>
        <div className={s.grow} />
        <button type="button" onClick={() => setOpen(!open)} style={{ ...pill }} aria-expanded={open}>{open ? 'Done' : 'Watch settings'}</button>
      </div>
      <p className={s.itemMeta} style={{ margin: '0 0 8px' }}>Messages you about important things and calls only for urgent ones{settings ? `, at most ${settings.maxCallsPerDay} calls a day${settings.quietHoursOn ? `, never in quiet hours${settings.urgentBreaksQuiet ? ' unless urgent' : ''}` : ''}` : ''}.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {st.watches.map((w) => (
          <span key={w.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 12px', borderRadius: 999, background: w.enabled === false ? '#F1F4F8' : 'var(--tint)', color: w.enabled === false ? '#667085' : 'var(--accent-ink)', fontSize: 12.5, fontWeight: 600 }}>
            {w.label}
            {open && <button type="button" aria-label={`${w.enabled === false ? 'Resume' : 'Pause'} ${w.label}`} onClick={() => api.watches.update(w.id, { enabled: w.enabled === false }).then(load)} style={{ border: 0, background: 'none', color: 'inherit', padding: '0 4px', fontSize: 12 }}>{w.enabled === false ? 'Resume' : 'Pause'}</button>}
            {open && w.createdBy !== 'default' && <button type="button" aria-label={`Stop watching ${w.label}`} onClick={() => api.watches.remove(w.id).then(load)} style={{ border: 0, background: 'none', color: 'inherit', padding: '0 4px', fontSize: 14 }}>×</button>}
          </span>))}
      </div>
      {open && settings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0', borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)', margin: '6px 0' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input style={{ ...field, flex: '1 1 220px' }} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Watch news or keywords, e.g. competitor funding" aria-label="Topic to watch" />
            <button type="button" style={pill} disabled={!topic.trim()} onClick={() => void add('topic')}>Watch topic</button>
            <input style={{ ...field, flex: '1 1 160px' }} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo (empty = allowed repos)" aria-label="GitHub repository to watch" />
            <button type="button" style={pill} onClick={() => void add('github')}>Watch GitHub</button>
            <input style={{ ...field, flex: '1 1 220px' }} value={feed} onChange={(e) => setFeed(e.target.value)} placeholder="RSS, Atom or YouTube channel feed address" aria-label="Feed to watch" />
            <button type="button" style={pill} disabled={!/^https?:\/\//.test(feed.trim())} onClick={() => void add('feed')}>Watch feed</button>
          </div>
          <p className={s.itemMeta} style={{ margin: 0 }}>Home Assistant devices: ask {st.name} in chat, e.g. &ldquo;tell me if the garage door is open for more than 10 minutes&rdquo;.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!settings.standupOn} onChange={(e) => void update({ standupOn: e.target.checked })} />Weekly team stand-up on</label>
            <select style={{ ...field, width: 130 }} value={settings.standupDay ?? 1} onChange={(e) => void update({ standupDay: Number(e.target.value) })} aria-label="Stand-up day">{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
            <input type="time" style={{ ...field, width: 110 }} value={settings.standupAt ?? '09:00'} onChange={(e) => void update({ standupAt: e.target.value })} aria-label="Stand-up time" />
            <button type="button" style={pill} onClick={() => api.leader.standup().then(() => toast('Stand-up sent')).catch((e: Error) => toast(e.message, 'bad'))}>Run one now</button>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
            <label>Calls a day <input type="number" min={0} max={20} style={{ ...field, width: 64 }} value={settings.maxCallsPerDay} onChange={(e) => void update({ maxCallsPerDay: Number(e.target.value) })} /></label>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={settings.urgentBreaksQuiet} onChange={(e) => void update({ urgentBreaksQuiet: e.target.checked })} />Urgent calls may ring in quiet hours</label>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={settings.briefingOn} onChange={(e) => void update({ briefingOn: e.target.checked })} />Morning briefing at</label>
            <input type="time" style={{ ...field, width: 110 }} value={settings.briefingAt} onChange={(e) => void update({ briefingAt: e.target.value })} aria-label="Briefing time" />
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={settings.briefingCall} onChange={(e) => void update({ briefingCall: e.target.checked })} />as a call</label>
            <button type="button" style={pill} onClick={() => api.leader.briefing().then(() => toast('Briefing sent')).catch((e: Error) => toast(e.message, 'bad'))}>Send one now</button>
          </div>
        </div>)}
      {st.alerts.length === 0 ? <p className={s.empty}>Nothing to report yet.</p> : st.alerts.slice(0, open ? 20 : 5).map((a) => { const [label, bg, fg] = SCORE[a.score] ?? SCORE[2]; return (
        <a key={a.id} href={a.url || '#'} className={s.item} style={{ textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: bg, color: fg, flex: 'none' }}>{a.delivered === 'held' ? 'Held' : label}</span>
          <span className={s.itemText}><span className={s.itemTitle}>{a.title}</span><span className={s.itemMeta} style={{ display: 'block' }}>{a.source} · {ago(a.at)}{a.delivered === 'call' ? ' · rang you' : a.delivered === 'notify' ? ' · messaged you' : ' · in your briefing'}</span></span>
        </a>); })}
    </section>
  );
}
