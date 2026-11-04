// Call missions: an agent asks for a call with a goal and questions; a Gemini Live voice sub-agent carries the call and
// afterwards a report is written to the call doc, the originating chat and Telegram/Discord.
import { userCol } from './db.js';
import { chat, extractJson } from './llm.js';
import { learnFromTurn } from './memory.js';
import { getSettings } from './settings.js';
import { hooks } from './toolhooks.js';
import { MATE } from './mates.js';
import { now, uid as rid } from '../lib/env.js';

const clip = (s, n) => String(s ?? '').slice(0, n);

export async function createCall(uid, { mate = 'mimo', goal = '', questions = [], reason = '', convId = '', runId = '' }) {
  const ref = userCol(uid, 'calls').doc();
  const doc = { mate, goal: clip(goal, 600), reason: clip(reason, 300), questions: questions.map((q) => clip(q, 240)).filter(Boolean).slice(0, 8), convId: convId || '', runId: runId || '', status: 'ringing', createdAt: now(), updatedAt: now(), transcript: [], report: null };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}
export async function getCall(uid, id) { const d = await userCol(uid, 'calls').doc(String(id).slice(0, 60)).get(); return d.exists ? { id: d.id, ...d.data() } : null; }
export async function listCalls(uid, limit = 15) {
  const rows = (await userCol(uid, 'calls').limit(100).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
}

/** The briefing the voice sub-agent receives. */
export function missionPrompt(call) {
  const lines = [`You are the voice sub-agent of ${MATE[call.mate]?.name ?? 'a Mate'}. You are calling the owner on behalf of your Mate to complete a mission, then report back.`];
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

  const body = `**Call report** ${report.outcome === 'missed' ? '(no answer)' : ''}\n\n${report.summary}${report.answers?.length ? `\n\n${report.answers.map((a) => `- ${a}`).join('\n')}` : ''}${report.followups?.length ? `\n\nNext:\n${report.followups.map((a) => `- ${a}`).join('\n')}` : ''}`;
  try { // drop the report into the chat the call came from, as the Mate that asked for it
    const convs = (await userCol(uid, 'conversations').limit(80).get()).docs;
    const d = convs.find((x) => x.id === call.convId) ?? convs.filter((x) => x.data().mate === call.mate).sort((a, b) => String(b.data().updatedAt).localeCompare(String(a.data().updatedAt)))[0];
    if (d) { const msgs = d.data().messages ?? []; msgs.push({ id: rid(), role: 'mate', mate: call.mate, text: body, at: now(), state: 'sent', callId: id }); await d.ref.set({ messages: msgs, updatedAt: now() }, { merge: true }); }
  } catch { /* chat delivery is best effort */ }
  void Promise.resolve(hooks.notify?.(uid, `Call report from ${MATE[call.mate]?.name ?? 'your Mate'}: ${report.summary}${report.answers?.length ? `\n${report.answers.join('\n')}` : ''}`)).catch(() => {});
  if (you) void getSettings(uid).then((settings) => learnFromTurn(uid, { user: you.slice(0, 1500), assistant: report.summary, mate: call.mate, settings })).catch(() => {});
  return { ...call, report };
}
