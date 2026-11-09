'use client';
// Where the owner's Loopmates server is. It runs on their own computer, so its address is not baked into the build:
// after sign-in the dashboard reads servers/{uid} from Firestore (the server writes it after pairing and every 2 min).
// NEXT_PUBLIC_API_URL still works as a fixed address for development.
import { useEffect, useState } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore/lite';
import { getApp } from 'firebase/app';
import { firebaseAuth, authEnabled } from './firebase';
import { idToken } from './auth';

export type ServerDoc = { url: string; lastSeen?: string; commit?: string; platform?: string };
type State = { url: string; doc: ServerDoc | null; resolved: boolean };

const FIXED = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const KEY = 'lm-server-url';
const cached = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
let state: State = { url: FIXED, doc: null, resolved: !!FIXED || !authEnabled };
const subs = new Set<(s: State) => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; subs.forEach((f) => f(state)); };

/** The current server base URL ('' when not paired yet). */
export const serverUrl = () => state.url || (typeof window !== 'undefined' ? cached() : '');
/** True when the dashboard talks to a real server (paired, or a fixed URL), false for the browser-only demo. */
export const usesServer = () => !!FIXED || authEnabled;

let pending: Promise<void> | null = null;
/** Look up servers/{uid}. Called after sign-in and again when the server stops answering (its quick-tunnel URL may have changed). */
export function resolveServer(force = false): Promise<void> {
  if (FIXED) return Promise.resolve();
  if (pending && !force) return pending;
  pending = (async () => {
    const a = firebaseAuth(); if (!a) { set({ resolved: true }); return; }
    await a.authStateReady();
    const uid = a.currentUser?.uid; if (!uid) { set({ resolved: true }); return; }
    try {
      const snap = await getDoc(doc(getFirestore(getApp()), 'servers', uid));
      const d = snap.exists() ? (snap.data() as ServerDoc) : null;
      const url = d?.url?.replace(/\/$/, '') ?? '';
      try { if (url) localStorage.setItem(KEY, url); else localStorage.removeItem(KEY); } catch { /* private mode */ }
      set({ url, doc: d, resolved: true });
    } catch {
      set({ url: cached(), resolved: true }); // offline or rules not deployed: keep the last known address
    }
  })().finally(() => { pending = null; });
  return pending;
}

/** Pair with the 6-digit code shown on the server's setup page. */
export async function pairWithCode(code: string): Promise<void> {
  const c = code.replace(/\D/g, '');
  if (c.length !== 6) throw new Error('The code has 6 digits.');
  let url = '';
  try {
    const snap = await getDoc(doc(getFirestore(getApp()), 'pairings', c));
    url = snap.exists() ? String((snap.data() as { url?: string }).url ?? '') : '';
  } catch { throw new Error('Could not check the code. Are the Firestore rules deployed (firestore.rules)?'); }
  if (!url) throw new Error('That code is wrong or expired. Make a new one on the setup page.');
  const tok = await idToken();
  let res: Response;
  try { res = await fetch(`${url.replace(/\/$/, '')}/v1/pair`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify({ code: c }) }); }
  catch { throw new Error(`Your server answered the code but cannot be reached at ${url}. Check that its public address (tunnel) is running.`); }
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? `Pairing failed (${res.status})`);
  await resolveServer(true);
}

export function useServerUrl(): State {
  const [s, setS] = useState(state);
  useEffect(() => { subs.add(setS); return () => { subs.delete(setS); }; }, []);
  return s;
}
