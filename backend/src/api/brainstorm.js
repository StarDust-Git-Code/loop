// Round-table brainstorming: the pinged Mates talk to each other for N rounds, then one of them writes a summary.
import { converse } from './agent.js';
import { MATE } from './mates.js';
import { now, uid as rid } from '../lib/env.js';

const MAX_PARTICIPANTS = 5;

/** Who sits at the table: the @mentioned Mates if there are at least two, else the chat's Mates, topped up with Planner/Spark. */
export function pickParticipants({ mentioned, home, members, cfgs }) {
  const on = (k) => MATE[k] && (cfgs[k] ? cfgs[k].enabled !== false : MATE[k].core);
  let list = mentioned.length >= 2 ? mentioned : [...new Set([...mentioned, home, ...members])];
  list = list.filter(on);
  for (const k of ['planner', 'spark', 'research', 'writer']) if (list.length < 3 && on(k) && !list.includes(k)) list.push(k);
  return [...new Set(list)].slice(0, MAX_PARTICIPANTS);
}

const nameOf = (k) => MATE[k]?.name ?? k;
const turnPrompt = (topic, people, me, n, of) => `Round table on: "${topic}"
Seated: ${people.map(nameOf).join(', ')}. You speak as ${nameOf(me)} (${MATE[me]?.blurb ?? ''}). This is round ${n} of ${of}.
Read what the others said above, then add ONE new angle or sharpen someone's idea. Speak to the others by name, disagree respectfully where you really disagree, and stay in your own role. Under 120 words. No greetings, no repeating points already made.${n === of ? ' This is the final round: end with your single best recommendation.' : ''}`;

const summaryPrompt = (topic, people) => `The round table on "${topic}" is over (${people.map(nameOf).join(', ')}). Write the summary for the owner in Markdown with these sections:
**Ideas worth keeping** (bullets, credit who said it)
**Where we agree**
**Where we disagree** (say why)
**Recommended next steps** (numbered, concrete)
**Open questions**
Be faithful to what was said; do not invent new ideas. Under 250 words.`;

/**
 * emit(event) streams to the client; onMessage(msg) persists each turn. Resolves with the stored messages.
 * baseHistory(me) = the chat's earlier context for that Mate (ends with the owner's topic message).
 */
export async function runRoundTable({ uid, topic, participants, rounds, cfgs, settings, baseHistory, emit, signal, onMessage }) {
  const table = []; const out = [];
  const speak = async (me, history, extra) => {
    emit({ type: 'mate', mate: me, ...extra });
    let r;
    try { r = await converse({ uid, mateKey: me, cfg: cfgs[me] ?? {}, settings, mode: 'brainstorm', history, emit, signal, maxTokens: extra?.summary ? 900 : 600, readOnly: true, noTools: !!extra?.summary, others: participants.filter((k) => k !== me).map(nameOf) }); }
    catch (e) { if (signal?.aborted) return null; r = { text: `(${nameOf(me)} could not answer: ${String(e.message).slice(0, 160)})`, error: true }; }
    const msg = { id: rid(), role: 'mate', mate: me, text: r.text, at: now(), state: r.error ? 'error' : 'sent', ...extra, ...(r.thought ? { thought: r.thought.slice(0, 8000) } : {}) };
    out.push(msg); await onMessage(msg); emit({ type: 'done', message: msg });
    return msg;
  };

  for (let n = 1; n <= rounds; n++) {
    emit({ type: 'round', n, of: rounds });
    for (const me of participants) {
      if (signal?.aborted) return out;
      const history = [...baseHistory(me), ...table.map((t) => ({ role: 'user', content: `[${nameOf(t.mate)}]: ${t.text}` })), { role: 'user', content: turnPrompt(topic, participants, me, n, rounds) }];
      const msg = await speak(me, history, { round: n });
      if (!msg) return out;
      if (!msg.state || msg.state === 'sent') table.push({ mate: me, text: msg.text });
    }
  }
  if (signal?.aborted || !table.length) return out;
  const mod = participants.includes('planner') ? 'planner' : participants[0];
  emit({ type: 'round', n: rounds + 1, of: rounds });
  await speak(mod, [...baseHistory(mod), ...table.map((t) => ({ role: 'user', content: `[${nameOf(t.mate)}]: ${t.text}` })), { role: 'user', content: summaryPrompt(topic, participants) }], { round: rounds + 1, summary: true });
  return out;
}
