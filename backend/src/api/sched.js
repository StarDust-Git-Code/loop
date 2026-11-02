// Scheduler. Jobs live in the top-level `jobs` collection so one cheap query (nextAt <= now) finds everything due.
// Ticks come from an in-process timer AND from an external pinger hitting POST /internal/tick, because Render free sleeps.
import { now } from '../lib/env.js';
import { nextRun } from '../lib/cron.js';
import { db, userCol } from './db.js';
import { getSettings } from './settings.js';
import { startRun } from './engine.js';
import { notify } from './telegram.js';

const jobs = db.collection('jobs');
const jid = (uid, kind, id) => `${uid}_${kind}_${id}`;

/** Keep the `jobs` index in step with automations / tasks / calendar events. */
export const hooks = {
  async automations(uid, id, doc, op) {
    const key = jid(uid, 'automation', id);
    if (op === 'delete' || !doc?.enabled || doc.schedule?.kind === 'manual') return void jobs.doc(key).delete().catch(() => {});
    const tz = (await getSettings(uid)).timezone;
    const at = nextRun(doc.schedule, Date.now(), tz);
    if (at == null) return void jobs.doc(key).delete().catch(() => {});
    await jobs.doc(key).set({ uid, kind: 'automation', refId: id, title: doc.name, nextAt: at });
  },
  async tasks(uid, id, doc, op) {
    const key = jid(uid, 'task', id);
    const at = doc?.dueAt ? Date.parse(doc.dueAt) : NaN;
    if (op === 'delete' || !doc || doc.status === 'done' || !(at > Date.now())) return void jobs.doc(key).delete().catch(() => {});
    await jobs.doc(key).set({ uid, kind: 'task', refId: id, title: doc.title, nextAt: at });
  },
  async events(uid, id, doc, op) {
    const key = jid(uid, 'event', id);
    const start = doc?.start ? Date.parse(doc.start) : NaN;
    const at = doc?.kind === 'event' ? start - 10 * 60_000 : start; // events warn 10 min ahead, reminders fire at their time
    if (op === 'delete' || !doc || !['reminder', 'event'].includes(doc.kind) || !(at > Date.now())) return void jobs.doc(key).delete().catch(() => {});
    await jobs.doc(key).set({ uid, kind: 'event', refId: id, title: doc.title, nextAt: at, ev: doc.kind });
  },
};

async function claim(ref, t) { // exactly one instance fires a job, even across restarts
  return db.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (!d.exists || d.data().nextAt > t) return null;
    const j = d.data();
    if (j.kind === 'automation') {
      const a = (await tx.get(userCol(j.uid, 'automations').doc(j.refId))).data();
      const at = a?.enabled ? nextRun(a.schedule, t, (await getSettings(j.uid)).timezone) : null;
      if (at == null) tx.delete(ref); else tx.update(ref, { nextAt: at });
    } else tx.delete(ref);
    return j;
  });
}

async function fire(j) {
  if (j.kind === 'automation') {
    const a = (await userCol(j.uid, 'automations').doc(j.refId).get()).data();
    if (!a) return;
    await startRun(j.uid, { prompt: a.description || a.name, workflowId: a.workflowId, title: a.name, unattended: true });
    await userCol(j.uid, 'automations').doc(j.refId).set({ lastRunAt: now() }, { merge: true });
    await notify(j.uid, `▶️ Automation started: ${a.name}`);
  } else if (j.kind === 'task') await notify(j.uid, `⏰ Task due: ${j.title}`);
  else await notify(j.uid, `${j.ev === 'event' ? '📅 Starting in 10 min' : '⏰ Reminder'}: ${j.title}`);
}

let busy = false;
export async function tick() {
  if (busy) return { fired: 0, busy: true };
  busy = true;
  let fired = 0;
  try {
    const t = Date.now();
    const snap = await jobs.where('nextAt', '<=', t).limit(25).get();
    for (const d of snap.docs) {
      const j = await claim(d.ref, t).catch(() => null);
      if (!j) continue;
      try { await fire(j); fired++; } catch (e) { console.error('job failed', j.kind, j.refId, e.message); }
    }
  } finally { busy = false; }
  return { fired };
}

export function startScheduler() {
  const h = setInterval(() => { tick().catch((e) => console.error('tick', e.message)); }, 30_000);
  h.unref();
  tick().catch(() => {});
}
