// ask_owner: a Mate asks the owner a multiple-choice question (2 to 4 options and a default).
// Delivered in the app (Home → Needs you, push) and on linked channels with tap-to-answer buttons.
// Inside a run the step waits for the answer (or the timeout, then the default). Questions live in users/{uid}/questions.
import { now } from '../lib/env.js';
import { userCol } from './db.js';
import { notify } from './notify.js';
import { setAnswerHandler } from './telegram.js';
import { loadRoster } from './roster.js';

const waiters = new Map(); // `${uid}/${id}` -> resolve(answer)
const bad = (m, statusCode = 400) => Object.assign(new Error(m), { statusCode });

/** action (optional, server-side only): what answering with the FIRST option does, e.g. { kind: 'skill', id } switches a drafted skill on. */
export async function askOwner(uid, { mate = '', question, options = [], fallback, runId = '', convId = '', timeoutMinutes = 30, action = null }) {
  const opts = [...new Set(options.map((o) => String(o).trim().slice(0, 60)).filter(Boolean))].slice(0, 4);
  if (!String(question ?? '').trim()) throw bad('question is required');
  if (opts.length < 2) throw bad('Give 2 to 4 options');
  const def = opts.includes(fallback) ? fallback : opts[0];
  const ro = await loadRoster(uid); mate = ro.has(mate) ? mate : ro.leader; const who = ro.name(mate);
  const ref = userCol(uid, 'questions').doc();
  const doc = { mate, mateName: who, question: String(question).slice(0, 400), options: opts, fallback: def, runId, convId, status: 'open', answer: null, createdAt: now(), expiresAt: new Date(Date.now() + timeoutMinutes * 60_000).toISOString(), ...(action?.kind ? { action: { kind: String(action.kind), id: String(action.id ?? '').slice(0, 60) } } : {}) };
  await ref.set(doc);
  await notify(uid, `${who} asks: ${doc.question}\n${opts.map((o, i) => `${i + 1}. ${o}${o === def ? ' (default)' : ''}`).join('\n')}`, {
    title: `${who} has a question`, url: '/', tag: `ask-${ref.id}`, kind: 'question', urgent: false,
    buttons: opts.map((o, i) => ({ label: o, data: `ask:${ref.id}:${i}` })),
  });
  return { id: ref.id, ...doc };
}

/** Wait for an answer; on timeout the default is used and recorded. */
export async function waitForAnswer(uid, q, signal) {
  const key = `${uid}/${q.id}`;
  const ms = Math.max(10_000, Date.parse(q.expiresAt) - Date.now());
  const answer = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    waiters.set(key, (a) => { clearTimeout(t); resolve(a); });
    signal?.addEventListener?.('abort', () => { clearTimeout(t); resolve(null); }, { once: true });
  });
  waiters.delete(key);
  if (answer != null) return { answer, timedOut: false };
  await userCol(uid, 'questions').doc(q.id).set({ status: 'expired', answer: q.fallback, answeredAt: now(), via: 'timeout' }, { merge: true }).catch(() => {});
  return { answer: q.fallback, timedOut: true };
}

/** Record an answer from any surface. Returns a short confirmation. */
export async function answerQuestion(uid, id, answer, via = 'app') {
  const ref = userCol(uid, 'questions').doc(String(id).slice(0, 60));
  const q = (await ref.get()).data();
  if (!q) throw bad('No such question', 404);
  if (q.status !== 'open') return `Already answered: ${q.answer}`;
  const a = String(answer ?? '').trim().slice(0, 200);
  if (!a) throw bad('answer is required');
  await ref.set({ status: 'answered', answer: a, answeredAt: now(), via }, { merge: true });
  waiters.get(`${uid}/${ref.id}`)?.(a);
  if (q.action?.kind === 'skill' && q.action.id) { // a skill an agent drafted: the first option switches it on
    const on = a === q.options?.[0]; const sref = userCol(uid, 'skills').doc(q.action.id);
    if (!(await sref.get()).exists) return 'Answered, but that skill was deleted in the meantime.';
    await sref.set({ ...(on ? { enabled: true } : {}), review: on ? 'approved' : 'draft', updatedAt: now() }, { merge: true });
    return on ? 'Answered: switched the skill on' : 'Answered: the skill stays a draft';
  }
  return `Answered: ${a}`;
}

export async function openQuestions(uid) {
  const rows = (await userCol(uid, 'questions').where('status', '==', 'open').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const t = Date.now();
  for (const r of rows) if (Date.parse(r.expiresAt) < t && !waiters.has(`${uid}/${r.id}`)) { r.status = 'expired'; void userCol(uid, 'questions').doc(r.id).set({ status: 'expired' }, { merge: true }); }
  return rows.filter((r) => r.status === 'open').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Button data "ask:<id>:<n>" from Telegram or Discord. */
async function fromButton(uid, data, via) {
  const m = /^ask:([\w-]+):(\d)$/.exec(data);
  if (!m) return 'Unknown button';
  const q = (await userCol(uid, 'questions').doc(m[1]).get()).data();
  if (!q) return 'That question is gone.';
  return answerQuestion(uid, m[1], q.options[Number(m[2])] ?? q.fallback, via);
}
setAnswerHandler((uid, data) => fromButton(uid, data, 'telegram'));

/** Discord component interaction -> update the message to show the answer. */
export async function answerFromDiscord(i) {
  const { db } = await import('./db.js');
  const duid = i.user?.id ?? i.member?.user?.id;
  const uid = (await db.collection('discordUsers').doc(duid).get()).data()?.uid;
  const text = uid ? await fromButton(uid, String(i.data?.custom_id ?? ''), 'discord').catch((e) => e.message) : 'This account is not linked.';
  return { type: 7, data: { content: `${i.message?.content ?? ''}\n\n**${text}**`.slice(0, 1900), components: [] } };
}
