// LLM gateway: OpenAI-compatible providers with failover.
// Order: the requested provider first, then the user's other enabled providers, then platform providers from env vars.
import { env, num } from '../lib/env.js';
import { open } from '../lib/crypto.js';
import { userCol } from './db.js';

const ENV_PROVIDERS = [
  { id: 'env-nvidia', name: 'NVIDIA NIM', key: 'NVIDIA_API_KEY', baseUrl: 'https://integrate.api.nvidia.com/v1', model: () => env('NVIDIA_MODEL', 'nvidia/nemotron-3-super-120b-a12b') },
  { id: 'env-gemini', name: 'Gemini', key: 'GEMINI_API_KEY', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: () => env('GEMINI_MODEL', 'gemini-2.5-flash') },
  { id: 'env-groq', name: 'Groq', key: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1', model: () => env('GROQ_MODEL', 'llama-3.3-70b-versatile') },
  { id: 'env-cerebras', name: 'Cerebras', key: 'CEREBRAS_API_KEY', baseUrl: 'https://api.cerebras.ai/v1', model: () => env('CEREBRAS_MODEL', 'llama-3.3-70b') },
  { id: 'env-openrouter', name: 'OpenRouter', key: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1', model: () => env('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free') },
];

const cooldown = new Map(); // provider id -> ms timestamp until which we skip it
const authHeaders = (baseUrl, key) => (/anthropic\.com/.test(baseUrl)
  ? { authorization: `Bearer ${key}`, 'x-api-key': key, 'anthropic-version': '2023-06-01' }
  : { authorization: `Bearer ${key}` });

export const providerKey = (uid, p) => open(p.keyEnc, `${uid}|provider|${p.id}`);

async function userProviders(uid) {
  const snap = await userCol(uid, 'providers').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.enabled !== false && p.keyEnc);
}

/** Resolve a settings/mate model string into an ordered attempt list [{id,name,baseUrl,key,model}]. */
export async function plan(uid, model = '') {
  const mine = await userProviders(uid);
  const [wantProv, wantModel] = model.includes('::') ? model.split('::') : ['', ''];
  const list = [];
  const push = (p, m) => { try { list.push({ id: p.id, name: p.name, baseUrl: p.baseUrl.replace(/\/$/, ''), key: providerKey(uid, p), model: m || p.models?.[0] }); } catch { /* undecryptable key: skip */ } };
  const first = mine.find((p) => p.id === wantProv);
  if (first) push(first, wantModel);
  for (const p of mine) if (p !== first) push(p, '');
  for (const e of ENV_PROVIDERS) if (env(e.key)) list.push({ id: e.id, name: e.name, baseUrl: e.baseUrl, key: env(e.key), model: e.model() });
  return list.filter((a) => a.model);
}

/** Single completion with failover. Returns { text, provider, model }. */
export async function chat(uid, { model = '', messages, temperature = 0.4, maxTokens = 2048, json = false, signal } = {}) {
  const attempts = await plan(uid, model);
  if (!attempts.length) throw Object.assign(new Error('No LLM provider configured. Add one in Settings, or set NVIDIA_API_KEY / GEMINI_API_KEY on the API service.'), { statusCode: 424 });
  const errors = [];
  const t = Date.now();
  const live = attempts.filter((a) => (cooldown.get(a.id) ?? 0) < t);
  for (const a of live.length ? live : attempts) {
    try {
      const body = { model: a.model, messages, temperature, max_tokens: maxTokens, stream: false, ...(json ? { response_format: { type: 'json_object' } } : {}) };
      let res = await fetch(`${a.baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(a.baseUrl, a.key) }, body: JSON.stringify(body), signal: signal ?? AbortSignal.timeout(num('LLM_TIMEOUT_MS', 90_000)) });
      if (res.status === 400 && json) { // some providers reject response_format: retry without it
        delete body.response_format;
        res = await fetch(`${a.baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(a.baseUrl, a.key) }, body: JSON.stringify(body), signal: signal ?? AbortSignal.timeout(num('LLM_TIMEOUT_MS', 90_000)) });
      }
      if (!res.ok) {
        const msg = (await res.text().catch(() => '')).slice(0, 200);
        errors.push(`${a.name}: ${res.status} ${msg}`);
        if (res.status === 429 || res.status >= 500) cooldown.set(a.id, Date.now() + 60_000);
        if (res.status === 401 || res.status === 403) cooldown.set(a.id, Date.now() + 10 * 60_000);
        continue;
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.length) return { text, provider: a.name, model: a.model };
      errors.push(`${a.name}: empty reply`);
    } catch (e) {
      errors.push(`${a.name}: ${e.name === 'TimeoutError' ? 'timed out' : e.message}`);
      cooldown.set(a.id, Date.now() + 30_000);
    }
  }
  throw Object.assign(new Error(`All providers failed. ${errors.join(' | ')}`), { statusCode: 502 });
}

/** Pull a JSON object out of a model reply (handles ``` fences and chatter). */
export function extractJson(text) {
  const t = text.replace(/```(?:json)?/gi, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

export async function fetchModels(uid, p) {
  const key = providerKey(uid, p);
  const res = await fetch(`${p.baseUrl.replace(/\/$/, '')}/models`, { headers: authHeaders(p.baseUrl, key), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw Object.assign(new Error(`Provider answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`), { statusCode: 502 });
  const j = await res.json();
  const arr = Array.isArray(j) ? j : j.data ?? j.models ?? [];
  return arr.map((m) => (typeof m === 'string' ? m : m.id ?? m.name)).filter(Boolean).map((s) => String(s).replace(/^models\//, ''));
}

/**
 * Streaming completion with failover. Fails over to the next provider only until the first token arrives;
 * after that an error is thrown (a half-written answer cannot be restarted elsewhere).
 * Reasoning tokens (reasoning_content) are ignored; only the answer is streamed to onDelta.
 */
export async function chatStream(uid, { model = '', messages, temperature = 0.4, maxTokens = 2048, signal } = {}, onDelta = () => {}) {
  const attempts = await plan(uid, model);
  if (!attempts.length) throw Object.assign(new Error('No LLM provider configured. Add one in Settings, or set NVIDIA_API_KEY / GEMINI_API_KEY on the API service.'), { statusCode: 424 });
  const errors = []; const t = Date.now();
  const live = attempts.filter((a) => (cooldown.get(a.id) ?? 0) < t);
  for (const a of live.length ? live : attempts) {
    let got = false; let full = '';
    try {
      const res = await fetch(`${a.baseUrl}/chat/completions`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(a.baseUrl, a.key) },
        body: JSON.stringify({ model: a.model, messages, temperature, max_tokens: maxTokens, stream: true }),
        signal: signal ?? AbortSignal.timeout(num('LLM_STREAM_TIMEOUT_MS', 180_000)),
      });
      if (!res.ok || !res.body) {
        errors.push(`${a.name}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`);
        if (res.status === 429 || res.status >= 500) cooldown.set(a.id, Date.now() + 60_000);
        if (res.status === 401 || res.status === 403) cooldown.set(a.id, Date.now() + 10 * 60_000);
        continue;
      }
      if ((res.headers.get('content-type') || '').includes('application/json')) { // provider ignored stream:true
        const text = (await res.json())?.choices?.[0]?.message?.content;
        if (typeof text === 'string' && text) { onDelta(text); return { text, provider: a.name, model: a.model }; }
        errors.push(`${a.name}: empty reply`); continue;
      }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let j; try { j = JSON.parse(data); } catch { continue; }
          const d = j?.choices?.[0]?.delta?.content;
          if (typeof d === 'string' && d) { got = true; full += d; onDelta(d); }
        }
      }
      if (full) return { text: full, provider: a.name, model: a.model };
      errors.push(`${a.name}: empty stream`);
    } catch (e) {
      if (got) throw Object.assign(new Error(`The answer was cut off: ${e.message}`), { statusCode: 502 });
      errors.push(`${a.name}: ${e.name === 'TimeoutError' ? 'timed out' : e.message}`);
      cooldown.set(a.id, Date.now() + 30_000);
    }
  }
  throw Object.assign(new Error(`All providers failed. ${errors.join(' | ')}`), { statusCode: 502 });
}
