// MCP client. HTTP (streamable HTTP / JSON) and stdio servers, owner-configured in Dashboard → MCP.
// stdio is allowed now that the server runs on the owner's own computer: the command is the owner's, run with
// their own rights. Sessions are pooled per server, killed after 5 idle minutes; every call times out after 60 s.
// Secret values in a server's `config` are sealed by crud.js: for HTTP they become request headers, for stdio env vars.
import { spawn } from 'node:child_process';
import { open } from '../lib/crypto.js';

const HEAD = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
const PROTOCOL = '2025-03-26';
const CLIENT = { name: 'loopmates', version: '0.2.0' };
const IDLE_MS = 5 * 60_000, CALL_MS = 60_000, LIST_TTL = 5 * 60_000;
const WIN = process.platform === 'win32';
const bad = (m) => Object.assign(new Error(m), { tool: true });

/** The server's secret config, unsealed (headers or env). */
function secretsOf(uid, id, s) {
  const out = { ...(s.config ?? {}) };
  for (const [k, v] of Object.entries(s.secretsEnc ?? {})) { try { out[k] = open(v, `${uid}|connection|${id}|${k}`); } catch { /* wrong key: skip */ } }
  for (const k of Object.keys(out)) if (typeof out[k] !== 'string' || out[k].startsWith('•')) delete out[k];
  return out;
}

/* ---------- HTTP ---------- */
async function rpc(url, body, sid, headers = {}) {
  const res = await fetch(url, { method: 'POST', headers: { ...HEAD, ...headers, ...(sid ? { 'mcp-session-id': sid } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(CALL_MS) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
  let json = null;
  if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
    for (const line of text.split('\n')) if (line.startsWith('data:')) { try { const j = JSON.parse(line.slice(5)); if (j.id === body.id) json = j; } catch { /* keep scanning */ } }
  } else if (text) { try { json = JSON.parse(text); } catch { /* notification replies are empty */ } }
  return { json, sid: res.headers.get('mcp-session-id') || sid };
}
function httpSession(url, headers) {
  let sid = null, ready = null, n = 10;
  const init = async () => {
    const r = await rpc(url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: CLIENT } }, null, headers);
    if (r.json?.error) throw new Error(r.json.error.message || 'initialize failed');
    sid = r.sid; await rpc(url, { jsonrpc: '2.0', method: 'notifications/initialized' }, sid, headers).catch(() => {});
  };
  return {
    async request(method, params) {
      ready ??= init().catch((e) => { ready = null; throw e; }); await ready;
      const r = await rpc(url, { jsonrpc: '2.0', id: ++n, method, params }, sid, headers);
      if (r.json?.error) throw new Error(r.json.error.message || `${method} failed`);
      return r.json?.result;
    },
    close() {},
  };
}

/* ---------- stdio: newline-delimited JSON-RPC on stdin/stdout ---------- */
function stdioSession(command, env) {
  const child = spawn(command, { shell: true, windowsHide: true, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map(); let buf = '', n = 0, dead = null, ready = null; let errTail = '';
  child.stdout.on('data', (d) => {
    buf += d.toString();
    let i; while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue; let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.id != null && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.t); m.error ? p.no(new Error(m.error.message || 'MCP error')) : p.ok(m.result); }
    }
  });
  child.stderr.on('data', (d) => { errTail = (errTail + d.toString()).slice(-600); });
  const fail = (why) => { dead = why; for (const p of pending.values()) { clearTimeout(p.t); p.no(new Error(why)); } pending.clear(); };
  child.on('error', (e) => fail(`Could not start the MCP server: ${e.message}`));
  child.on('exit', (code) => fail(`The MCP server stopped (exit ${code}). ${errTail.trim().slice(-300)}`.trim()));
  const send = (msg) => child.stdin.write(`${JSON.stringify(msg)}\n`);
  const req = (method, params) => new Promise((ok, no) => {
    if (dead) return no(new Error(dead));
    const id = ++n; const t = setTimeout(() => { pending.delete(id); no(new Error(`${method} timed out`)); }, CALL_MS);
    pending.set(id, { ok, no, t }); send({ jsonrpc: '2.0', id, method, params });
  });
  const init = async () => { await req('initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: CLIENT }); send({ jsonrpc: '2.0', method: 'notifications/initialized' }); };
  return {
    async request(method, params) { ready ??= init(); await ready; return req(method, params); },
    close() { try { if (WIN) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }); else child.kill('SIGKILL'); } catch { /* gone */ } },
    get dead() { return dead; },
  };
}

/* ---------- pool ---------- */
const pool = new Map(); // `${uid}|${id}` -> { s, timer, sig }
const listCache = new Map();
const sigOf = (s) => `${s.transport}|${s.url}|${s.command}|${s.updatedAt ?? ''}`;
function session(uid, id, server) {
  const key = `${uid}|${id}`; let p = pool.get(key);
  if (p && (p.sig !== sigOf(server) || p.s.dead)) { p.s.close(); clearTimeout(p.timer); pool.delete(key); p = null; }
  if (!p) {
    const sec = secretsOf(uid, id, server);
    let s;
    if (server.transport === 'stdio') { if (!String(server.command ?? '').trim()) throw bad('Add the command that starts this MCP server.'); s = stdioSession(server.command, sec); }
    else { if (!/^https?:\/\//i.test(server.url || '')) throw bad('Add the server URL first.'); s = httpSession(server.url, sec); }
    p = { s, sig: sigOf(server), timer: null }; pool.set(key, p);
  }
  clearTimeout(p.timer); p.timer = setTimeout(() => { p.s.close(); pool.delete(key); }, IDLE_MS); p.timer.unref?.();
  return p.s;
}
export function closeMcp(uid, id) { const k = `${uid}|${id}`; const p = pool.get(k); if (p) { p.s.close(); clearTimeout(p.timer); pool.delete(k); } listCache.delete(k); }

/** Tools a server offers: [{name, description, inputSchema}], cached 5 minutes. */
export async function listMcpTools(uid, id, server) {
  const k = `${uid}|${id}`; const hit = listCache.get(k);
  if (hit && hit.sig === sigOf(server) && Date.now() - hit.at < LIST_TTL) return hit.tools;
  const r = await session(uid, id, server).request('tools/list', {});
  const tools = (r?.tools ?? []).filter((t) => t?.name).slice(0, 200).map((t) => ({ name: String(t.name), description: String(t.description ?? '').slice(0, 300), inputSchema: t.inputSchema ?? { type: 'object' }, readOnly: !!t.annotations?.readOnlyHint }));
  listCache.set(k, { at: Date.now(), sig: sigOf(server), tools });
  return tools;
}

/** Call one tool. Returns plain text (text parts joined; other parts described). */
export async function callMcp(uid, id, server, tool, args = {}) {
  const r = await session(uid, id, server).request('tools/call', { name: tool, arguments: args && typeof args === 'object' ? args : {} });
  const parts = (r?.content ?? []).map((c) => (c.type === 'text' ? c.text : c.type === 'resource' ? (c.resource?.text ?? `[resource ${c.resource?.uri ?? ''}]`) : `[${c.type}${c.mimeType ? ` ${c.mimeType}` : ''}]`));
  const text = parts.join('\n').trim() || (r?.structuredContent ? JSON.stringify(r.structuredContent) : '(no output)');
  return r?.isError ? `The tool reported an error: ${text}` : text;
}

/** For the dashboard's Verify button: connects and lists tools. */
export async function verifyMcp(server, uid = '', id = '') {
  const u = uid || 'verify', i = id || `tmp-${Date.now()}`;
  closeMcp(u, i); // always a fresh connection
  try { const tools = await listMcpTools(u, i, server); if (!uid) closeMcp(u, i); return { ok: true, tools: tools.map((t) => t.name) }; }
  catch (e) { closeMcp(u, i); return { ok: false, error: e.message }; }
}
