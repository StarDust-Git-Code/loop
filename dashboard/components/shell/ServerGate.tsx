'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { resolveServer, usesServer, useServerUrl } from '../../lib/serverUrl';
import { PairForm } from './PairForm';
import s from './server.module.css';

/** After sign-in, find the owner's server. Until one is paired, show how to set it up instead of empty screens. */
export function ServerGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { url, resolved } = useServerUrl();
  const path = usePathname();
  useEffect(() => { if (user) void resolveServer(true); }, [user]);
  if (!usesServer() || url || path === '/server') return <>{children}</>;
  if (!resolved) return <div className={s.wrap} aria-busy="true" />;
  return <PairScreen />;
}

export function PairScreen() {
  return (
    <main className={s.wrap}>
      <h1 className={s.h1}>Connect your Loopmates server</h1>
      <p className={s.lede}>Your agents run on your own computer. Install the server once, then pair it with this account. Your chats and files stay in your own Firebase project.</p>
      <section className={s.card} aria-labelledby="install">
        <h2 id="install">1. Install the server</h2>
        <ol className={s.steps}>
          <li><span><b>Windows:</b> download the Loopmates repository, open PowerShell in <code>backend</code>, run <code>powershell -ExecutionPolicy Bypass -File .\install.ps1</code>.</span></li>
          <li><span><b>Linux:</b> in <code>backend</code>, run <code>./install.sh</code>. It installs Node 22, a background service, and the <code>loopmates</code> command.</span></li>
          <li><span>The setup page opens on that computer (later: Start menu → <b>Loopmates setup</b>, or <code>loopmates setup</code>). Paste your Firebase key, then start the free <b>Quick tunnel</b> under Public address.</span></li>
        </ol>
      </section>
      <section className={s.card} aria-labelledby="pair">
        <h2 id="pair">2. Pair</h2>
        <p>On the setup page, open <b>Pair dashboard</b> and press <b>Show a pairing code</b>. Type the 6 digits here.</p>
        <div style={{ marginTop: 14 }}><PairForm /></div>
      </section>
    </main>
  );
}
