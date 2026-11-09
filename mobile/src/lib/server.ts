// Where the owner's Loopmates server is. Pairing happens once in the web dashboard; the server then writes
// servers/{uid} in Firestore, and this app reads it after sign-in (same account, so no second pairing).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from 'firebase/app';
import { doc, getDoc, getFirestore } from 'firebase/firestore/lite';
import { firebaseAuth } from './auth';

const KEY = 'serverUrl';
let url = '';
let lastSeen = '';
const subs = new Set<() => void>();

/** Last known server address ('' when not paired). */
export const serverUrlNow = () => url;
export const serverLastSeen = () => lastSeen;
export const onServerChange = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Cached address, loaded from storage on first use. */
export async function serverUrl(): Promise<string> {
  if (!url) url = (await AsyncStorage.getItem(KEY)) ?? '';
  if (!url) await resolveServer();
  return url;
}

let pending: Promise<string> | null = null;
/** Read servers/{uid}. Called at sign-in and when the server stops answering (a quick tunnel changes address on restart). */
export function resolveServer(): Promise<string> {
  pending ??= (async () => {
    const uid = firebaseAuth().currentUser?.uid;
    if (!uid) return url;
    try {
      const snap = await getDoc(doc(getFirestore(getApp()), 'servers', uid));
      const d = snap.exists() ? (snap.data() as { url?: string; lastSeen?: string }) : null;
      const next = (d?.url ?? '').replace(/\/$/, '');
      lastSeen = d?.lastSeen ?? '';
      if (next !== url) { url = next; await AsyncStorage.setItem(KEY, url); subs.forEach((f) => f()); }
    } catch { /* offline: keep the cached address */ }
    return url;
  })().finally(() => { pending = null; });
  return pending;
}
