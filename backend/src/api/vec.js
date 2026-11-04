// Embeddings + tiny vector store helpers. Vectors are normalised, quantised to int8 and kept as base64 on the doc
// they describe (memories, knowledge chunks), so no vector database is needed. Every vector is tagged with the model
// that made it; vectors from different models are never compared.
import { env } from '../lib/env.js';
import { plan } from './llm.js';

const down = new Map(); // endpoint id -> retry-after timestamp
const GEMINI = () => env('GEMINI_API_KEY');
const NVIDIA = () => env('NVIDIA_API_KEY');

function endpoints() {
  const list = [];
  if (GEMINI()) list.push({ id: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/embeddings', key: GEMINI(), model: env('EMBED_MODEL_GEMINI', 'gemini-embedding-001'), extra: { dimensions: 256 } });
  if (NVIDIA()) list.push({ id: 'nvidia', url: 'https://integrate.api.nvidia.com/v1/embeddings', key: NVIDIA(), model: env('EMBED_MODEL_NVIDIA', 'nvidia/nv-embedqa-e5-v5'), extra: { truncate: 'END' }, kind: true });
  return list;
}
export const embedReady = () => endpoints().length > 0;

const l2 = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
export const pack = (v) => Buffer.from(Int8Array.from(l2(v).map((x) => Math.max(-127, Math.min(127, Math.round(x * 127)))))).toString('base64');
const unpack = (s) => Int8Array.from(Buffer.from(s, 'base64'));
export function cosine(a, b) { // both packed strings
  const x = unpack(a), y = unpack(b); if (x.length !== y.length || !x.length) return 0;
  let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * y[i];
  return s / (127 * 127);
}

/** Embed a list of strings. Returns { vm, vecs: [packed...] } or null when no provider is available. `query` marks search queries. */
export async function embed(texts, { query = false } = {}) {
  const input = texts.map((t) => String(t).slice(0, 4000)).filter(Boolean);
  if (!input.length) return { vm: '', vecs: [] };
  for (const e of endpoints()) {
    if ((down.get(e.id) ?? 0) > Date.now()) continue;
    try {
      const vecs = [];
      for (let i = 0; i < input.length; i += 64) {
        const body = { model: e.model, input: input.slice(i, i + 64), ...e.extra, ...(e.kind ? { input_type: query ? 'query' : 'passage' } : {}) };
        const r = await fetch(e.url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${e.key}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000) });
        if (!r.ok) throw new Error(`${e.id} embeddings answered ${r.status}`);
        const j = await r.json();
        for (const d of j.data ?? []) vecs.push(pack(d.embedding));
      }
      if (vecs.length !== input.length) throw new Error('embedding count mismatch');
      return { vm: `${e.id}:${e.model}`, vecs };
    } catch { down.set(e.id, Date.now() + 5 * 60_000); } // back off this endpoint for 5 min
  }
  return null;
}

/** Rank items {vec, vm} against a query vector. */
export const rank = (qv, vm, items, k) => items.filter((x) => x.vec && x.vm === vm).map((x) => ({ ...x, sim: cosine(qv, x.vec) })).sort((a, b) => b.sim - a.sim).slice(0, k);
