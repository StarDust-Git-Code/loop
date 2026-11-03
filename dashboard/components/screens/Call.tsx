'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MATES, MATE_DEFS, mateImg, mateName } from '../../lib/mates';
import { startCall, VOICE_URL, type CallHandle } from '../../lib/voice';
import type { MateKey } from '../../lib/types';
import { Btn, ErrorNote, Page } from '../ui/ui';
import { Icon } from '../ui/Icon';

const Dot = ({ k, s }: { k: MateKey; s: number }) => <img src={mateImg(k)} alt="" width={s} height={s} />;

type Line = { who: 'you' | 'mate'; text: string };

export function Call() {
  const qp = useSearchParams();
  const reason = qp.get('reason') ?? '';
  const [mate, setMate] = useState<MateKey>((qp.get('mate') as MateKey) || 'mimo');
  const [state, setState] = useState<'idle' | 'connecting' | 'live'>('idle');
  const [err, setErr] = useState(''); const [lines, setLines] = useState<Line[]>([]); const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0); const [lvl, setLvl] = useState(0);
  const h = useRef<CallHandle | null>(null); const end = useRef<HTMLDivElement>(null);
  const conv = qp.get('conv') ?? '';
  const [tool, setTool] = useState('');

  useEffect(() => { if (state !== 'live') return; const t0 = Date.now(); const t = setInterval(() => { setSecs(Math.floor((Date.now() - t0) / 1000)); setLvl(h.current?.level() ?? 0); }, 250); return () => clearInterval(t); }, [state]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [lines]);
  useEffect(() => () => h.current?.hangup(), []);

  const add = (who: Line['who'], text: string) => setLines((ls) => (ls.at(-1)?.who === who ? [...ls.slice(0, -1), { who, text: ls.at(-1)!.text + text }] : [...ls, { who, text }]));
  async function dial() {
    setErr(''); setLines([]); setSecs(0); setState('connecting');
    try {
      h.current = await startCall(mate, reason, (e) => {
        if (e.type === 'ready') setState('live');
        else if (e.type === 'tool') { setTool(e.name); setTimeout(() => setTool(''), 2500); }
        else if (e.type === 'transcript') add(e.who, e.text);
        else if (e.type === 'error') { setErr(e.message); setState('idle'); }
        else if (e.type === 'end') { setState('idle'); if (e.why && !['closed', 'hangup'].includes(e.why)) setErr(e.why === 'silence' ? 'Call ended after a long silence.' : e.why === 'time limit' ? 'Call reached the time limit.' : e.why); }
      }, conv);
    } catch (e) { setErr(e instanceof Error ? (e.name === 'NotAllowedError' ? 'Microphone permission is needed to call.' : e.message) : 'Could not start the call.'); setState('idle'); }
  }
  const mm = String(Math.floor(secs / 60)).padStart(2, '0'), ss = String(secs % 60).padStart(2, '0');

  const live = state === 'live';
  const row: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8 };
  return (
    <Page title="Call" sub="Talk to a Mate by voice, hands free.">
      <ErrorNote message={err || (!VOICE_URL ? 'Voice server is not connected yet: set NEXT_PUBLIC_VOICE_URL in the dashboard.' : '')} />
      <div style={{ maxWidth: 520, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '12px 0 28px' }}>
        <div style={{ position: 'relative', width: 180, height: 180, display: 'grid', placeItems: 'center' }}>
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(106,77,244,.14)', opacity: live ? 1 : 0.5, transform: `scale(${live ? 1 + Math.min(lvl * 1.4, .3) : 0.9})`, transition: 'transform .15s ease-out, opacity .3s' }} />
          <span aria-hidden="true" style={{ position: 'absolute', inset: 22, borderRadius: '50%', background: 'rgba(106,77,244,.14)' }} />
          <Dot k={mate} s={104} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <b style={{ fontSize: 22 }}>{mateName(mate)}</b>
          <div style={{ color: '#6B6572', fontSize: 14, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {live ? <span style={{ ...row, gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1E8E3E' }} />{mm}:{ss}</span> : state === 'connecting' ? 'Connecting…' : MATES[mate].blurb}
          </div>
        </div>
        {state === 'idle' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {MATE_DEFS.map((d) => <button key={d.key} type="button" onClick={() => setMate(d.key)} aria-pressed={mate === d.key} style={{ border: '1px solid rgba(31,26,23,.16)', background: mate === d.key ? '#ECE7FF' : '#fff', borderRadius: 999, padding: '8px 14px', minHeight: 36, fontSize: 13, fontWeight: mate === d.key ? 700 : 500 }}>{d.name}</button>)}
          </div>)}
        <div style={{ display: 'flex', gap: 12 }}>
          {state === 'idle' ? <Btn variant="primary" onClick={() => void dial()} disabled={!VOICE_URL}><span style={row}><Icon name="phone" />Call {mateName(mate)}</span></Btn> : <>
            <Btn onClick={() => { h.current?.mute(!muted); setMuted(!muted); }}><span style={row}><Icon name={muted ? 'micoff' : 'mic'} />{muted ? 'Unmute' : 'Mute'}</span></Btn>
            <button type="button" onClick={() => h.current?.hangup()} style={{ ...row, border: 0, borderRadius: 12, background: '#B3261E', color: '#fff', fontWeight: 700, padding: '0 20px', minHeight: 44 }}><Icon name="hangup" />Hang up</button></>}
        </div>
        {tool && <span className="mono" style={{ fontSize: 12, background: '#ECE7FF', color: '#4F34D6', borderRadius: 8, padding: '4px 10px' }}>Using {tool.replace(/_/g, ' ')}…</span>}
        {lines.length > 0 && (
          <div aria-live="polite" style={{ width: '100%', maxHeight: 320, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, background: '#fff', border: '1px solid rgba(31,26,23,.12)', borderRadius: 16, padding: 14 }}>
            {lines.map((l, i) => <div key={i} style={{ alignSelf: l.who === 'you' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: l.who === 'you' ? '#ECE7FF' : '#F4F2FA', borderRadius: 14, padding: '8px 12px', fontSize: 14, lineHeight: 1.5 }}>{l.text}</div>)}
            <div ref={end} />
          </div>)}
      </div>
    </Page>
  );
}
