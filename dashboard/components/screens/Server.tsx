'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useServer } from '../../lib/server';
import { useServerUrl, usesServer } from '../../lib/serverUrl';
import { enablePush, pushState } from '../../lib/push';
import type { ServerStatus } from '../../lib/types';
import { PairForm } from '../shell/PairForm';
import { PairScreen } from '../shell/ServerGate';
import s from '../shell/server.module.css';

export function Server() {
  const { url, doc } = useServerUrl();
  const live = useServer();
  const [st, setSt] = useState<ServerStatus | null>(null);
  const [err, setErr] = useState('');
  const [push, setPush] = useState<'unsupported' | 'denied' | 'on' | 'off' | 'busy'>('off');
  const [pairAgain, setPairAgain] = useState(false);

  const load = useCallback(async () => {
    try { setSt(await api.server.status()); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the status.'); }
  }, []);
  useEffect(() => {
    if (!url) return;
    let on = true;
    api.server.status().then((x) => { if (on) setSt(x); }).catch((e: Error) => { if (on) setErr(e.message); });
    return () => { on = false; };
  }, [url]);
  useEffect(() => { void pushState().then(setPush); }, []);

  if (!usesServer()) return <main className={s.wrap}><h1 className={s.h1}>Demo mode</h1><p className={s.lede}>This dashboard runs in your browser only. Set up Firebase sign-in to connect a Loopmates server.</p></main>;
  if (!url) return <PairScreen />;

  const ready = st?.features.filter((f) => f.ready).length ?? 0;
  return (
    <main className={s.wide}>
      <div className={s.head}>
        <h1 className={s.h1}>Your server</h1>
        <span className={s.muted}>{live.status === 'online' ? 'Online' : live.status === 'offline' ? `Offline${doc?.lastSeen ? ` · last seen ${new Date(doc.lastSeen).toLocaleString()}` : ''}` : 'Checking…'}</span>
      </div>

      <section className={s.card} aria-labelledby="feat">
        <h2 id="feat">{st ? `${ready} of ${st.features.length} features ready` : 'Features'}</h2>
        {err && <p className={s.err}>{err}</p>}
        {st && (
          <ul className={s.list}>
            {st.features.map((f) => (
              <li key={f.key}>
                <span className={`${s.lamp} ${f.ready ? s.lampOn : ''}`} aria-hidden="true" />
                <b>{f.label}</b>
                <span className={s.muted}>{f.note}{f.fix && <span className={s.fix}>{f.fix}</span>}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={s.row}><button type="button" className={s.ghost} onClick={() => void load()}>Refresh</button></div>
      </section>

      <section className={s.card} aria-labelledby="notif">
        <h2 id="notif">Notifications on this browser</h2>
        <p>Runs that finish, questions from your agents, and calls ring here, even when this tab is closed. Choose channels and quiet hours in Settings.</p>
        <div className={s.row}>
          {push === 'on' ? <span className={s.ok}>On for this browser.</span>
            : push === 'unsupported' ? <span className={s.muted}>This browser cannot show notifications. On iPhone, add the dashboard to the Home Screen first.</span>
              : push === 'denied' ? <span className={s.err}>Blocked. Allow notifications for this site in the address bar.</span>
                : <button type="button" className={s.primary} disabled={push === 'busy'} onClick={async () => { setPush('busy'); try { await enablePush(); setPush('on'); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPush(await pushState()); } }}>Turn on notifications</button>}
        </div>
      </section>

      <section className={s.card} aria-labelledby="addr">
        <h2 id="addr">Address</h2>
        <p>The dashboard reaches your computer at <code>{url}</code>{st?.commit ? ` · version ${st.commit}` : ''}{doc?.platform ? ` · ${doc.platform === 'win32' ? 'Windows' : doc.platform}` : ''}. A quick tunnel gets a new address when the server restarts; the dashboard follows it by itself.</p>
        <div className={s.row}><button type="button" className={s.ghost} onClick={() => setPairAgain(!pairAgain)}>Pair a different server</button></div>
        {pairAgain && <div style={{ marginTop: 14 }}><PairForm onDone={() => { setPairAgain(false); void load(); }} /></div>}
      </section>
    </main>
  );
}
