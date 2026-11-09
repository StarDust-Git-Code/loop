'use client';
import { useState } from 'react';
import { pairWithCode } from '../../lib/serverUrl';
import s from './server.module.css';

/** Six-digit code from the server's setup page → pairs this account with that server. */
export function PairForm({ onDone }: { onDone?: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await pairWithCode(code); setOk(true); onDone?.(); } catch (x) { setErr(x instanceof Error ? x.message : 'Pairing failed.'); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={go}>
      <label htmlFor="pair-code" style={{ fontSize: 13, fontWeight: 600 }}>Pairing code</label>
      <div className={s.codeRow}>
        <input id="pair-code" className={s.code} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^\d ]/g, '')); setErr(''); }} />
        <button type="submit" className={s.primary} disabled={busy || code.replace(/\D/g, '').length !== 6}>{busy ? 'Pairing…' : 'Pair'}</button>
      </div>
      {err && <p className={s.err} role="alert">{err}</p>}
      {ok && <p className={s.ok} role="status">Paired. Your server is connected.</p>}
    </form>
  );
}
