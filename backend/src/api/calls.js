// Call missions: an agent asks for a call with a goal and questions; a Gemini Live voice sub-agent carries the call and
// afterwards a report is written to the call doc, the originating chat and Telegram/Discord.
import { userCol } from './db.js';
import { chat, extractJson } from './llm.js';
import { learnFromTurn } from './memory.js';
import { getSettings } from './settings.js';
import { hooks } from './toolhooks.js';
import { MATE } from './mates.js';
import { loadRoster } from './roster.js';
import { now, uid as rid } from '../lib/env.js';

const clip = (s, n) => String(s ?? '').slice(0, n);

export async function createCall(uid, { mate = '', goal = '', questions = [], reason = '', convId = '', runId = '', topic = '', status = 'ringing', scheduledFor = '', snapshot = null }) {
  const ro = await loadRoster(uid); mate = ro.has(mate) ? mate : ro.leader;
  const ref = userCol(uid, 'calls').doc();
  const doc = { mate, mateName: ro.name(mate), goal: clip(goal, 600), reason: clip(reason, 300), questions: questions.map((q) => clip(q, 240)).filter(Boolean).slice(0, 8), convId: convId || '', runId: runId || '', topic: clip(topic, 120), status, ...(scheduledFor ? { scheduledFor } : {}), createdAt: now(), updatedAt: now(), transcript: [], report: null };
  // What the Mate knew when it asked for the call, so the voice agent (even hours later) speaks with that context.
  doc.snapshot = snapshot ?? await callSnapshot(uid, { mate, convId: doc.convId, runId: doc.runId, about: `${doc.reason} ${doc.goal}` }).catch(() => '');
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

/** The Mate's working context right now: the conversation, the run it is in, and the memories that matter for this call. */
export async function callSnapshot(uid, { mate, convId = '', runId = '', about = '' }) {
  const ro = await loadRoster(uid); const parts = [];
  const convs = (await userCol(uid, 'conversations').limit(80).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const c = convs.find((x) => x.id === convId) ?? convs.filter((x) => x.mate === mate).sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))[0];
  const msgs = (c?.messages ?? []).filter((m) => m.role !== 'system' && m.text).slice(-20);
  if (msgs.length) parts.push(`Conversation "${clip(c.title, 60)}" (latest ${msgs.length} messages):\n${msgs.map((m) => `${m.role === 'user' ? 'Owner' : ro.name(m.mate ?? mate)}: ${clip(m.text, 400)}`).join('\n')}`);
  if (runId) {
    const r = (await userCol(uid, 'runs').doc(runId).get()).data();
    if (r) parts.push(`Run "${r.title}" (${r.status}). Job: ${clip(r.prompt, 400)}\nSteps: ${(r.steps ?? []).map((s) => `${s.label} [${s.status}]`).join('; ') || 'not planned yet'}\nNotes so far:\n${clip(String(r.notes ?? '').slice(-1500), 1500)}`);
  }
  try {
    const { recall } = await import('./memory.js');
    const mem = await recall(uid, about, { k: 5, pinned: 3, mate });
    if (mem.length) parts.push(`Memories that matter here:\n${mem.map((m) => `- (${m.scope === 'personal' ? 'your note' : m.kind}) ${clip(m.text, 200)}`).join('\n')}`);
  } catch { /* memory is best effort */ }
  return clip(parts.join('\n\n'), 8000);
}

/** Ring the owner for an existing call (now, or when its timer fires): quiet hours, then a tap-to-answer link. */
export async function ringCall(uid, id, { urgent = false } = {}) {
  const ref = userCol(uid, 'calls').doc(id); const call = (await ref.get()).data();
  if (!call || ['done', 'missed', 'cancelled'].includes(call.status)) return { delivered: 'none', why: 'the call no longer exists' };
  const { isQuiet } = await import('./notify.js'); const settings = await getSettings(uid);
  if (isQuiet(settings) && !(urgent && settings.urgentBreaksQuiet !== false)) {
    await ref.set({ status: 'held', updatedAt: now() }, { merge: true });
    await hooks.notify?.(uid, `${call.mateName} wanted to call you (quiet hours): ${call.reason}\nOpen it when you are free: ${callLink(id, call)}`, { title: `${call.mateName} wants to talk`, url: callLink(id, call), kind: 'call' });
    return { delivered: 'held', why: 'quiet hours' };
  }
  await ref.set({ status: 'ringing', rangAt: now(), updatedAt: now() }, { merge: true });
  const n = await hooks.notify?.(uid, `${call.mateName} is calling: ${call.reason}${call.questions.length ? `\n${call.questions.length} quick question(s)` : ''}\nTap to answer: ${callLink(id, call)}`, { title: `${call.mateName} is calling`, url: callLink(id, call), tag: 'call', urgent: true, kind: 'call' });
  return { delivered: n ? 'call' : 'inbox', link: callLink(id, call) };
}
export function callLink(id, call) {
  const site = (process.env.DASHBOARD_URL || String(process.env.ALLOWED_ORIGINS ?? '').split(',')[0] || '').trim().replace(/\/$/, '');
  return `${site}/call?mate=${encodeURIComponent(call.mate)}&call=${id}&reason=${encodeURIComponent(call.reason)}`;
}

/** A call on a timer: the snapshot is taken NOW, the scheduler rings at `at` as this Mate. */
export async function scheduleCall(uid, { mate, at, reason, goal = '', questions = [], convId = '', runId = '', urgent = false }) {
  const t = Date.parse(at); if (!Number.isFinite(t)) throw Object.assign(new Error('when must be a time'), { tool: true });
  if (t < Date.now() - 60_000) throw Object.assign(new Error('That time has already passed'), { tool: true });
  if (t > Date.now() + 30 * 86_400_000) throw Object.assign(new Error('At most 30 days ahead'), { tool: true });
  const pending = (await userCol(uid, 'calls').limit(200).get()).docs.filter((d) => d.data().status === 'scheduled').length;
  if (pending >= 20) throw Object.assign(new Error('There are already 20 scheduled calls. Cancel some first.'), { tool: true });
  const call = await createCall(uid, { mate, goal, questions, reason, convId, runId, topic: reason.toLowerCase().slice(0, 60), status: 'scheduled', scheduledFor: new Date(t).toISOString() });
  await userCol(uid, 'calls').doc(call.id).set({ urgent: !!urgent }, { merge: true });
  const { db } = await import('./db.js');
  await db.collection('jobs').doc(`${uid}_call_${call.id}`).set({ uid, kind: 'call', refId: call.id, title: `Call: ${call.reason}`, nextAt: Math.max(t, Date.now() + 5_000) });
  return call;
}
export async function cancelCall(uid, id) {
  const ref = userCol(uid, 'calls').doc(String(id).slice(0, 60)); const call = (await ref.get()).data();
  if (!call) throw Object.assign(new Error('No such call'), { tool: true, statusCode: 404 });
  if (!['scheduled', 'held', 'ringing'].includes(call.status)) throw Object.assign(new Error(`That call is already ${call.status}`), { tool: true, statusCode: 409 });
  await ref.set({ status: 'cancelled', updatedAt: now() }, { merge: true });
  const { db } = await import('./db.js'); await db.collection('jobs').doc(`${uid}_call_${id}`).delete().catch(() => {});
  return { ok: true };
}

/** Wait (inside a run step) until the owner has finished the call. */
export async function waitForCall(uid, id, { signal, timeoutMs = 20 * 60_000 } = {}) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end && !signal?.aborted) {
    const c = await getCall(uid, id); if (c && ['done', 'missed', 'cancelled'].includes(c.status)) return c;
    await new Promise((r) => setTimeout(r, 4000));
  }
  return null;
}
export async function getCall(uid, id) { const d = await userCol(uid, 'calls').doc(String(id).slice(0, 60)).get(); return d.exists ? { id: d.id, ...d.data() } : null; }
export async function listCalls(uid, limit = 15) {
  const rows = (await userCol(uid, 'calls').limit(100).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
}

/** The briefing the voice sub-agent receives. */
export function missionPrompt(call) {
  const lines = [`You are the voice sub-agent of ${call.mateName ?? MATE[call.mate]?.name ?? 'a Mate'}. You are calling the owner on behalf of your Mate to complete a mission, then report back.`];
  if (call.goal) lines.push(`Mission: ${call.goal}`);
  if (call.reason) lines.push(`Why you are calling: ${call.reason}`);
  if (call.questions.length) lines.push(`Ask these, one at a time, waiting for each answer (rephrase naturally, do not read them like a form):\n${call.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`);
  lines.push('Open with one short sentence saying who you are and why you are calling. Confirm anything ambiguous. Do not make promises on the owner\'s behalf. When every question is answered (or the owner says to stop), thank them in one sentence, then call the finish_call tool with a summary and the answers, and say goodbye.');
  return lines.join('\n');
}
export const FINISH_DECL = { name: 'finish_call', description: 'Call this once the mission is done (or the owner wants to stop). Records the result so your Mate can act on it.', parameters: { type: 'OBJECT', properties: { summary: { type: 'STRING', description: 'What happened, 1-3 sentences' }, answers: { type: 'ARRAY', items: { type: 'STRING' }, description: 'One line per question: "Q -> answer"' }, followups: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Things the owner asked your Mate to do next' } }, required: ['summary'] } };

/** Write the report after a call ends (any reason). Safe to call twice. */
export async function wrapUp(uid, id, { transcript = [], finish = null, why = '' } = {}) {
  const ref = userCol(uid, 'calls').doc(id); const call = (await ref.get()).data();
  if (!call || call.status === 'done' || call.status === 'missed') return call;
  const you = transcript.filter((t) => t.who === 'you').map((t) => t.text).join(' ').trim();
  const text = transcript.map((t) => `${t.who === 'you' ? 'Owner' : 'Agent'}: ${t.text}`).join('\n').slice(-6000);
  let report;
  if (!you) report = { summary: 'The owner did not answer or said nothing, so the mission was not completed.', answers: [], followups: [], outcome: 'missed' };
  else {
    report = { summary: clip(finish?.summary, 600), answers: finish?.answers ?? [], followups: finish?.followups ?? [], outcome: 'completed' };
    if (!report.summary || (call.questions.length && !report.answers.length)) { // the sub-agent did not file a report: write it from the transcript
      try {
        const r = await chat(uid, { json: true, temperature: 0.1, maxTokens: 500, effort: 'low', messages: [
          { role: 'system', content: 'Summarise a phone call between an AI agent and its owner. Reply JSON only: {"summary":"1-3 sentences","answers":["question -> owner\'s answer", ...],"followups":["things the owner asked for"]}. Only what was actually said.' },
          { role: 'user', content: `Mission: ${call.goal || call.reason}\nQuestions: ${call.questions.join(' | ') || '(open conversation)'}\n\nTranscript:\n${text}` }] });
        const j = extractJson(r.text) ?? {}; report = { ...report, summary: report.summary || clip(j.summary, 600), answers: report.answers.length ? report.answers : j.answers ?? [], followups: report.followups.length ? report.followups : j.followups ?? [] };
      } catch { report.summary ||= 'The call ended. See the transcript.'; }
    }
  }
  await ref.set({ status: report.outcome === 'missed' ? 'missed' : 'done', transcript: transcript.slice(-200), report, endedBy: why, endedAt: now(), updatedAt: now() }, { merge: true });

  // The call becomes part of the Mate's own history: report, answers, and what was actually said (condensed),
  // so its next chat turn knows the call happened and what the owner said in their own words.
  const said = transcript.filter((t) => String(t.text ?? '').trim()).map((t) => `${t.who === 'you' ? 'You' : call.mateName ?? 'Mate'}: ${String(t.text).trim()}`);
  const heard = said.length ? `\n\n**What was said**\n${clip(said.join('\n'), 2500)}${said.join('\n').length > 2500 ? '\n…' : ''}` : '';
  const body = `**Call report** ${report.outcome === 'missed' ? '(no answer)' : ''}\n\n${report.summary}${report.answers?.length ? `\n\n${report.answers.map((a) => `- ${a}`).join('\n')}` : ''}${report.followups?.length ? `\n\nNext:\n${report.followups.map((a) => `- ${a}`).join('\n')}` : ''}${heard}`;
  // Follow-ups the owner asked for become tasks; a run that asked for the call hears the answers.
  for (const f of (report.followups ?? []).slice(0, 5)) {
    try { const t = { title: clip(f, 200), detail: `From your call with ${call.mateName}: ${clip(report.summary, 400)}`, status: 'todo', tags: ['call'], createdAt: now(), updatedAt: now() }; const r = userCol(uid, 'tasks').doc(); await r.set(t); await hooks.tasks?.(uid, r.id, t, 'set'); } catch { /* best effort */ }
  }
  if (call.runId && report.outcome !== 'missed') { try { hooks.steer?.(uid, call.runId, `The owner answered on a call with ${call.mateName}: ${report.summary}${report.answers?.length ? ` | ${report.answers.join(' | ')}` : ''}`); } catch { /* the run is not live any more */ } }
  try { // drop the report into the chat the call came from, as the Mate that asked for it
    const convs = (await userCol(uid, 'conversations').limit(80).get()).docs;
    const d = convs.find((x) => x.id === call.convId) ?? convs.filter((x) => x.data().mate === call.mate).sort((a, b) => String(b.data().updatedAt).localeCompare(String(a.data().updatedAt)))[0];
    if (d) { const msgs = d.data().messages ?? []; msgs.push({ id: rid(), role: 'mate', mate: call.mate, text: body, at: now(), state: 'sent', callId: id }); await d.ref.set({ messages: msgs, updatedAt: now() }, { merge: true }); }
  } catch { /* chat delivery is best effort */ }
  void Promise.resolve(hooks.notify?.(uid, `Call report from ${call.mateName ?? MATE[call.mate]?.name ?? 'your Mate'}: ${report.summary}${report.answers?.length ? `\n${report.answers.join('\n')}` : ''}`)).catch(() => {});
  // What the owner said teaches this Mate (shared facts, and journal notes when it was feedback on its work).
  if (you) void getSettings(uid).then((settings) => learnFromTurn(uid, { user: you.slice(0, 1500), assistant: report.summary, mate: call.mate, settings })).catch(() => {});
  return { ...call, report };
}
