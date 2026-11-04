// Lets chat apps (Telegram, Discord) talk to a real Mate: full tools, memory, and a short rolling history per channel.
import { db, userCol } from './db.js';
import { converse } from './agent.js';
import { getSettings } from './settings.js';
import { learnFromTurn } from './memory.js';
import { MATE } from './mates.js';
import { now } from '../lib/env.js';

const KEEP = 14;
export async function askMate(uid, { key, text, mate = 'mimo', style = 'chat app' }) {
  if (!MATE[mate]) mate = 'mimo';
  const [settings, mates] = await Promise.all([getSettings(uid), userCol(uid, 'mates').get()]);
  const cfgs = Object.fromEntries(mates.docs.map((d) => [d.id, d.data()]));
  if (cfgs[mate]?.enabled === false) mate = 'mimo';
  const ref = db.collection('bridgeChats').doc(key.replace(/[\/]/g, '_'));
  const hist = (await ref.get()).data()?.turns ?? [];
  const history = [...hist, { role: 'user', content: text }];
  const r = await converse({ uid, mateKey: mate, cfg: cfgs[mate] ?? {}, settings, mode: 'chat', history, ctx: { convId: `bridge-${key}`.slice(0, 80) }, others: [] ,
    maxTokens: 900 });
  const reply = String(r.text || '').trim() || 'I could not put an answer together. Try again.';
  await ref.set({ uid, turns: [...history, { role: 'assistant', content: reply }].slice(-KEEP), updatedAt: now() });
  void learnFromTurn(uid, { user: text, assistant: reply, mate, settings });
  return { text: reply, mate };
}
