// App notifications. Web push for the dashboard (VAPID keys created on first run, stored in the server settings) and
// Expo push for the mobile app (Expo's free push service; the app registers an ExponentPushToken). No third-party secret.
// Devices: users/{uid}/devices/{id} = { kind: 'web' | 'expo', subscription | token, label, createdAt }.
import webpush from 'web-push';
import { createHash } from 'node:crypto';
import { env, now } from '../lib/env.js';
import { saveConfig } from '../lib/config.js';
import { userCol } from './db.js';

let ready = false;
/** Create the VAPID key pair once; afterwards just load it. */
export async function initPush() {
  if (!env('VAPID_PUBLIC_KEY') || !env('VAPID_PRIVATE_KEY')) {
    const k = webpush.generateVAPIDKeys();
    await saveConfig({ VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey });
  }
  webpush.setVapidDetails(`mailto:${env('ALLOWED_EMAILS').split(',')[0]?.trim() || 'owner@loopmates.local'}`, env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  ready = true;
}
export const pushReady = () => ready;
export const vapidPublicKey = () => env('VAPID_PUBLIC_KEY');

const idFor = (s) => createHash('sha256').update(s).digest('hex').slice(0, 24);
const bad = (m) => Object.assign(new Error(m), { statusCode: 400 });

/** Register (or refresh) a device. The id is derived from the endpoint/token, so re-registering does not duplicate. */
export async function addDevice(uid, body = {}) {
  const label = String(body.label ?? '').slice(0, 60);
  if (body.kind === 'web') {
    const sub = body.subscription;
    if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw bad('A web push subscription (endpoint + keys) is required.');
    const id = idFor(sub.endpoint);
    await userCol(uid, 'devices').doc(id).set({ kind: 'web', subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, label: label || 'Browser', createdAt: now() });
    return { id };
  }
  if (body.kind === 'expo') {
    const token = String(body.token ?? '');
    if (!/^Expo(nent)?PushToken\[[\w-]+\]$/.test(token)) throw bad('An ExponentPushToken[...] is required.');
    const id = idFor(token);
    await userCol(uid, 'devices').doc(id).set({ kind: 'expo', token, label: label || 'Phone', createdAt: now() });
    return { id };
  }
  throw bad('kind must be web or expo');
}
export async function listDevices(uid) {
  return (await userCol(uid, 'devices').get()).docs.map((d) => { const x = d.data(); return { id: d.id, kind: x.kind, label: x.label, createdAt: x.createdAt }; });
}
export const removeDevice = (uid, id) => userCol(uid, 'devices').doc(String(id).slice(0, 40)).delete();

/** Send to every device. Dead subscriptions are removed. Returns how many were delivered. */
export async function sendPush(uid, { title = 'Loopmates', body = '', url = '/', tag = '', actions } = {}) {
  const snap = await userCol(uid, 'devices').get().catch(() => null);
  if (!snap?.docs.length) return 0;
  let n = 0; const expo = [];
  await Promise.all(snap.docs.map(async (d) => {
    const x = d.data();
    if (x.kind === 'web' && ready) {
      try { await webpush.sendNotification(x.subscription, JSON.stringify({ title, body: body.slice(0, 300), url, tag, actions }), { TTL: 3600 }); n++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await d.ref.delete().catch(() => {}); }
    } else if (x.kind === 'expo') expo.push({ to: x.token, title, body: body.slice(0, 300), data: { url, tag }, sound: 'default', priority: 'high', ...(tag === 'call' ? { channelId: 'calls' } : {}) });
  }));
  if (expo.length) {
    try {
      const r = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(expo), signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => ({}));
      n += (j.data ?? []).filter((t) => t.status === 'ok').length;
    } catch { /* offline: the inbox still has it */ }
  }
  return n;
}
