'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MATES, MATE_DEFS, mateImg, mateName } from '../../lib/mates';
import { startCall, VOICE_URL, type CallHandle } from '../../lib/voice';
import type { MateKey } from '../../lib/types';
import { Btn, ErrorNote, Page } from '../ui/ui';

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

  useEffect(() => { if (state !== 'live') return; const t = setInterval(() => { setSecs((s) => s + 1); setLvl(h.current?.level() ?? 0); }, 250); return () => clearInterval(t); }, [state]);
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

  return (
    <Page title="Call" sub="Talk to a Mate by voice, hands free. Works on your phone over the internet.">
      <ErrorNote message={err || (!VOICE_URL ? 'Voice server is not connected yet: set NEXT_PUBLIC_VOICE_URL in the dashboard.' : '')} />
      <div style={{ maxWidth: 560, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '8px 0 24px' }}>
        <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          <span aria-hidden="true" style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(106,77,244,.16)', transform: `scale(${1 + Math.min(lvl * 1.6, .45)})`, transition: 'transform .12s' }} />
          <Dot k={mate} s={110} />
        </div>
        <div style={{ textAlign: 'center' }}><b style={{ fontSize: 20 }}>{mateName(mate)}</b><div style={{ color: '#6B6572', fontSize: 13.5, marginTop: 2 }}>{state === 'live' ? `On a call · ${mm}:${ss}` : state === 'connecting' ? 'Connecting…' : MATES[mate].blurb}</div></div>
        {state === 'idle' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {MATE_DEFS.map((d) => <button key={d.key} type="button" onClick={() => setMate(d.key)} aria-pressed={mate === d.key} style={{ border: '1px solid rgba(31,26,23,.16)', background: mate === d.key ? '#ECE7FF' : '#fff', borderRadius: 999, padding: '8px 12px', minHeight: 36, fontSize: 13, fontWeight: mate === d.key ? 700 : 500 }}>{d.name}</button>)}
          </div>)}
        <div style={{ display: 'flex', gap: 12 }}>
          {state === 'idle' ? <Btn variant="primary" onClick={() => void dial()} disabled={!VOICE_URL}>📞 Call {mateName(mate)}</Btn> : <>
            <Btn onClick={() => { h.current?.mute(!muted); setMuted(!muted); }}>{muted ? '🔇 Unmute' : '🎙 Mute'}</Btn>
            <button type="button" onClick={() => h.current?.hangup()} style={{ border: 0, borderRadius: 12, background: '#B3261E', color: '#fff', fontWeight: 700, padding: '0 20px', minHeight: 44 }}>Hang up</button></>}
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
