// Knowledge indexing + keyword search. Text is stored on the doc; search scores paragraphs (no vectors yet).
import { userCol } from './db.js';
import { now } from '../lib/env.js';
import { embed, embedReady, rank } from './vec.js';

const CAP = 300_000;
const htmlToText = (h) => h.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export async function indexKnowledge(uid, id) {
  const ref = userCol(uid, 'knowledge').doc(id);
  const d = (await ref.get()).data();
  if (!d || d.status !== 'pending') return;
  try {
    let text = d.text ?? '';
    if (d.kind === 'url') {
      if (!/^https?:\/\//i.test(d.url || '')) throw new Error('Not a web address');
      const res = await fetch(d.url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'LoopmatesBot/0.1' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = htmlToText(await res.text());
    }
    if (!text.trim()) throw new Error('Nothing to index yet (no text)');
    text = text.slice(0, CAP);
    const chunks = await vectorize(text);
    await ref.set({ text, size: text.length, status: 'indexed', updatedAt: now(), chunks: chunks.items, vm: chunks.vm }, { merge: true });
  } catch (e) { await ref.set({ status: 'error', updatedAt: now(), error: String(e.message).slice(0, 200) }, { merge: true }); }
}

/** Split into ~900 char chunks and embed them (best effort; keyword search still works without). */
async function vectorize(text) {
  if (!embedReady()) return { items: [], vm: '' };
  const parts = []; let cur = '';
  for (const para of text.split(/\n{2,}|(?<=[.!?])\s+/)) {
    if ((cur + ' ' + para).length > 900 && cur) { parts.push(cur.trim()); cur = para; } else cur += ' ' + para;
  }
  if (cur.trim()) parts.push(cur.trim());
  const use = parts.slice(0, 200);
  const e = await embed(use);
  if (!e) return { items: [], vm: '' };
  let bytes = 0; const items = [];
  for (let i = 0; i < use.length; i++) { bytes += e.vecs[i].length + 40; if (bytes > 700_000) break; items.push({ t: use[i], v: e.vecs[i] }); }
  return { items, vm: e.vm };
}

export async function searchKnowledge(uid, q, k = 5) {
  const sem = await semantic(uid, q, k);
  if (sem.length) return sem;
  const terms = (q.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).slice(0, 12);
  if (!terms.length) return [];
  const snap = await userCol(uid, 'knowledge').where('status', '==', 'indexed').limit(200).get();
  const hits = [];
  for (const d of snap.docs) {
    const { name, text = '' } = d.data();
    for (const para of text.split(/\n{2,}|(?<=[.!?])\s{2,}/)) {
      const low = para.toLowerCase();
      const score = terms.reduce((s, t) => s + (low.includes(t) ? 1 : 0), 0);
      if (score) hits.push({ id: d.id, name, snippet: para.trim().slice(0, 280), score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k).map(({ score, ...r }) => r);
}

async function semantic(uid, q, k) {
  try {
    if (!embedReady()) return [];
    const qe = await embed([q], { query: true }); if (!qe?.vecs[0]) return [];
    const snap = await userCol(uid, 'knowledge').where('status', '==', 'indexed').limit(200).get();
    const items = [];
    for (const d of snap.docs) { const x = d.data(); if (x.vm !== qe.vm) continue; for (const c of x.chunks ?? []) items.push({ id: d.id, name: x.name, snippet: c.t.slice(0, 280), vec: c.v, vm: x.vm }); }
    return rank(qe.vecs[0], qe.vm, items, k).filter((x) => x.sim > 0.4).map(({ vec, vm, sim, ...r }) => r);
  } catch { return []; }
}
