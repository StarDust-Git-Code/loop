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


/* ---- thinking effort ---- levels: low | medium | high | xhigh (the dashboard's "default" means high) */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh'];
export const effortOf = (v) => (EFFORTS.includes(v) ? v : 'high');
export const TOKEN_MULT = { low: 1, medium: 1.5, high: 2, xhigh: 3 };
const noExtras = new Set(); // provider ids that rejected the reasoning parameters: we stop sending them
/** Provider-specific reasoning switches. Unknown providers get none; a 400/422 makes us retry without (see withEffort). */
function extrasFor(a, effort) {
  if (!effort || noExtras.has(a.id)) return null;
  const e3 = effort === 'xhigh' ? 'high' : effort;
  if (/generativelanguage\.googleapis\.com|api\.groq\.com|api\.cerebras\.ai|api\.openai\.com/.test(a.baseUrl)) return { reasoning_effort: e3 };
  if (/openrouter\.ai/.test(a.baseUrl)) return { reasoning: { effort: e3 } };
  if (/integrate\.api\.nvidia\.com/.test(a.baseUrl)) return { chat_template_kwargs: { enable_thinking: effort !== 'low' } };
  return null;
}
export const llmStatus = () => [...cooldown.entries()].filter(([, t]) => t > Date.now()).map(([id, t]) => ({ id, secondsLeft: Math.ceil((t - Date.now()) / 1000) }));
export async function providerSummary(uid) {
  const list = await plan(uid, '');
  return list.map((a) => ({ name: a.name, model: a.model, cooling: Math.max(0, Math.ceil(((cooldown.get(a.id) ?? 0) - Date.now()) / 1000)) }));
}

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
export async function chat(uid, { model = '', messages, temperature = 0.4, maxTokens = 2048, json = false, effort, fixedMax = false, signal } = {}) {
  const attempts = await plan(uid, model);
  if (!attempts.length) throw Object.assign(new Error('No LLM provider configured. Add one in Settings, or set NVIDIA_API_KEY / GEMINI_API_KEY on the API service.'), { statusCode: 424 });
  const errors = [];
  const t = Date.now();
  const live = attempts.filter((a) => (cooldown.get(a.id) ?? 0) < t);
  for (const a of live.length ? live : attempts) {
    try {
      const ex = extrasFor(a, effort);
      const body = { model: a.model, messages, temperature, max_tokens: effort && !fixedMax ? Math.min(8000, Math.round(maxTokens * (TOKEN_MULT[effort] ?? 1))) : maxTokens, stream: false, ...(json ? { response_format: { type: 'json_object' } } : {}), ...(ex ?? {}) };
      let res = await fetch(`${a.baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(a.baseUrl, a.key) }, body: JSON.stringify(body), signal: signal ?? AbortSignal.timeout(num('LLM_TIMEOUT_MS', 90_000)) });
      if ((res.status === 400 || res.status === 422) && ex) { // provider does not know the reasoning parameters
        noExtras.add(a.id); for (const k of Object.keys(ex)) delete body[k];
        res = await fetch(`${a.baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(a.baseUrl, a.key) }, body: JSON.stringify(body), signal: signal ?? AbortSignal.timeout(num('LLM_TIMEOUT_MS', 90_000)) });
      }
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

const noTools = new Map(); // provider id -> until (ms): rejected native tool calling, so the text protocol is used for a while
const parseArgs = (raw) => { if (raw && typeof raw === 'object') return raw; try { const v = JSON.parse(raw || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return { __bad: String(raw).slice(0, 200) }; } };

/**
 * Streaming completion with failover.
 *  tools: OpenAI-style [{type:'function',function:{name,description,parameters}}]. Used natively when the provider accepts them,
 *  otherwise `textMessages` (which carry the text tool protocol) are sent and `mode` comes back as 'text'.
 *  onStart({mode}) fires once, right before the first output arrives. Returns { text, toolCalls:[{id,name,args}], mode, provider, model }.
 */
export async function chatStream(uid, { model = '', messages, textMessages, tools, temperature = 0.4, maxTokens = 2048, effort, fixedMax = false, signal } = {}, onDelta = () => {}, onStart = () => {}) {
  const attempts = await plan(uid, model);
  if (!attempts.length) throw Object.assign(new Error('No LLM provider configured. Add one in Settings, or set NVIDIA_API_KEY / GEMINI_API_KEY on the API service.'), { statusCode: 424 });
  const errors = []; const t = Date.now();
  const live = attempts.filter((a) => (cooldown.get(a.id) ?? 0) < t);
  for (const a of live.length ? live : attempts) {
    let got = false; let full = ''; const calls = [];
    const begin = (mode) => { if (!got) { got = true; onStart({ mode }); } };
    try {
      let native = !!tools?.length && (noTools.get(a.id) ?? 0) < Date.now();
      const ex = extrasFor(a, effort);
      const send = (extra, withTools) => fetch(`${a.baseUrl}/chat/completions`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(a.baseUrl, a.key) },
        body: JSON.stringify({ model: a.model, messages: withTools ? messages : (textMessages ?? messages), temperature, max_tokens: effort && !fixedMax ? Math.min(8000, Math.round(maxTokens * (TOKEN_MULT[effort] ?? 1))) : maxTokens, stream: true, ...(withTools ? { tools, tool_choice: 'auto' } : {}), ...(extra ?? {}) }),
        signal: signal ?? AbortSignal.timeout(num('LLM_STREAM_TIMEOUT_MS', 180_000)),
      });
      let res = await send(ex, native);
      if ((res.status === 400 || res.status === 422) && ex) { noExtras.add(a.id); res = await send(null, native); }
      if ((res.status === 400 || res.status === 422) && native) { noTools.set(a.id, Date.now() + 30 * 60_000); native = false; res = await send(null, false); }
      if (!res.ok || !res.body) {
        errors.push(`${a.name}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`);
        if (res.status === 429 || res.status >= 500) cooldown.set(a.id, Date.now() + 60_000);
        if (res.status === 401 || res.status === 403) cooldown.set(a.id, Date.now() + 10 * 60_000);
        continue;
      }
      const mode = native ? 'native' : 'text';
      const finish = () => ({ text: full, toolCalls: calls.filter((c) => c.name).map((c, i) => ({ id: c.id || `call_${Date.now().toString(36)}${i}`, name: c.name, args: parseArgs(c.args) })), mode, provider: a.name, model: a.model });
      if ((res.headers.get('content-type') || '').includes('application/json')) { // provider ignored stream:true
        const m = (await res.json())?.choices?.[0]?.message;
        full = typeof m?.content === 'string' ? m.content : '';
        for (const tc of m?.tool_calls ?? []) calls.push({ id: tc.id, name: tc.function?.name, args: tc.function?.arguments });
        if (full || calls.length) { begin(mode); if (full) onDelta(full); return finish(); }
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
          const dl = j?.choices?.[0]?.delta;
          if (typeof dl?.content === 'string' && dl.content) { begin(mode); full += dl.content; onDelta(dl.content); }
          for (const tc of dl?.tool_calls ?? []) {
            begin(mode);
            const slot = tc.index ?? (tc.id || tc.function?.name ? calls.length : Math.max(0, calls.length - 1));
            const c = (calls[slot] ??= { id: '', name: '', args: '' });
            if (tc.id) c.id = tc.id;
            if (tc.function?.name) c.name = tc.function.name;
            if (typeof tc.function?.arguments === 'string') c.args += tc.function.arguments;
          }
        }
      }
      if (full || calls.some((c) => c?.name)) return finish();
      errors.push(`${a.name}: empty stream`);
    } catch (e) {
      if (got) throw Object.assign(new Error(`The answer was cut off: ${e.message}`), { statusCode: 502 });
      errors.push(`${a.name}: ${e.name === 'TimeoutError' ? 'timed out' : e.message}`);
      cooldown.set(a.id, Date.now() + 30_000);
    }
  }
  throw Object.assign(new Error(`All providers failed. ${errors.join(' | ')}`), { statusCode: 502 });
}
