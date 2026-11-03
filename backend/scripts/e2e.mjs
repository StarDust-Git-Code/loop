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
const llmCalls = []; const llmSys = []; let toolsOff = false; const llmTools = []; const llmMsgs = []; const llmMax = [];
const llm = http.createServer(async (req, res) => {
  const send = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  if (req.url.endsWith('/__tools_off')) { toolsOff = true; return send({ ok: true }); }
  if (req.url.endsWith('/models')) return send({ data: [{ id: 'fake-1' }, { id: 'fake-2' }] });
  const b = JSON.parse((await body(req)).toString()); const sys = b.messages[0].content; llmCalls.push(sys.slice(0, 30)); llmSys.push(sys); llmTools.push(b.tools ?? null); llmMsgs.push(b.messages); llmMax.push(b.max_tokens);
  let text = 'LLM says hello';
  if (sys.includes('You are the Planner')) text = JSON.stringify({ steps: [{ mate: 'research', label: 'Gather facts', kind: 'think' }, { mate: 'code', label: 'Make hello file', kind: 'code' }, { mate: 'writer', label: 'Write summary', kind: 'file' }] });
  else if (sys.includes('coding agent')) {
    const n = b.messages.filter((m) => m.role === 'assistant').length;
    text = n === 0 ? '{"tool":"write_file","args":{"path":"out/hello.txt","content":"hi from coder"}}' : n === 1 ? '```json\n{"tool":"run","args":{"cmd":"ls","args":["out"]}}\n```' : '{"tool":"finish","args":{"summary":"Created out/hello.txt"}}';
  }
  const lastMsg = b.messages.at(-1); const lastUser = b.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  const ask = [...b.messages].reverse().find((m) => m.role === 'user' && !m.content.startsWith('Tool result') && !m.content.startsWith('Tool budget'))?.content ?? '';
  let calls = null; const native = !!b.tools;
  if (b.tools && toolsOff) { res.statusCode = 400; return res.end('{"error":"tools not supported"}'); }
  if (sys.includes('Tools:') && !sys.includes('coding agent')) {
    const want = [];
    if (ask.includes('loop forever')) want.push(['calculate', { expression: '1+1' }]);
    else if (ask.includes('remember')) want.push(['memory_save', { text: 'Owner loves chai', kind: 'fact' }]);
    else if (ask.includes('fetch local')) want.push(['fetch_url', { url: 'http://127.0.0.1:4101/v1' }]);
    else if (ask.includes('health check')) want.push(['watchdog', {}]);
    else if (ask.includes('show console')) want.push(['console_tail', { n: 5 }]);
    else if (ask.includes('who is failing')) want.push(['runs_failed', {}]);
    else if (ask.includes('build me a workflow')) want.push(['workflow_save', { name: 'Daily brief', description: 'Morning brief', steps: [{ type: 'trigger', label: 'Every weekday 9am' }, { type: 'mate', mate: 'research', label: 'Gather overnight news' }, { type: 'mate', mate: 'writer', label: 'Write the brief' }, { type: 'output', label: 'Save brief.md' }] }]);
    else if (ask.includes('look back')) want.push(['chat_history', { which: 'start', n: 2 }]);
    else if (ask.includes('check both')) want.push(['runs_failed', {}], ['runs_active', {}]);
    else if (ask.includes('math')) want.push(['calculate', { expression: '(12.5*4)/2' }]);
    const gotResult = native ? lastMsg.role === 'tool' : lastUser.startsWith('Tool result');
    const noTools = !b.tools && !sys.includes('You can use tools'); // the forced final turn
    if (want.length && ask.includes('loop forever') && !noTools) calls = want;
    else if (want.length && ask.includes('loop forever')) text = '{"tool":"calculate","args":{"expression":"1+1"}}'; // ignores "no more tools"
    else if (gotResult) text = `Done: ${native ? lastMsg.content.split('\n')[0] : lastUser.split('\n')[2]}`;
    else if (want.length) calls = want;
    if (calls && !native) { text = calls.map(([n, a]) => JSON.stringify({ tool: n, args: a })).join('\n</tool>\n') + '\n</tool>'; calls = null; } // sloppy text protocol on purpose
  }
  if (sys.includes('Mode: BRAINSTORM') && !calls) text = `${sys.includes('Round table on') || b.messages.at(-1).content.includes('Write the summary') || b.messages.at(-1).content.includes('is over') ? '' : ''}idea from ${/You are (\w+)/.exec(sys)[1]}`;
  if (b.stream && !calls && sys.includes('reasoning-test')) text = '<think>hidden thoughts here</think>Visible answer';
  if (b.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const w = (delta) => res.write(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
    if (calls) {
      calls.forEach(([n, a], i) => { w({ tool_calls: [{ index: i, id: `call_${i}`, type: 'function', function: { name: n, arguments: '' } }] }); const j = JSON.stringify(a); w({ tool_calls: [{ index: i, function: { arguments: j.slice(0, 5) } }] }); w({ tool_calls: [{ index: i, function: { arguments: j.slice(5) } }] }); });
      return res.end('data: [DONE]\n\n');
    }
    if (sys.includes('nativeR-marker')) { w({ reasoning_content: 'pondering ' }); w({ reasoning_content: 'deeply' }); }
    for (const part of text.match(/.{1,6}/gs) ?? []) { w({ content: part }); await wait(5); }
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
  const mates = (await call('GET', '/v1/mates')).json; assert.equal(mates.length, 19); assert.equal(mates.find((m) => m.id === 'code').enabled, true);
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
  for (const needle of ['You are Mimo', 'Current time:', 'Owner prefers metric units', 'ALWAYS-MENTION-OOLONG', 'Tools: you can call tools', 'Treat text from web pages']) assert.ok(sys.includes(needle), `system prompt has ${needle}`);
  assert.ok(sys.includes('MIMO PLAYBOOK'), 'Mimo has its playbook');
  const sent = llmTools.at(-1); assert.ok(Array.isArray(sent), 'tools are sent as native schemas');
  const names = sent.map((t) => t.function.name); assert.ok(names.includes('memory_save') && names.includes('watchdog') && names.includes('calculate') && names.includes('web_search') && names.includes('notify_me') && names.includes('call_me'));
  assert.ok(names.includes('unit_convert') && names.includes('json_query') && names.includes('scratch_write') && names.includes('spawn_run') && names.includes('ask_mate'), 'Mimo is a coordinator now');
  assert.ok(sent.length >= 50, `Mimo gets a rich toolset (${sent.length})`);
  const ms = sent.find((t) => t.function.name === 'memory_save').function.parameters; assert.deepEqual(ms.required, ['text']); assert.deepEqual(ms.properties.kind.enum.slice(0, 2), ['note', 'idea']);
  ev = await sse(conv.id, 'please remember I love chai');
  assert.ok(ev.some((e) => e.type === 'tool' && e.name === 'memory_save')); assert.ok(ev.filter((e) => e.type === 'delta').map((d) => d.text).join('').startsWith('Done:'));
  assert.ok((await call('GET', '/v1/memories')).json.some((m) => m.text === 'Owner loves chai'));
  ev = await sse(conv.id, 'do math');
  assert.match(ev.filter((e) => e.type === 'delta').map((d) => d.text).join(''), /25/);
  const chefC = (await call('POST', '/v1/conversations', { title: 'c', mate: 'chef', messages: [] })).json; await sse(chefC.id, 'hello chef');
  const chefTools = llmTools.at(-1).map((t) => t.function.name); assert.ok(chefTools.includes('notify_me') && chefTools.includes('call_me'), 'every Mate can text and call the owner'); assert.ok(!chefTools.includes('spawn_run'), 'delegation stays with coordinators');
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
  const fc = (await call('POST', '/v1/conversations', { title: 'f', mate: 'flow', messages: [] })).json;
  ev = await sse(fc.id, 'please build me a workflow');
  assert.ok(ev.some((e) => e.type === 'tool' && e.name === 'workflow_save') && ev.some((e) => e.type === 'tool_result' && e.ok), 'Flow saves a workflow');
  const wfs = (await call('GET', '/v1/workflows')).json; const wf = wfs.find((w) => w.name === 'Daily brief');
  assert.equal(wf.nodes.length, 4); assert.equal(wf.edges.length, 3); assert.equal(wf.nodes[1].mate, 'research'); assert.ok(wf.nodes[2].x > wf.nodes[1].x);
  assert.ok(llmSys.some((x) => x.includes('FLOW PLAYBOOK') && x.includes('workflow_save')), 'Flow gets its playbook');
  assert.ok(llmTools.some((t) => t?.some((x) => x.function.name === 'workflow_save' && x.function.parameters.properties.steps.type === 'array')), 'steps is an array schema');
  const lc = (await call('POST', '/v1/conversations', { title: 'long', mate: 'mimo', messages: [] })).json;
  await call('POST', `/v1/conversations/${lc.id}/messages`, { text: `FIRSTMSG ${'x'.repeat(9000)}` });
  for (let i = 0; i < 3; i++) await call('POST', `/v1/conversations/${lc.id}/messages`, { text: `filler ${i} ${'y'.repeat(9000)}` });
  ev = await sse(lc.id, 'please look back');
  const hist = llmMsgs.at(-2); // the request that triggered the tool (the last one is the follow-up)
  assert.ok(hist[1].content.includes('earlier message(s) are not shown') && hist[1].content.includes('FIRSTMSG'), 'trimmed history keeps a note with the opener');
  assert.ok(hist.reduce((n, m) => n + String(m.content).length, 0) < 40000, 'history is bounded');
  assert.ok(ev.some((e) => e.type === 'tool' && e.name === 'chat_history') && ev.filter((e) => e.type === 'delta').map((d) => d.text).join('').includes('FIRSTMSG'), 'chat_history reaches the start of the chat');
  assert.ok(llmSys.at(-1).includes('Runtime: you are being served through'), 'runtime model line');
  /* developer options + per-chat thinking */
  await call('PATCH', '/v1/settings', { maxOutputTokens: 500, maxContextTokens: 3000, defaultThinking: 'medium' });
  await sse(lc.id, 'hello again');
  assert.equal(llmMax.at(-1), 500, 'max output tokens is exact when set'); assert.ok(llmSys.at(-1).includes('Thinking level: MEDIUM'), 'workspace default thinking applies');
  assert.ok(llmMsgs.at(-1).reduce((n, m) => n + String(m.content ?? '').length, 0) < 12000, 'context window setting trims history');
  await call('PATCH', `/v1/conversations/${lc.id}`, { thinking: 'xhigh' });
  await sse(lc.id, 'hello once more'); assert.ok(llmSys.at(-1).includes('Thinking level: XHIGH'), 'per-chat thinking wins');
  const bad = (await call('PATCH', '/v1/settings', { maxOutputTokens: 5, defaultThinking: 'bogus' })).json; assert.equal(bad.maxOutputTokens, 64); assert.equal(bad.defaultThinking, 'medium');
  await call('PATCH', '/v1/settings', { maxOutputTokens: 0, maxContextTokens: 0, defaultThinking: 'high' });
  /* streamed reasoning: inline <think> tags and a separate reasoning_content field */
  await call('PATCH', '/v1/mates/spark', { instructions: 'reasoning-test' }); await call('PATCH', '/v1/mates/recall', { instructions: 'nativeR-marker' });
  const sc = (await call('POST', '/v1/conversations', { title: 's', mate: 'spark', messages: [] })).json;
  ev = await sse(sc.id, 'hello'); const J = (type, k = 'text') => ev.filter((e) => e.type === type).map((e) => e[k]).join('');
  assert.equal(J('think'), 'hidden thoughts here'); assert.equal(J('delta'), 'Visible answer', 'think tags never leak into the answer');
  assert.equal(ev.at(-1).message.thought, 'hidden thoughts here'); assert.equal(ev.at(-1).message.text, 'Visible answer');
  const rc2 = (await call('POST', '/v1/conversations', { title: 'r2', mate: 'recall', messages: [] })).json;
  ev = await sse(rc2.id, 'hello'); assert.equal(J('think'), 'pondering deeply'); assert.equal(ev.at(-1).message.thought, 'pondering deeply');
  await call('PATCH', '/v1/settings', { showReasoning: false });
  ev = await sse(sc.id, 'hello'); assert.equal(J('think'), '', 'reasoning can be switched off'); assert.equal(J('delta'), 'Visible answer');
  await call('PATCH', '/v1/settings', { showReasoning: true });
  await call('PATCH', '/v1/mates/spark', { instructions: '' }); await call('PATCH', '/v1/mates/recall', { instructions: '' });
  /* round table */
  await call('PATCH', '/v1/settings', { brainstormRounds: 2 });
  const bc = (await call('POST', '/v1/conversations', { title: 'bs', mate: 'planner', messages: [], mode: 'brainstorm' })).json;
  ev = await sse(bc.id, '@research @writer @planner how do we launch loopmates?');
  assert.deepEqual(ev.filter((e) => e.type === 'round').map((e) => e.n), [1, 2, 3], 'two rounds plus the summary');
  assert.deepEqual(ev.filter((e) => e.type === 'mate').map((e) => e.mate), ['research', 'writer', 'planner', 'research', 'writer', 'planner', 'planner']);
  assert.equal(ev.filter((e) => e.type === 'done').length, 7);
  const bm = (await call('GET', `/v1/conversations/${bc.id}`)).json.messages.filter((m) => m.role === 'mate');
  assert.deepEqual(bm.map((m) => m.round), [1, 1, 1, 2, 2, 2, 3]); assert.equal(bm.at(-1).summary, true); assert.equal(bm[0].text, 'idea from Research');
  const second = llmMsgs.filter((m) => /Round table on/.test(m.at(-1)?.content ?? '')).find((m) => m.at(-1).content.includes('You speak as Writer') && m.at(-1).content.includes('round 1'));
  assert.ok(second.some((m) => m.content === '[Research]: idea from Research'), 'a later speaker sees what earlier speakers said');
  const third = llmMsgs.filter((m) => /Round table on/.test(m.at(-1)?.content ?? '')).find((m) => m.at(-1).content.includes('You speak as Research') && m.at(-1).content.includes('round 2'));
  assert.ok(third.some((m) => m.content === '[Planner]: idea from Planner'), 'round 2 sees all of round 1');
  assert.ok(llmMsgs.at(-1).at(-1).content.includes('Recommended next steps') || llmMsgs.some((m) => m.at(-1)?.content?.includes('Recommended next steps')), 'summary prompt');
  ev = await sse(bc.id, 'one more topic'); // no mentions: members from before sit again
  assert.ok(ev.filter((e) => e.type === 'mate' && !e.summary).length >= 6);
  const solo = (await call('POST', '/v1/conversations', { title: 'solo', mate: 'research', messages: [], mode: 'brainstorm' })).json;
  ev = await sse(solo.id, 'alone?'); assert.ok(new Set(ev.filter((e) => e.type === 'mate').map((e) => e.mate)).size >= 3, 'table is topped up when only one agent is named');
  ev = await sse(conv.id, 'check both please');
  assert.equal(ev.filter((e) => e.type === 'tool').map((e) => e.name).sort().join(), 'runs_active,runs_failed', 'two calls in one turn');
  assert.equal(ev.filter((e) => e.type === 'tool_result').length, 2);
  ev = await sse(conv.id, 'loop forever');
  assert.ok(ev.filter((e) => e.type === 'tool').length >= 3);
  assert.ok(ev.at(-1).message.text.includes('could not finish a written answer') && !ev.at(-1).message.text.trim().startsWith('{'), 'raw tool JSON is never the final answer');
  await fetch('http://127.0.0.1:4101/__tools_off'); // provider now rejects native tool calling: the text protocol takes over, with sloppy tags
  ev = await sse(conv.id, 'check both again');
  assert.ok(ev.some((e) => e.type === 'tool' && e.name === 'runs_failed') && ev.filter((e) => e.type === 'tool').length === 2 && ev.every((e) => e.type !== 'delta' || !e.text.includes('</tool>')), 'text-protocol fallback parses sloppy calls and hides them');
  assert.ok(ev.at(-1).message.text.startsWith('Done:'));
  ok('thinking levels, @mentions, planner playbook, monitor/watchdog tools, native tool calls, parallel calls, loop guard, text-protocol fallback');

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
