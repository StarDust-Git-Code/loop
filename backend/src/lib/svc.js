// Service-to-service auth: HMAC-SHA256 over "<ts>.<METHOD>.<path>" with the shared SERVICE_SECRET. Valid for 60 s.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { need } from './env.js';

const sig = (ts, method, path) => createHmac('sha256', need('SERVICE_SECRET')).update(`${ts}.${method.toUpperCase()}.${path}`).digest('hex');

export function signHeader(method, path) {
  const ts = Date.now();
  return `${ts}.${sig(ts, method, path)}`;
}

export function verifyHeader(header, method, path) {
  if (!header || typeof header !== 'string') return false;
  const [ts, mac] = header.split('.');
  const t = Number(ts);
  if (!t || !mac || Math.abs(Date.now() - t) > 60_000) return false;
  const a = Buffer.from(mac, 'hex'); const b = Buffer.from(sig(t, method, path), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Call another Loopmates service. Retries once on network errors (the target may be waking from sleep). */
export async function svcFetch(base, path, { method = 'GET', body, raw, headers = {}, timeoutMs = 90_000 } = {}) {
  if (!base) throw new Error('Service URL not configured');
  const pathOnly = path.split('?')[0];
  const send = () => fetch(base.replace(/\/$/, '') + path, {
    method,
    headers: { 'x-svc': signHeader(method, pathOnly), ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let res;
  try { res = await send(); } catch { res = await send(); }
  return res;
}

export async function svcJson(base, path, opts) {
  const res = await svcFetch(base, path, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}
