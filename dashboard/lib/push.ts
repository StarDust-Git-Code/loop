'use client';
// Web push for this browser: register the service worker, subscribe with the server's VAPID key, register the device.
import { api } from './api';

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const b64ToBytes = (b64: string) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

/** Current state for this browser: 'unsupported' | 'denied' | 'on' | 'off'. */
export async function pushState(): Promise<'unsupported' | 'denied' | 'on' | 'off'> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('This browser cannot show notifications.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them in the address bar, then try again.');
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const key = await api.inbox.pushKey();
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  const ua = navigator.userAgent;
  const label = `${/Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'} on ${/Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Linux'}`;
  await api.inbox.addDevice({ kind: 'web', subscription: sub.toJSON(), label });
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}
