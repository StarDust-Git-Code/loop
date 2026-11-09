'use client';
import { useEffect, useState } from 'react';
import { resolveServer, serverUrl, usesServer, useServerUrl } from './serverUrl';

export type ServerState = { status: 'checking' | 'online' | 'offline' | 'local' | 'unpaired'; lastSeen: number | null };

let shared: ServerState = { status: usesServer() ? 'checking' : 'local', lastSeen: null };
const subs = new Set<(s: ServerState) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let fails = 0;

async function check() {
  if (!usesServer()) return;
  const url = serverUrl();
  let next: ServerState;
  if (!url) next = { status: 'unpaired', lastSeen: null };
  else {
    try {
      const r = await fetch(`${url}/healthz`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      next = r.ok ? { status: 'online', lastSeen: Date.now() } : { status: 'offline', lastSeen: shared.lastSeen };
    } catch { next = { status: 'offline', lastSeen: shared.lastSeen }; }
    if (next.status === 'offline' && ++fails % 2 === 1) void resolveServer(true); // a quick tunnel gets a new address on restart
    if (next.status === 'online') fails = 0;
  }
  shared = next; subs.forEach((f) => f(next));
}

/** Whether the owner's Loopmates server answers. One shared poll (every 30 s) for the whole page. */
export function useServer(): ServerState & { retry: () => void; lastSeenDoc: string | null } {
  const [s, set] = useState(shared);
  const { url, doc, resolved } = useServerUrl();
  useEffect(() => {
    subs.add(set);
    if (!timer && usesServer()) timer = setInterval(() => void check(), 30_000);
    return () => { subs.delete(set); if (!subs.size && timer) { clearInterval(timer); timer = null; } };
  }, []);
  useEffect(() => { if (resolved) void check(); }, [url, resolved]);
  return { ...s, retry: () => { void resolveServer(true).then(check); }, lastSeenDoc: doc?.lastSeen ?? null };
}
