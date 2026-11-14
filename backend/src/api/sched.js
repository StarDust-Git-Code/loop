// Scheduler. Jobs live in the top-level `jobs` collection so one cheap query (nextAt <= now) finds everything due.
// The server ticks every 30 s. On boot, anything that came due while the computer was off fires once, marked late.
import { now } from '../lib/env.js';
import { nextRun } from '../lib/cron.js';
import { db, userCol } from './db.js';
import { getSettings } from './settings.js';
import { startRun } from './engine.js';
import { notify } from './notify.js';
import { runWatch, sendBriefing, briefingHook, ring, runStandup, standupHook } from './watch.js';

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
    await jobs.doc(key).set({ uid, kind: 'event', refId: id, title: doc.title, nextAt: at, ev: doc.kind, deliver: doc.deliver === 'call' ? 'call' : 'notify', mate: String(doc.mate ?? '').slice(0, 30), notes: String(doc.notes ?? '').slice(0, 500) });
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
    } else if (j.kind === 'watch') tx.update(ref, { nextAt: t + (j.every || 15 * 60_000) });
    else if (j.kind === 'briefing') tx.update(ref, { nextAt: t + 23 * 3_600_000 }); // re-aligned to the exact time after it fires
    else if (j.kind === 'standup') tx.update(ref, { nextAt: t + 6 * 86_400_000 }); // re-aligned after it fires, like the briefing
    else if (j.kind === 'reflect') tx.update(ref, { nextAt: t + 23 * 3_600_000 }); // postponed while busy, re-aligned after it runs
    else tx.delete(ref);
    return j;
  });
}

const hhmm = (t) => new Date(t).toISOString().slice(11, 16);
async function fire(j, t = Date.now()) {
  const late = j.nextAt < t - 5 * 60_000 ? ` (late: it was due ${hhmm(j.nextAt)} UTC while your computer was off)` : '';
  if (j.kind === 'automation') {
    const a = (await userCol(j.uid, 'automations').doc(j.refId).get()).data();
    if (!a) return;
    await startRun(j.uid, { prompt: a.description || a.name, workflowId: a.workflowId, title: late ? `${a.name} (late)` : a.name, unattended: true });
    await userCol(j.uid, 'automations').doc(j.refId).set({ lastRunAt: now() }, { merge: true });
    await notify(j.uid, `Automation started: ${a.name}${late}`);
  } else if (j.kind === 'watch') await runWatch(j.uid, j.refId);
  else if (j.kind === 'briefing') { await sendBriefing(j.uid); await briefingHook(j.uid, await getSettings(j.uid)); }
  else if (j.kind === 'standup') { await runStandup(j.uid); await standupHook(j.uid, await getSettings(j.uid)); }
  else if (j.kind === 'reflect') await (await import('./reflect.js')).fireReflect(j); // the nightly review, once the team is idle
  else if (j.kind === 'call') { // a Mate's call timer: ring as that Mate, with the context it saved when it set the timer
    const { ringCall, getCall } = await import('./calls.js'); const c = await getCall(j.uid, j.refId);
    if (c?.status === 'scheduled') { const r = await ringCall(j.uid, j.refId, { urgent: !!c.urgent }); if (late && r.delivered !== 'held') await notify(j.uid, `${c.mateName}'s call was due ${hhmm(j.nextAt)} UTC while your computer was off.`); }
  }
  else if (j.kind === 'task') await notify(j.uid, `⏰ Task due: ${j.title}${late}`);
  else if (j.deliver === 'call' && !late) { // "call me at 6 about X": the leader rings with the reminder
    const r = await ring(j.uid, await getSettings(j.uid), { mate: j.mate || '', reason: `Reminder: ${j.title}`, goal: `Remind the owner: ${j.title}.${j.notes ? ` Details: ${j.notes}` : ''} Ask if they want anything done about it.`, urgent: true });
    if (r.delivered !== 'call') await notify(j.uid, `Reminder: ${j.title} (I could not call: ${r.why}).`, { urgent: true });
  } else await notify(j.uid, `${j.ev === 'event' && !late ? 'Starting in 10 min' : 'Reminder'}: ${j.title}${late}`);
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
      try { await fire(j, t); fired++; } catch (e) { console.error('job failed', j.kind, j.refId, e.message); }
    }
  } finally { busy = false; }
  return { fired };
}

export function startScheduler() {
  const h = setInterval(() => { tick().catch((e) => console.error('tick', e.message)); }, 30_000);
  h.unref();
  tick().catch(() => {});
}
