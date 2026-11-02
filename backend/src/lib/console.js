// In-memory ring buffer of everything this process prints (console + pino JSON lines), so Mates can read the "console".
const CAP = 600;
const buf = [];
const LEVELS = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' };
const redact = (s) => s
  .replace(/(authorization|x-api-key|x-svc|token|secret|password|apikey)(["':=\s]+)[^\s",}]{6,}/gi, '$1$2[redacted]')
  .replace(/\b(sk|nvapi|gsk|AIza|ghp|github_pat|xox[a-z])[-_A-Za-z0-9]{12,}/g, '[redacted-key]')
  .replace(/Bearer\s+[\w.\-]{12,}/g, 'Bearer [redacted]');

function push(level, text) {
  const t = String(text).trim(); if (!t) return;
  buf.push({ at: new Date().toISOString(), level, text: redact(t).slice(0, 600) });
  if (buf.length > CAP) buf.splice(0, buf.length - CAP);
}
function line(chunk, fallback) {
  for (const raw of String(chunk).split('\n')) {
    if (!raw.trim()) continue;
    let lvl = fallback, msg = raw;
    if (raw.startsWith('{"level"')) { try { const j = JSON.parse(raw); lvl = LEVELS[j.level] ?? fallback; msg = [j.msg, j.err?.message, j.req?.method && `${j.req.method} ${j.req.url}`, j.res?.statusCode, j.responseTime && `${Math.round(j.responseTime)}ms`].filter(Boolean).join(' '); } catch { /* plain line */ } }
    push(lvl, msg);
  }
}
let on = false;
export function captureConsole() {
  if (on) return; on = true;
  for (const [stream, lvl] of [[process.stdout, 'info'], [process.stderr, 'error']]) {
    const orig = stream.write.bind(stream);
    stream.write = (chunk, ...rest) => { try { line(chunk, lvl); } catch { /* never break logging */ } return orig(chunk, ...rest); };
  }
}
/** Newest last. level: minimum severity name. */
export function tail({ level = '', grep = '', n = 40, sinceMs = 0 } = {}) {
  const order = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  const min = level ? order.indexOf(level) : 0;
  const re = grep ? new RegExp(grep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
  const from = sinceMs ? Date.now() - sinceMs : 0;
  return buf.filter((l) => order.indexOf(l.level) >= min && (!re || re.test(l.text)) && Date.parse(l.at) >= from).slice(-Math.min(n, 100));
}
export const counts = (sinceMs) => { const from = Date.now() - sinceMs; const c = { warn: 0, error: 0 }; for (const l of buf) if (Date.parse(l.at) >= from) { if (l.level === 'warn') c.warn++; if (l.level === 'error' || l.level === 'fatal') c.error++; } return c; };
