// Health summaries for Zen and Luna: one doc per day (steps, sleep, resting heart rate, active minutes, weight).
// Data comes in three ways, all owner-only: the dashboard/app (POST /v1/health), a CSV import, or a personal ingest key
// for phone automations (Tasker, iOS Shortcuts, a Health Connect export app) posting to /health/ingest.
// It is sensitive: read-only tools, never mined into memory, never sent to chat apps unless the owner asks.
import { createHash, randomBytes } from 'node:crypto';
import { db, userCol } from '../api/db.js';
import { now } from '../lib/env.js';
import { bad } from './util.js';

const METRICS = { steps: [0, 200_000], sleepMinutes: [0, 1440], restingHr: [20, 250], activeMinutes: [0, 1440], weightKg: [10, 400], hrv: [0, 400] };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');

/** Clean one day: only known metrics, numbers within sane ranges. Returns null when nothing is usable. */
export function cleanDay(d) {
  const date = String(d?.date ?? '').slice(0, 10); if (!DATE.test(date)) return null;
  const out = { date };
  for (const [k, [lo, hi]] of Object.entries(METRICS)) { const v = Number(d[k]); if (d[k] !== undefined && d[k] !== '' && Number.isFinite(v) && v >= lo && v <= hi) out[k] = Math.round(v * 10) / 10; }
  return Object.keys(out).length > 1 ? out : null;
}

export async function saveDays(uid, days, source = 'app') {
  const clean = (Array.isArray(days) ? days : []).slice(0, 400).map(cleanDay).filter(Boolean);
  for (const d of clean) await userCol(uid, 'health').doc(d.date).set({ ...d, source: String(source).slice(0, 30), updatedAt: now() }, { merge: true });
  return { saved: clean.length };
}

/** CSV with a header row: date plus any of steps, sleepMinutes (or sleep_hours), restingHr, activeMinutes, weightKg, hrv. */
export function parseHealthCsv(csv) {
  const lines = String(csv ?? '').split(/\r?\n/).filter((l) => l.trim()); if (lines.length < 2) return [];
  const norm = (h) => h.trim().toLowerCase().replace(/[^a-z]/g, '');
  const alias = { date: 'date', day: 'date', steps: 'steps', sleepminutes: 'sleepMinutes', sleephours: 'sleepHours', sleep: 'sleepHours', restinghr: 'restingHr', restingheartrate: 'restingHr', activeminutes: 'activeMinutes', weightkg: 'weightKg', weight: 'weightKg', hrv: 'hrv' };
  const head = lines[0].split(',').map((h) => alias[norm(h)] ?? '');
  return lines.slice(1).map((l) => { const c = l.split(','); const o = {}; head.forEach((h, i) => { if (h) o[h] = c[i]?.trim(); }); if (o.sleepHours && !o.sleepMinutes) o.sleepMinutes = Number(o.sleepHours) * 60; return o; });
}

/** Make a new ingest key for phone automations. Only its hash is stored; the key is shown once. */
export async function newIngestKey(uid) {
  const key = `lmh_${randomBytes(24).toString('base64url')}`;
  const old = await db.collection('healthKeys').where('uid', '==', uid).get().catch(() => ({ docs: [] }));
  for (const d of old.docs) await d.ref.delete().catch(() => {});
  await db.collection('healthKeys').doc(sha(key)).set({ uid, createdAt: now() });
  return key;
}
export async function uidForIngestKey(key) {
  if (!/^lmh_[\w-]{20,}$/.test(String(key ?? ''))) return '';
  return (await db.collection('healthKeys').doc(sha(key)).get()).data()?.uid ?? '';
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
async function lastDays(uid, n) {
  const from = new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  return (await userCol(uid, 'health').limit(400).get()).docs.map((d) => d.data()).filter((d) => d.date >= from).sort((a, b) => a.date.localeCompare(b.date));
}
const fmt = (k, v) => (!Number.isFinite(v) ? '–' : k === 'sleepMinutes' ? `${Math.floor(v / 60)}h${String(Math.round(v % 60)).padStart(2, '0')}` : k === 'steps' ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

const HEALTH_TOOLS = {
  health_summary: { group: 'Health', desc: 'The owner\'s recent health summary (sleep, steps, resting heart rate, active minutes, weight) by day, with averages and the change versus the week before. Read-only. Sensitive: use it to adapt suggestions, mention numbers only when helpful, never copy them into messages to other people.', args: '{"days?": 7}', run: async (c, a) => {
    const n = Math.min(Math.max(Number(a.days) || 7, 1), 60);
    const rows = await lastDays(c.uid, n * 2);
    if (!rows.length) return 'No health data yet. The owner can connect it in Connections → Health.';
    const cut = new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    const cur = rows.filter((r) => r.date >= cut), prev = rows.filter((r) => r.date < cut);
    const keys = Object.keys(METRICS).filter((k) => cur.some((r) => r[k] !== undefined));
    const table = [`date | ${keys.join(' | ')}`, ...cur.map((r) => `${r.date} | ${keys.map((k) => fmt(k, r[k])).join(' | ')}`)].join('\n');
    const sum = keys.map((k) => { const a1 = avg(cur.map((r) => r[k]).filter(Number.isFinite)), a0 = avg(prev.map((r) => r[k]).filter(Number.isFinite)); return `${k}: avg ${fmt(k, a1)}${Number.isFinite(a0) ? ` (before: ${fmt(k, a0)})` : ''}`; }).join('\n');
    return `Last ${n} day(s):\n${table}\n\n${sum}`;
  } },
};

export const health = {
  key: 'health', name: 'Health', badge: '♥', group: 'Health', bg: '#FDE7EF', fg: '#B0245A',
  what: 'Zen and Luna see a daily summary of your sleep, steps and heart rate, so focus suggestions and evening reflections fit how you actually are. Only daily totals are stored, on your own account. Nothing is shared or sent to chat apps.',
  fields: [],
  steps: [
    { title: 'Choose how the numbers arrive', text: 'Phone automation: make an ingest key below and have Tasker (Android, reading Health Connect) or Shortcuts (iPhone, reading Apple Health) post each evening to the address shown. Or export a CSV from your tracker (columns: date, steps, sleepMinutes or sleepHours, restingHr, activeMinutes, weightKg) and import it.' },
    { title: 'What the automation sends', text: 'POST <server>/health/ingest with the header "Authorization: Bearer <key>" and a JSON body like {"days":[{"date":"2026-11-09","steps":8400,"sleepMinutes":430,"restingHr":58}]}. The key only allows adding health numbers.' },
  ],
  ingest: true,
  ready: () => true, note: () => 'Ready (add data from Connections → Health)',
  test: async (uid) => { const rows = await lastDays(uid, 14); if (!rows.length) throw bad('No health data in the last 14 days yet.'); return `Working: ${rows.length} day(s) of data in the last two weeks, latest ${rows.at(-1).date}.`; },
  tools: HEALTH_TOOLS,
};
