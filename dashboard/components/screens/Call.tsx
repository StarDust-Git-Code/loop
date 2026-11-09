'use client';
import { useAgents } from '../../lib/agents';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MATES, mateImg } from '../../lib/mates';
import { startCall, voiceUrl, type CallHandle } from '../../lib/voice';
import type { CallReport, MateKey } from '../../lib/types';
import { api } from '../../lib/api';
import { useServer } from '../../lib/server';
import { Icon } from '../ui/Icon';
import s from './call.module.css';

type Line = { who: 'you' | 'mate'; text: string };
const ENDED: Record<string, string> = { silence: 'The call ended after 90 seconds of silence.', 'time limit': 'The call reached its 10-minute limit.', done: '', hangup: '', closed: '' };

/** Calls your Mates have set a timer for (schedule_call), and ones held back by quiet hours. */
function Scheduled() {
  const [rows, setRows] = useState<CallReport[]>([]);
  const load = useCallback(() => api.calls.list().then((r) => setRows(r.filter((c) => c.status === 'scheduled' || c.status === 'held'))).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);
  if (!rows.length) return null;
  return (
    <div className={s.note} role="region" aria-label="Scheduled calls">
      <b>Calls coming up</b>
      {rows.map((c) => (
        <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 13 }}>
          <span style={{ flex: 1 }}>{c.mateName ?? MATES[c.mate]?.name}: {c.reason} · {c.status === 'held' ? 'held for quiet hours' : new Date(c.scheduledFor ?? '').toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          {c.status === 'held' && <Link href={`/call?mate=${c.mate}&call=${c.id}&reason=${encodeURIComponent(c.reason ?? '')}`}>Answer</Link>}
          <button type="button" onClick={() => api.calls.cancel(c.id).then(load)} style={{ border: 0, background: 'none', color: '#B42318', fontWeight: 600 }}>Cancel</button>
        </div>))}
    </div>
  );
}

export function Call() {
  const { defs: AGENTS, leader } = useAgents();
  const qp = useSearchParams();
  const server = useServer();
  // A ring from a Mate (call_me) arrives with a mission id and a reason. They are used for one call only.
  const [mission, setMission] = useState(() => ({ call: qp.get('call') ?? '', reason: qp.get('reason') ?? '' }));
  const [picked, setMate] = useState<MateKey | null>((qp.get('mate') as MateKey) || null);
  const mate: MateKey = picked ?? leader;
  const [state, setState] = useState<'idle' | 'connecting' | 'live'>('idle');
  const [err, setErr] = useState(''); const [ended, setEnded] = useState('');
  const [lines, setLines] = useState<Line[]>([]); const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0); const [lvl, setLvl] = useState(0); const [tool, setTool] = useState('');
  const [report, setReport] = useState<CallReport | null>(null);
  const [incoming, setIncoming] = useState<CallReport | null>(null);
  const h = useRef<CallHandle | null>(null); const end = useRef<HTMLDivElement>(null);
  const conv = qp.get('conv') ?? '';

  useEffect(() => { if (state !== 'live') return; const t0 = Date.now(); const t = setInterval(() => { setSecs(Math.floor((Date.now() - t0) / 1000)); setLvl(h.current?.level() ?? 0); }, 250); return () => clearInterval(t); }, [state]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [lines]);
  useEffect(() => () => h.current?.hangup(), []);
  useEffect(() => { if (mission.call) api.calls.get(mission.call).then((c) => setIncoming(c ?? null)).catch(() => {}); }, [mission.call]);

  const add = (who: Line['who'], text: string) => setLines((ls) => (ls.at(-1)?.who === who ? [...ls.slice(0, -1), { who, text: ls.at(-1)!.text + text }] : [...ls, { who, text }]));
  async function dial() {
    const { call: callId, reason } = mission;
    setMission({ call: '', reason: '' }); setIncoming(null);
    setErr(''); setEnded(''); setLines([]); setSecs(0); setReport(null); setMuted(false); setState('connecting');
    try {
      h.current = await startCall(mate, reason, (e) => {
        if (e.type === 'ready') setState('live');
        else if (e.type === 'tool') { setTool(e.name); setTimeout(() => setTool(''), 2500); }
        else if (e.type === 'transcript') add(e.who, e.text);
        else if (e.type === 'error') { setErr(e.message); setState('idle'); }
        else if (e.type === 'end') {
          setState('idle'); h.current = null;
          setEnded(e.why in ENDED ? ENDED[e.why] : `The call ended: ${e.why}`);
          if (callId) { let n = 0; const poll = async () => { const r = await api.calls.get(callId).catch(() => undefined); if (r?.report) setReport(r); else if (n++ < 8) setTimeout(() => void poll(), 2000); }; setTimeout(() => void poll(), 2000); }
        }
      }, conv, callId);
    } catch (e) {
      setErr(e instanceof Error ? (e.name === 'NotAllowedError' ? 'Loopmates needs your microphone. Allow it in the address bar, then call again.' : e.message) : 'Could not start the call.');
      setState('idle');
    }
  }
  const mm = String(Math.floor(secs / 60)).padStart(2, '0'), ss = String(secs % 60).padStart(2, '0');
  const live = state === 'live';
  const noServer = !voiceUrl();
  const offline = server.status === 'offline';
  const canDial = !noServer && !offline && state === 'idle';

  return (
    <main className={s.page}>
      <section className={s.stage} aria-label="Call">
        {noServer && <div className={`${s.note} ${s.warn}`}>Calls go through your Loopmates server, and it is not paired yet. <Link href="/server">Pair it</Link>.</div>}
        {offline && !noServer && <div className={`${s.note} ${s.warn}`}>Your Loopmates server is offline, so calls cannot connect. Start it on your computer.</div>}
        {err && <div className={`${s.note} ${s.bad}`} role="alert">{err}</div>}
        {state === 'idle' && <Scheduled />}
        {incoming && state === 'idle' && (
          <div className={s.incoming} role="status">
            <b>{MATES[incoming.mate]?.name ?? 'A Mate'} is calling</b>
            <p>{mission.reason || incoming.goal}</p>
            {incoming.questions.length > 0 && <ul>{incoming.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>}
          </div>
        )}
        <div className={s.ring}>
          <span aria-hidden="true" className={s.halo} style={{ opacity: live ? 1 : 0.5, transform: `scale(${live ? 1 + Math.min(lvl * 1.4, 0.3) : 0.9})` }} />
          <span aria-hidden="true" className={s.halo2} />
          <img src={mateImg(mate)} alt="" />
        </div>
        <div className={s.who}>
          <h1 className={s.name}>{MATES[mate].name}</h1>
          <div className={s.state} aria-live="polite">
            {live ? <><span className={s.liveDot} aria-hidden="true" />On the call · {mm}:{ss}</> : state === 'connecting' ? 'Connecting…' : MATES[mate].blurb}
          </div>
        </div>
        <div className={s.controls}>
          {state === 'idle' ? (
            <button type="button" className={s.dial} onClick={() => void dial()} disabled={!canDial}>
              <Icon name="phone" />{incoming ? 'Answer' : `Call ${MATES[mate].name}`}
            </button>
          ) : (
            <>
              <button type="button" className={s.round} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => { h.current?.mute(!muted); setMuted(!muted); }}><Icon name={muted ? 'micoff' : 'mic'} /></button>
              <button type="button" className={s.hang} aria-label="Hang up" onClick={() => h.current?.hangup()}><Icon name="hangup" /></button>
            </>
          )}
        </div>
        {tool && <span className={s.tool}>Using {tool.replace(/_/g, ' ')}…</span>}
        {ended && state === 'idle' && <p className={s.sub}>{ended}</p>}
        {report?.report && (
          <div className={s.report} role="status">
            <h3>Report sent to {MATES[report.mate]?.name}</h3>
            <p>{report.report.summary}</p>
            {report.report.answers.length > 0 && <ul>{report.report.answers.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          </div>
        )}
        {lines.length > 0 && (
          <div className={s.transcript} aria-live="polite" aria-label="Transcript">
            {lines.map((l, i) => <div key={i} className={l.who === 'you' ? s.you : s.mate}>{l.text}</div>)}
            <div ref={end} />
          </div>
        )}
      </section>

      <aside className={s.side}>
        <div className={s.sideHead}><h2 className={s.h2}>Who to call</h2><span className={s.sub}>each has its own voice</span></div>
        <div className={s.grid}>
          {AGENTS.map((d) => (
            <button key={d.key} type="button" className={s.pick} aria-pressed={mate === d.key} disabled={state !== 'idle'} onClick={() => setMate(d.key)}>
              <img src={mateImg(d.key)} alt="" />{d.name}
            </button>
          ))}
        </div>
        <p className={s.sub}>Calls last up to 10 minutes. Say “put it in the chat” for anything long; the Mate writes it there after the call.</p>
      </aside>
    </main>
  );
}
