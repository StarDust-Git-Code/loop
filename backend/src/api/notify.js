// One notifier for every channel the owner allows: the app (web push + phone push), Telegram, Discord, Slack, WhatsApp.
// Every notification also lands in users/{uid}/inbox, so nothing is lost when a channel is off or it is quiet hours.
// Quiet hours (Settings): only the inbox, unless the message is urgent.
import { now } from '../lib/env.js';
import { userCol } from './db.js';
import { getSettings } from './settings.js';
import { notify as tg } from './telegram.js';
import { notify as dc } from './discord.js';
import { sendPush } from './push.js';
import { notifySlack, notifyWhatsApp } from '../integrations/index.js';

const mins = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
/** Is it quiet hours right now in the owner's timezone? Handles ranges over midnight (22:00 → 07:00). */
export function isQuiet(s, at = new Date()) {
  if (!s.quietHoursOn) return false;
  let local;
  try { local = new Intl.DateTimeFormat('en-GB', { timeZone: s.timezone || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at); } catch { local = at.toISOString().slice(11, 16); }
  const t = mins(local), a = mins(s.quietFrom), b = mins(s.quietTo);
  return a <= b ? t >= a && t < b : t >= a || t < b;
}

/**
 * Send a notification. `text` is the message; opts: { title, url, tag, urgent, kind }.
 * Returns how many deliveries succeeded (0 when only the inbox got it).
 */
export async function notify(uid, text, opts = {}) {
  const s = await getSettings(uid).catch(() => ({}));
  await userCol(uid, 'inbox').doc().set({ text: String(text).slice(0, 2000), title: opts.title ?? '', url: opts.url ?? '', kind: opts.kind ?? 'note', read: false, at: now() }).catch(() => {});
  if (isQuiet(s) && !opts.urgent) return 0;
  const jobs = [];
  if (s.notifyApp !== false) jobs.push(sendPush(uid, { title: opts.title || 'Loopmates', body: String(text), url: opts.url || '/', tag: opts.tag || '' }));
  if (s.notifyTelegram !== false) jobs.push(tg(uid, text, opts));
  if (s.notifyDiscord !== false) jobs.push(dc(uid, text, opts));
  if (s.notifySlack !== false) jobs.push(notifySlack(uid, text, opts));
  if (s.notifyWhatsapp !== false) jobs.push(notifyWhatsApp(uid, text, opts));
  const r = await Promise.allSettled(jobs);
  return r.reduce((n, x) => n + (x.status === 'fulfilled' ? x.value : 0), 0);
}
