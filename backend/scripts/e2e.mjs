// End-to-end smoke test with fakes: in-memory Firestore, fake LLM, fake Drive (artifacts contract). Run: node scripts/e2e.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';

const env = { SERVICE_SECRET: 'test-secret-test-secret', MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), CRON_SECRET: 'cron', NODE_ENV: 'test', MEMORY_DB: '1', ALLOWED_ORIGINS: 'http://localhost:3000', ALLOWED_EMAILS: 'alice@dev.local,bob@dev.local', LOG_LEVEL: 'warn' };
Object.assign(process.env, env);
const { seal, open } = await import('../src/lib/crypto.js');
const { nextRun } = await import('../src/lib/cron.js');
const { verifyHeader } = await import('../src/lib/svc.js');
let pass = 0; const ok = (name) => { pass++; console.log('  ✓', name); };

/* ---- unit: crypto + cron ---- */
{
  const b = seal('sk-secret-123', 'u1|provider|p1');
  assert.equal(open(b, 'u1|provider|p1'), 'sk-secret-123');
  assert.throws(() => open(b, 'u2|provider|p1')); assert.ok(!JSON.stringify(b).includes('sk-secret'));
  ok('crypto: round trip, AAD binding, no plaintext');
  const t = nextRun({ kind: 'daily', time: '09:00' }, Date.parse('2026-11-02T10:00:00Z'), 'Asia/Kolkata'); // 15:30 IST -> next 09:00 IST = 03:30Z next day
  assert.equal(new Date(t).toISOString(), '2026-11-03T03:30:00.000Z');
  assert.equal(new Date(nextRun({ kind: 'cron', cron: '*/15 * * * *' }, Date.parse('2026-11-02T10:07:00Z'), 'UTC')).toISOString(), '2026-11-02T10:15:00.000Z');
  assert.equal(nextRun({ kind: 'cron', cron: 'nope' }, Date.now(), 'UTC'), null);
  ok('cron: daily in timezone, step cron, invalid');
}

/* ---- fakes ---- */
const body = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const llmCalls = []; const llmSys = [];
const llm = http.createServer(async (req, res) => {
  const send = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  if (req.url.endsWith('/models')) return send({ data: [{ id: 'fake-1' }, { id: 'fake-2' }] });
  const b = JSON.parse((await body(req)).toString()); const sys = b.messages[0].content; llmCalls.push(sys.slice(0, 30)); llmSys.push(sys);
  let text = 'LLM says hello';
  if (sys.includes('You are the Planner')) text = JSON.stringify({ steps: [{ mate: 'research', label: 'Gather facts', kind: 'think' }, { mate: 'code', label: 'Make hello file', kind: 'code' }, { mate: 'writer', label: 'Write summary', kind: 'file' }] });
  else if (sys.includes('coding agent')) {
    const n = b.messages.filter((m) => m.role === 'assistant').length;
    text = n === 0 ? '{"tool":"write_file","args":{"path":"out/hello.txt","content":"hi from coder"}}' : n === 1 ? '```json\n{"tool":"run","args":{"cmd":"ls","args":["out"]}}\n```' : '{"tool":"finish","args":{"summary":"Created out/hello.txt"}}';
  }
  const lastUser = b.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  if (sys.includes('Tools:') && !sys.includes('coding agent')) {
    if (b.messages.some((m) => m.role === 'user' && m.content.includes('loop forever'))) text = '{"tool":"calculate","args":{"expression":"1+1"}}';
    else if (lastUser.startsWith('Tool result')) text = `Done: ${lastUser.split('\n')[2]}`;
    else if (lastUser.includes('remember')) text = '{"tool":"memory_save","args":{"text":"Owner loves chai","kind":"fact"}}';
    else if (lastUser.includes('fetch local')) text = '```json\n{"tool":"fetch_url","args":{"url":"http://127.0.0.1:4101/v1"}}\n```';
    else if (lastUser.includes('health check')) text = '{"tool":"watchdog","args":{}}';
    else if (lastUser.includes('show console')) text = '{"tool":"console_tail","args":{"n":5}}';
    else if (lastUser.includes('who is failing')) text = '{"tool":"runs_failed","args":{}}';
    else if (lastUser.includes('math')) text = '{"tool":"calculate","args":{"expression":"(12.5*4)/2"}}';
  }
  if (b.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    for (const part of text.match(/.{1,6}/gs) ?? []) { res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`); await wait(5); }
    return res.end('data: [DONE]\n\n');
  }
  send({ choices: [{ message: { content: text } }] });
}).listen(4101);
const drive = new Map();
const art = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (!verifyHeader(req.headers['x-svc'], req.method, path)) { res.statusCode = 401; return res.end('{"error":"svc"}'); }
  res.setHeader('content-type', 'application/json');
  if (req.method === 'PUT') { const buf = await body(req); const id = `d${drive.size + 1}`; drive.set(id, buf); return res.end(JSON.stringify({ driveId: id, size: buf.length })); }
  if (req.method === 'GET' && path.startsWith('/v1/files/')) { const b = drive.get(path.split('/').pop()); if (!b) { res.statusCode = 404; return res.end('{}'); } res.setHeader('content-type', 'application/octet-stream'); return res.end(b); }
  if (req.method === 'DELETE') { drive.delete(path.split('/').pop()); return res.end('{"ok":true}'); }
  if (path === '/v1/health') return res.end('{"ok":true}');
  res.statusCode = 404; res.end('{}');
}).listen(4102);

const procs = [];
const start = (file, port, extra = {}) => { const p = spawn('node', [file], { env: { ...process.env, ...env, PORT: String(port), API_URL: 'http://127.0.0.1:4100', ARTIFACTS_URL: 'http://127.0.0.1:4102', CODER_URL: 'http://127.0.0.1:4103', PUBLIC_URL: '', ...extra }, stdio: ['ignore', 'inherit', 'inherit'] }); procs.push(p); return p; };
start('src/api/index.js', 4100); start('src/coder/index.js', 4103);
const cleanup = () => { procs.forEach((p) => p.kill()); llm.close(); art.close(); };
process.on('exit', cleanup);
for (let i = 0; i < 40; i++) { try { if ((await fetch('http://127.0.0.1:4100/healthz')).ok && (await fetch('http://127.0.0.1:4103/healthz')).ok) break; } catch { /* booting */ } await wait(250); }

/* ---- http helpers ---- */
const A = 'http://127.0.0.1:4100';
const call = async (method, path, b, who = 'alice', extra = {}) => {
  const res = await fetch(A + path, { method, headers: { authorization: `Bearer dev:${who}`, ...(b && !(b instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...extra }, body: b instanceof FormData ? b : b ? JSON.stringify(b) : undefined });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, text };
};
const until = async (fn, ms = 20000) => { const t = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('timeout'); await wait(150); } };

try {
  /* auth */
  assert.equal((await fetch(`${A}/v1/settings`)).status, 401);
  assert.equal((await call('GET', '/v1/settings', null, 'carol')).status, 403);
  assert.equal((await call('GET', '/v1/auth/session')).json.email, 'alice@dev.local');
  assert.equal((await fetch(`${A}/internal/llm`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })).status, 401);
  ok('auth: bearer required, allow-list, service routes closed');

  /* mates + settings */
  const mates = (await call('GET', '/v1/mates')).json; assert.equal(mates.length, 18); assert.equal(mates.find((m) => m.id === 'code').enabled, true);
  const s = (await call('PATCH', '/v1/settings', { permissionMode: 'auto', askBeforeRisky: false, retriesOnFailure: 0, bogus: 1 })).json;
  assert.equal(s.permissionMode, 'auto'); assert.equal(s.bogus, undefined);
  ok('mates seeded, settings validated');

  /* providers */
  const pr = (await call('POST', '/v1/providers', { preset: 'custom', name: 'Fake', baseUrl: 'http://127.0.0.1:4101/v1', apiKey: 'sk-test-1234', models: [], enabled: true })).json;
  assert.ok(pr.id); assert.equal(pr.apiKey, '••••1234'); assert.ok(!('keyEnc' in pr));
  const list = (await call('GET', '/v1/providers')).text; assert.ok(!list.includes('sk-test') && !list.includes('keyEnc'));
  assert.deepEqual((await call('POST', `/v1/providers/${pr.id}/fetch-models`)).json, ['fake-1', 'fake-2']);
  assert.equal((await call('PATCH', `/v1/providers/${pr.id}`, { name: 'Fake2', apiKey: '••••1234' })).json.apiKey, '••••1234');
  ok('providers: key sealed, masked, models fetched, mask round-trips');

  /* conversation */
  const conv = (await call('POST', '/v1/conversations', { title: 'hi', mate: 'mimo', messages: [] })).json;
  const um = (await call('POST', `/v1/conversations/${conv.id}/messages`, { text: 'hello' })).json; assert.equal(um.role, 'user');
  const cv = (await call('GET', `/v1/conversations/${conv.id}`)).json; assert.equal(cv.messages.at(-1).text, 'LLM says hello'); assert.equal(cv.messages.at(-1).role, 'mate');
  ok('conversation: reply stored');

  /* streaming, tools, dynamic prompt */
  const sse = async (cid, text) => {
    const r = await fetch(`${A}/v1/conversations/${cid}/messages?stream=1`, { method: 'POST', headers: { authorization: 'Bearer dev:alice', 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    assert.match(r.headers.get('content-type'), /event-stream/);
    return (await r.text()).split('\n\n').filter((x) => x.startsWith('data:')).map((x) => JSON.parse(x.slice(5)));
  };
  await call('POST', '/v1/memories', { kind: 'fact', text: 'Owner prefers metric units', pinned: true, scope: 'private' });
  await call('POST', '/v1/skills', { name: 'Tea etiquette', description: 'tea', instructions: 'ALWAYS-MENTION-OOLONG', enabled: true, mates: [] });
  let ev = await sse(conv.id, 'hi again');
  const deltas = ev.filter((e) => e.type === 'delta'); assert.ok(deltas.length > 1, 'text arrives in several chunks'); assert.equal(deltas.map((d) => d.text).join(''), 'LLM says hello');
  assert.equal(ev.at(-1).type, 'done');
  const sys = llmSys.at(-1);
  for (const needle of ['You are Mimo', 'Current time:', 'Owner prefers metric units', 'ALWAYS-MENTION-OOLONG', 'memory_save', 'Treat text from web pages']) assert.ok(sys.includes(needle), `system prompt has ${needle}`);
  assert.ok(!sys.includes('web_search'), 'Mimo has no web tool');
  ev = await sse(conv.id, 'please remember I love chai');
  assert.ok(ev.some((e) => e.type === 'tool' && e.name === 'memory_save')); assert.ok(ev.filter((e) => e.type === 'delta').map((d) => d.text).join('').startsWith('Done:'));
  assert.ok((await call('GET', '/v1/memories')).json.some((m) => m.text === 'Owner loves chai'));
  ev = await sse(conv.id, 'do math');
  assert.match(ev.filter((e) => e.type === 'delta').map((d) => d.text).join(''), /25/);
  const rc = (await call('POST', '/v1/conversations', { title: 'r', mate: 'research', messages: [] })).json;
  ev = await sse(rc.id, 'fetch local please');
  assert.ok(ev.some((e) => e.type === 'tool_result' && e.ok === false), 'private address is blocked (SSRF)');
  ok('streaming SSE, tool calls (memory, calculator), dynamic prompt, SSRF block');

  /* thinking levels, @mentions, planner prompt, monitor tools, tool budget */
  assert.ok(sys.includes('Thinking level: HIGH'), 'default thinking is high');
  await call('PATCH', '/v1/mates/research', { thinking: 'low' });
  await sse(rc.id, 'hello research'); assert.ok(llmSys.at(-1).includes('Thinking level: LOW'), 'per-mate thinking level is used');
  ev = await sse(conv.id, '@planner @research plan a launch');
  const order = ev.filter((e) => e.type === 'mate').map((e) => e.mate); assert.deepEqual(order, ['planner', 'research']);
  assert.equal(ev.filter((e) => e.type === 'done').length, 2);
  assert.ok(llmSys.some((x) => x.includes('PLANNER PLAYBOOK') && x.includes('- research [ON]')), 'planner gets the playbook and live roster');
  const cv2 = (await call('GET', `/v1/conversations/${conv.id}`)).json; assert.ok(cv2.members.includes('planner') && cv2.members.includes('research'));
  ev = await sse(conv.id, '@research @luna hi'); // luna is off by default
  assert.ok(cv2.messages.length > 0 && (await call('GET', `/v1/conversations/${conv.id}`)).json.messages.some((m) => m.role === 'system' && m.text.includes('Luna is switched off')));
  ev = await sse(conv.id, 'run a health check'); assert.ok(ev.some((e) => e.type === 'tool' && e.name === 'watchdog')); assert.match(ev.filter((e) => e.type === 'delta').map((d) => d.text).join(''), /Watchdog/);
  ev = await sse(conv.id, 'show console'); assert.ok(ev.some((e) => e.type === 'tool_result' && e.ok));
  ev = await sse(conv.id, 'who is failing'); assert.ok(ev.some((e) => e.type === 'tool_result' && e.ok));
  ev = await sse(conv.id, 'loop forever');
  const final = ev.filter((e) => e.type === 'delta').map((d) => d.text).join('') ; assert.ok(ev.filter((e) => e.type === 'tool').length >= 5);
  assert.ok(ev.at(-1).message.text.includes('ran out of tool turns') && !ev.at(-1).message.text.trim().startsWith('{'), 'raw tool JSON is never the final answer');
  ok('thinking levels, @mentions, planner playbook, monitor/watchdog tools, tool-budget fallback');

  /* run end to end with SSE */
  const events = []; const ctl = new AbortController();
  const run = (await call('POST', '/v1/runs', { prompt: 'Make a hello file', askFirst: false, fileIds: [] })).json; assert.equal(run.status, 'queued');
  fetch(`${A}/v1/runs/${run.id}/events`, { headers: { authorization: 'Bearer dev:alice', origin: 'http://localhost:3000' }, signal: ctl.signal }).then(async (r) => { assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:3000'); const rd = r.body.getReader(); const dec = new TextDecoder(); for (;;) { const { done, value } = await rd.read(); if (done) break; for (const l of dec.decode(value).split('\n')) if (l.startsWith('data:')) events.push(JSON.parse(l.slice(5))); } }).catch(() => {});
  const done = await until(async () => { const r = (await call('GET', `/v1/runs/${run.id}`)).json; return ['done', 'failed'].includes(r.status) ? r : null; });
  assert.equal(done.status, 'done', done.error); assert.equal(done.steps.length, 3); assert.ok(done.steps.every((x) => x.status === 'done'), JSON.stringify(done.steps));
  assert.ok(done.fileIds.length >= 2, `files ${done.fileIds}`); assert.ok(done.report.length > 3); assert.ok(done.log.some((l) => l.source === 'code'));
  await wait(300); ctl.abort(); assert.ok(events.some((e) => e.type === 'step') && events.some((e) => e.type === 'log'), `sse ${events.length}`);
  ok('run: plan -> think -> coder -> Drive file -> report, SSE events streamed');

  /* approvals */
  await call('PATCH', '/v1/settings', { permissionMode: 'ask', askBeforeRisky: true });
  const r2 = (await call('POST', '/v1/runs', { prompt: 'Approve me', askFirst: false })).json;
  const w = await until(async () => { const r = (await call('GET', `/v1/runs/${r2.id}`)).json; return r.approvals?.find((a) => a.status === 'pending') ? r : null; }, 15000).catch(async (e) => { console.error('R2 STATE', JSON.stringify((await call('GET', `/v1/runs/${r2.id}`)).json, null, 1).slice(0, 2500)); throw e; });
  assert.equal((await call('POST', `/v1/runs/${r2.id}/approvals/${w.approvals[0].id}`, { decision: 'approved' })).status, 200);
  const w2 = await until(async () => { const r = (await call('GET', `/v1/runs/${r2.id}`)).json; return r.approvals?.find((a) => a.status === 'pending' && a.id !== w.approvals[0].id) ? r : null; }, 15000).catch(async (e) => { console.error('R2 STATE', JSON.stringify((await call('GET', `/v1/runs/${r2.id}`)).json, null, 1)); throw e; });
  await call('POST', `/v1/runs/${r2.id}/approvals/${w2.approvals.find((a) => a.status === 'pending' && a.id !== w.approvals[0].id).id}`, { decision: 'denied' });
  const d2 = await until(async () => { const r = (await call('GET', `/v1/runs/${r2.id}`)).json; return ['done', 'failed'].includes(r.status) ? r : null; }); assert.equal(d2.status, 'done');
  assert.ok(d2.steps.some((x) => x.status === 'failed')); // the denied step
  const r3 = (await call('POST', '/v1/runs', { prompt: 'Stop me' })).json; await until(async () => (await call('GET', `/v1/runs/${r3.id}`)).json.approvals?.length);
  await call('POST', `/v1/runs/${r3.id}/stop`); assert.equal((await until(async () => { const r = (await call('GET', `/v1/runs/${r3.id}`)).json; return r.status === 'stopped' ? r : null; })).status, 'stopped');
  ok('approvals: approve, deny, stop while waiting');

  /* isolation */
  assert.equal((await call('GET', `/v1/runs/${run.id}`, null, 'bob')).status, 404); assert.equal((await call('GET', '/v1/runs', null, 'bob')).json.length, 0);
  ok('isolation: another user cannot see runs');

  /* files */
  const fd = new FormData(); fd.append('file', new Blob(['hello bytes']), 'a.txt');
  const up = await call('POST', '/v1/files', fd); assert.equal(up.status, 201);
  assert.equal((await call('GET', `/v1/files/${up.json.id}/content`)).text, 'hello bytes');
  assert.equal((await call('DELETE', `/v1/files/${up.json.id}`)).status, 204); assert.ok(![...drive.values()].some((b) => b.toString() === 'hello bytes'));
  ok('files: upload, download, delete removes Drive copy');

  /* knowledge + mcp */
  await call('POST', '/v1/knowledge', { kind: 'note', name: 'Plan', text: 'The launch is on Friday.\n\nBudget is small.', status: 'pending' });
  const hit = await until(async () => { const h = (await call('GET', '/v1/knowledge/search?q=launch%20friday')).json; return h.length ? h : null; }); assert.equal(hit[0].name, 'Plan');
  const m = (await call('POST', '/v1/mcp-servers', { name: 'x', transport: 'stdio', url: '', command: 'npx x', description: '', enabled: true, status: 'unverified', tools: [] })).json;
  assert.equal((await call('POST', `/v1/mcp-servers/${m.id}/verify`)).json.status, 'error');
  ok('knowledge indexed + searched, stdio MCP rejected honestly');

  /* scheduler */
  const before = (await call('GET', '/v1/runs')).json.length;
  await call('POST', '/v1/automations', { name: 'Every minute', description: 'Say hello', schedule: { kind: 'cron', cron: '* * * * *' }, enabled: true });
  assert.equal((await fetch(`${A}/internal/tick`, { headers: { 'x-cron-secret': 'wrong' } })).status, 401);
  const wait2 = 60500 - (Date.now() % 60000); console.log(`  … waiting ${Math.round(wait2 / 1000)}s for the next minute so the cron job is due`); await wait(wait2);
  const tk = await (await fetch(`${A}/internal/tick`, { headers: { 'x-cron-secret': 'cron' } })).json(); assert.equal(tk.fired, 1);
  await until(async () => (await call('GET', '/v1/runs')).json.length > before, 8000);
  ok('scheduler: due automation fires a run via /internal/tick');
  console.log(`\nALL ${pass} CHECKS PASSED`);
} catch (e) { console.error('\nFAILED:', e.stack || e); process.exitCode = 1; }
finally { cleanup(); setTimeout(() => process.exit(process.exitCode ?? 0), 200); }
