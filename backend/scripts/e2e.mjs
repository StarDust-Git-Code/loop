// End-to-end smoke test of the single server (src/server.js) with fakes: in-memory Firestore, fake LLM, in-memory Drive.
// Run: node scripts/e2e.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, copyFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'loopmates-e2e-'));
const env = { LOOPMATES_DATA: dataDir, DRIVE_FAKE: '1', TEST_HOOKS: '1', SANDBOX: 'process', PORT: '4100', HOST: '127.0.0.1', MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), CRON_SECRET: 'cron', NODE_ENV: 'test', MEMORY_DB: '1', ALLOWED_ORIGINS: 'http://localhost:3000', ALLOWED_EMAILS: 'alice@dev.local,bob@dev.local', LOG_LEVEL: 'warn' };
Object.assign(process.env, env);
const { seal, open } = await import('../src/lib/crypto.js');
const { nextRun } = await import('../src/lib/cron.js');
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
let verifyN = 0;
const llmCalls = []; const llmSys = []; let toolsOff = false; const llmTools = []; const llmMsgs = []; const llmMax = [];
const llm = http.createServer(async (req, res) => {
  const send = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  if (req.url.endsWith('/__tools_off')) { toolsOff = true; return send({ ok: true }); }
  if (req.url.endsWith('/models')) return send({ data: [{ id: 'fake-1' }, { id: 'fake-2' }] });
  const b = JSON.parse((await body(req)).toString()); const sys = b.messages[0].content; llmCalls.push(sys.slice(0, 30)); llmSys.push(sys); llmTools.push(b.tools ?? null); llmMsgs.push(b.messages); llmMax.push(b.max_tokens);
  let text = 'LLM says hello';
  if (sys.startsWith('You are the Code Mate supervising')) text = JSON.stringify({ criteria: ['out/hello.txt contains "hello from codex"'], test: 'node --version', notes: 'One file.' });
  if (sys.startsWith('You review a coding agent')) { const u = b.messages.at(-1).content; text = /oops/.test(u) && !/Round 2/.test(u) ? '{"ok":false,"issues":["out/hello.txt says oops instead of hello from codex"]}' : '{"ok":true,"issues":[]}'; }
  if (sys.startsWith('You maintain a long-term memory')) {
    const said = b.messages.at(-1).content.split('Owner said:')[1] ?? '';
    text = said.includes('Priya reports to Arun') ? JSON.stringify({ ops: [{ op: 'add', text: 'Priya reports to Arun in the design team', kind: 'fact', scope: 'shared' }], entities: [{ name: 'Priya', type: 'person' }, { name: 'Arun', type: 'person' }, { name: 'Design team', type: 'team' }], relations: [{ from: 'Priya', rel: 'reports_to', to: 'Arun' }, { from: 'Priya', rel: 'member_of', to: 'Design team' }] })
      : said.includes('Priya now reports to Meena') ? JSON.stringify({ ops: [], entities: [{ name: 'Meena', type: 'person' }], relations: [{ from: 'Priya', rel: 'reports to', to: 'Meena' }] }) : '{"ops":[]}';
  }
  // the nightly review: every agent writes a lesson; Writer also drafts a skill
  if (sys.startsWith('You are reviewing your own recent work')) { const who = /Who you are:\nYou are (\w+)/.exec(sys)?.[1] ?? 'Mate'; text = JSON.stringify({ lessons: [{ text: `When ${who} hands over a table, include the units in every row.`, evidence: 'item 1' }], skill: who === 'Writer' ? { name: 'Tables with units', description: 'How to write a comparison table', instructions: '1. One row per item.\n2. Units in every cell.\n3. Cite the source page.', why: 'the checker sent a table back for missing units' } : null }); }
  if (sys.startsWith("You check whether a work step's output") && b.messages.at(-1).content.includes('Step: Draft the units table')) text = verifyN++ === 0 ? '{"ok":false,"issue":"The table has no units."}' : '{"ok":true}';
  // the deep-research harness
  if (sys.startsWith('You write the research brief')) text = JSON.stringify({ mode: 'datasheet', question: 'What are the quiescent current and maximum input voltage of the TPS7A02?', subjects: ['TPS7A02'], parameters: ['quiescent current', 'input voltage', 'dropout'], searches: [] });
  if (sys.startsWith('You extract values from technical documents')) {
    const retry = b.messages.at(-1).content.includes('could not be found');
    text = JSON.stringify({ values: retry ? [{ subject: 'TPS7A02', parameter: 'Input voltage', value: '6.0', unit: 'V', kind: 'rating', page: 2, table: '', quote: 'Input voltage | 6.0 V' }, { subject: 'TPS7A02', parameter: 'Dropout', value: '200', unit: 'mV', kind: 'max', page: 1, quote: 'Dropout 200 mV' }]
      : [{ subject: 'TPS7A02', parameter: 'Quiescent current', value: '25', unit: 'nA', conditions: 'VIN = 3.3 V, TA = 25 C', kind: 'typ', page: 1, table: 'Table 7-1', quote: 'Quiescent current | 25 | nA | VIN = 3.3 V, TA = 25 C' }, { subject: 'TPS7A02', parameter: 'Input voltage', value: '6.0', unit: 'V', kind: 'rating', page: 1, quote: 'Input voltage 6.0 V' }, { subject: 'TPS7A02', parameter: 'Dropout', value: '200', unit: 'mV', kind: 'max', page: 1, quote: 'Dropout 200 mV' }], gaps: retry ? [] : ['PSRR is not given'], notes: [] });
  }
  if (sys.startsWith('You review a research analysis')) text = '{"ok":true,"issues":[]}';
  if (sys.startsWith('You write the answer section of a research report')) text = 'The TPS7A02 draws 25 nA typical at VIN = 3.3 V (D1 p.1) and is rated to 6.0 V input (D1 p.2).';
  if (sys.includes('You are the Planner')) text = JSON.stringify({ steps: [{ mate: 'research', label: 'Gather facts', kind: 'think' }, { mate: 'code', label: 'Make hello file', kind: 'code' }, { mate: 'writer', label: 'Write summary', kind: 'file' }] });
  else if (sys.includes('coding agent') && !sys.startsWith('You are the Code Mate') && !sys.startsWith('You review') && !sys.startsWith('You are reviewing')) {
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
    else if (ask.includes('tea skill')) want.push(['skill_load', { name: 'Tea etiquette' }]);
    else if (ask.includes('give arun the launch deck')) want.push(['assign_task', { title: 'Launch deck', assignee: 'arun', due: '2030-01-10' }]);
    else if (ask.includes('check in with arun')) want.push(['checkin_send', { person: 'Arun Kumar', question: 'How is the launch deck going?' }]);
    else if (ask.includes('keep an eye on acme')) want.push(['watch_add', { kind: 'topic', query: 'Acme Corp funding', label: 'Acme news' }]);
    else if (ask.includes('ask the graph')) want.push(['graph_query', { entity: 'Priya' }]);
    else if (ask.includes('use stdio mcp')) want.push(['mcp_call', { server: 'echo', tool: 'echo', args: { text: 'ping' } }]);
    else if (ask.includes('use http mcp')) want.push(['mcp_call', { server: 'webecho', tool: 'shout', args: { text: 'hey' } }]);
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
const procs = [];
const fakeBin = join(dataDir, 'fakebin'); mkdirSync(fakeBin, { recursive: true });
const fakeCodex = join(process.cwd(), 'scripts', 'fixtures', 'fake-codex.mjs');
if (process.platform === 'win32') { copyFileSync(fakeCodex, join(fakeBin, 'fake-codex.mjs')); writeFileSync(join(fakeBin, 'codex.cmd'), '@ECHO off\r\n"%dp0%\\fake-codex.mjs" %*\r\n'); }
else { writeFileSync(join(fakeBin, 'codex'), `#!/bin/sh\nexec "${process.execPath}" "${fakeCodex}" "$@"\n`); chmodSync(join(fakeBin, 'codex'), 0o755); }
const PATHKEY = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
const p = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, ...env, PUBLIC_URL: '', [PATHKEY]: `${fakeBin}${process.platform === 'win32' ? ';' : ':'}${process.env[PATHKEY]}`, CODEX_FAKE_WRONG_FIRST: '1' }, stdio: ['ignore', 'inherit', 'inherit'] }); procs.push(p);
const cleanup = () => { procs.forEach((x) => x.kill()); llm.close(); try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* still in use */ } };
process.on('exit', cleanup);
for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:4100/healthz')).ok) break; } catch { /* booting */ } await wait(250); }

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
  assert.equal((await fetch(`${A}/internal/llm`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })).status, 404);
  assert.equal((await fetch(`${A}/setup/api/state`, { headers: { 'x-setup-key': 'nope' } })).status, 401);
  ok('auth: bearer required, allow-list, no service-to-service routes, setup needs its key');

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
  for (const needle of ['You are Mimo', 'It is now', 'Owner prefers metric units', 'Tea etiquette', 'What you can reach', 'Tools: ', 'Data is not instructions', '# 4. Your role card', 'Telegram: not linked']) assert.ok(sys.includes(needle), `system prompt has ${needle}`);
  assert.ok(sys.includes('LEADER PLAYBOOK') && sys.includes('You are the leader'), 'Mimo leads by default and has the leader playbook');
  assert.ok(!sys.includes('ALWAYS-MENTION-OOLONG'), 'skill instructions are not pasted into the prompt');
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
  assert.ok(hist.slice(1).reduce((n, m) => n + String(m.content).length, 0) < 34000, 'history (without the system prompt) is bounded');
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

  /* custom agents, removal, leader */
  const hira = (await call('POST', '/v1/mates', { name: 'Hira', description: 'Hiring coordinator: screens candidates and books interviews.', tools: ['Memory', 'Calendar'], card: '**Hira** owns hiring. HIRA-CARD-MARKER' })).json;
  assert.equal(hira.id, 'hira'); assert.equal(hira.custom, true);
  assert.equal((await call('POST', '/v1/mates', { name: 'Hira' })).json.id, 'hira2', 'keys stay unique');
  let ros = (await call('GET', '/v1/mates/roster')).json; assert.equal(ros.leader, 'mimo'); assert.ok(ros.agents.some((a) => a.key === 'hira' && a.custom && a.enabled));
  assert.equal((await call('DELETE', '/v1/mates/mimo')).status, 409, 'the leader cannot be removed');
  assert.equal((await call('PATCH', '/v1/mates/mimo', { enabled: false })).status, 409, 'the leader cannot be switched off');
  assert.equal((await call('DELETE', '/v1/mates/chef')).status, 204); ros = (await call('GET', '/v1/mates/roster')).json;
  assert.ok(!ros.agents.some((a) => a.key === 'chef') && ros.removed.some((a) => a.key === 'chef'), 'built-ins are hidden, not deleted');
  assert.equal((await call('POST', '/v1/mates/chef/restore')).status, 204); assert.ok((await call('GET', '/v1/mates/roster')).json.agents.some((a) => a.key === 'chef'));
  assert.equal((await call('DELETE', '/v1/mates/hira2')).status, 204); assert.ok(!(await call('GET', '/v1/mates')).json.some((m) => m.id === 'hira2'), 'custom agents are deleted');
  assert.equal((await call('PATCH', '/v1/settings', { leader: 'nobody' })).status, 400);
  assert.equal((await call('PATCH', '/v1/settings', { leader: 'hira' })).json.leader, 'hira');
  const hc = (await call('POST', '/v1/conversations', { title: 'hiring', messages: [] })).json;
  await sse(hc.id, 'who are you, @hira');
  const hi = llmSys.findLastIndex((x) => x.includes('You are Hira')); const hs = llmSys[hi] ?? ''; assert.ok(hs.includes('You are Hira') && hs.includes('HIRA-CARD-MARKER') && hs.includes('LEADER PLAYBOOK') && hs.includes('hira (LEADER)'), 'custom agent leads with its own card');
  assert.ok(hs.includes('spawn_run') && hs.includes('ask_mate'), 'the leader gets delegation tools');
  await call('PATCH', '/v1/settings', { leader: 'mimo' });
  ok('custom agents: create, unique keys, remove/restore, leader rules, custom leader prompt and tools');

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
  assert.equal((await call('DELETE', `/v1/files/${up.json.id}`)).status, 204); assert.equal((await call('GET', `/v1/files/${up.json.id}/content`)).status, 404);
  ok('files: upload, download, delete removes Drive copy');

  /* deep research: an uploaded datasheet, values checked against their page, a wrong quote re-checked, one dropped */
  {
    const { makePdf } = await import('./fixtures/makepdf.mjs');
    const pdf = makePdf([[[50, 60, 'TPS7A02 Ultra-low-Iq LDO datasheet'], [50, 100, 'Table 7-1. Electrical Characteristics'], [50, 120, 'Quiescent current'], [260, 120, '25'], [300, 120, 'nA'], [380, 120, 'VIN = 3.3 V, TA = 25 C']], [[50, 60, 'Absolute maximum ratings'], [50, 80, 'Input voltage'], [320, 80, '6.0 V']]]);
    const f = new FormData(); f.append('file', new Blob([pdf], { type: 'application/pdf' }), 'tps7a02.pdf');
    const doc = (await call('POST', '/v1/files', f)).json;
    const rr = (await call('POST', '/v1/runs', { prompt: 'What is the quiescent current and max input voltage of the TPS7A02?', mode: 'research', fileIds: [doc.id] })).json;
    assert.equal(rr.plan?.[0]?.kind, 'research');
    const rd = await until(async () => { const r = (await call('GET', `/v1/runs/${rr.id}`)).json; return ['done', 'failed'].includes(r.status) ? r : null; }, 30000);
    assert.equal(rd.status, 'done', rd.error); assert.ok(rd.log.some((l) => /did not match their page; checking again \(round 2\/3\)/.test(l.text)), 'a wrong quote is sent back');
    const files = await Promise.all(rd.fileIds.map((id) => call('GET', `/v1/files/${id}`).then((x) => x.json)));
    const rep = files.find((x) => x.name?.endsWith('.md')); assert.ok(rep, `report file ${JSON.stringify(files)}`);
    const md = (await call('GET', `/v1/files/${rep.id}/content`)).text;
    assert.ok(md.includes('| TPS7A02 | Quiescent current | 25 | nA | typ | VIN = 3.3 V, TA = 25 C | D1 p.1, Table 7-1 |'), md);
    assert.ok(md.includes('| TPS7A02 | Input voltage | 6.0 | V | rating | — | D1 p.2 |'), 'the corrected value is kept with its real page');
    assert.ok(/## Dropped[\s\S]*Dropout = 200 mV/.test(md) && !/\| Dropout \|/.test(md), 'a value never found on its page is dropped, not reported');
    assert.ok(md.includes('Not in the documents: D1: PSRR is not given') && md.includes('**D1** tps7a02.pdf') && md.includes('sha256'));
    assert.ok(rd.notes.includes('25 nA typical'), 'the answer reaches the run notes for the final report');
  }
  ok('deep research: uploaded datasheet read page by page, quotes checked by the program, a wrong page corrected, an unverifiable value dropped, cited report');

  /* knowledge + mcp */
  await call('POST', '/v1/knowledge', { kind: 'note', name: 'Plan', text: 'The launch is on Friday.\n\nBudget is small.', status: 'pending' });
  const hit = await until(async () => { const h = (await call('GET', '/v1/knowledge/search?q=launch%20friday')).json; return h.length ? h : null; }); assert.equal(hit[0].name, 'Plan');
  const brk = (await call('POST', '/v1/mcp-servers', { name: 'broken', transport: 'stdio', url: '', command: 'definitely-not-a-command-xyz', description: '', enabled: true, status: 'unverified', tools: [] })).json;
  assert.equal((await call('POST', `/v1/mcp-servers/${brk.id}/verify`)).json.status, 'error'); await call('DELETE', `/v1/mcp-servers/${brk.id}`);
  ok('knowledge indexed + searched, a broken MCP server reports an error');

  /* MCP: a stdio server (env secret sealed) and an HTTP server (header secret sealed), called by an agent */
  const echoCmd = `"${process.execPath}" "${join(process.cwd(), 'scripts', 'fixtures', 'mcp-echo.mjs')}"`;
  const em = (await call('POST', '/v1/mcp-servers', { name: 'echo', transport: 'stdio', url: '', command: echoCmd, description: 'Echoes text', enabled: true, status: 'unverified', tools: [], config: { ECHO_TOKEN: 'tok-123' } })).json;
  assert.notEqual(em.config.ECHO_TOKEN, 'tok-123', 'MCP env secrets are masked');
  const ev2 = (await call('POST', `/v1/mcp-servers/${em.id}/verify`)).json; assert.equal(ev2.status, 'connected', JSON.stringify(ev2)); assert.deepEqual(ev2.tools, ['echo']);
  const webMcp = http.createServer(async (req, res) => {
    const m = JSON.parse((await body(req)).toString() || '{}');
    if (req.headers['x-api-key'] !== 'sekret') { res.statusCode = 401; return res.end('{}'); }
    res.setHeader('content-type', 'application/json');
    if (m.method === 'initialize') return res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: '2025-03-26', capabilities: {} } }));
    if (m.method === 'tools/list') return res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'shout', description: 'Upper-cases text', inputSchema: { type: 'object' } }] } }));
    if (m.method === 'tools/call') return res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: String(m.params.arguments.text).toUpperCase() }] } }));
    res.end('');
  }).listen(4103);
  const wm = (await call('POST', '/v1/mcp-servers', { name: 'webecho', transport: 'http', url: 'http://127.0.0.1:4103/mcp', command: '', description: 'Shouts', enabled: true, status: 'unverified', tools: [], config: { 'x-api-key': 'sekret' } })).json;
  assert.equal((await call('POST', `/v1/mcp-servers/${wm.id}/verify`)).json.status, 'connected');
  const mc = (await call('POST', '/v1/conversations', { title: 'mcp', mate: 'mimo', messages: [] })).json;
  let me = await sse(mc.id, 'use stdio mcp please');
  assert.ok(me.some((e) => e.type === 'tool_result' && e.name === 'mcp_call' && e.ok), 'stdio MCP tool ran'); assert.match(me.at(-1).message.text, /echo: ping \(env tok-123\)/);
  assert.ok(llmSys.findLast((x) => x.includes('You are Mimo')).includes('- echo: Echoes text (1 tools)'), 'the prompt lists MCP servers by name only');
  me = await sse(mc.id, 'use http mcp please'); assert.match(me.at(-1).message.text, /HEY/);
  ok('MCP: stdio and HTTP servers verified and called by an agent, secrets sealed and passed as env/headers');

  /* access: an agent can be cut off from MCP, the graph and shared memory */
  await call('PATCH', '/v1/mates/mimo', { access: { mcp: 'none', graph: 'none', memory: { personal: true, shared: 'none' } } });
  me = await sse(mc.id, 'use stdio mcp again');
  const cut = llmSys.findLast((x) => x.includes('You are Mimo'));
  assert.ok(!cut.includes('**MCP servers**') && !cut.includes('knowledge graph: ') && !cut.includes('Owner prefers metric units'), 'no MCP, graph or shared memories in the prompt');
  assert.ok(!me.some((e) => e.type === 'tool_result' && e.name === 'mcp_call' && e.ok), 'mcp_call is refused or absent');
  await call('PATCH', '/v1/mates/mimo', { access: { mcp: 'all', graph: 'write', memory: { personal: true, shared: 'write' } } });
  webMcp.close();
  ok('access: per-agent MCP, graph and memory limits are enforced and hidden from the prompt');

  /* learning into the knowledge graph, with one-value relations replaced */
  const gc = (await call('POST', '/v1/conversations', { title: 'team', mate: 'research', messages: [] })).json;
  await sse(gc.id, 'FYI: Priya reports to Arun in the design team');
  const g1 = await until(async () => { const g = (await call('GET', '/v1/graph')).json; return g.edges.length >= 2 ? g : null; });
  const id = (n) => g1.nodes.find((x) => x.name === n)?.id;
  assert.ok(id('Priya') && id('Arun') && g1.edges.some((e) => e.from === id('Priya') && e.rel === 'reports_to' && e.to === id('Arun')), 'graph learned Priya reports_to Arun');
  assert.ok((await call('GET', '/v1/memories')).json.some((m) => m.text.includes('Priya reports to Arun') && m.scope === 'shared'));
  await sse(gc.id, 'update: Priya now reports to Meena');
  const g2 = await until(async () => { const g = (await call('GET', '/v1/graph?history=1')).json; return g.nodes.some((x) => x.name === 'Meena') && g.edges.some((e) => e.endedAt) ? g : null; });
  const gid = (n) => g2.nodes.find((x) => x.name === n)?.id;
  assert.ok(g2.edges.some((e) => e.rel === 'reports_to' && e.to === gid('Meena') && !e.endedAt) && g2.edges.some((e) => e.rel === 'reports_to' && e.to === gid('Arun') && e.endedAt), 'reports_to moved to Meena, the old value is history');
  me = await sse(mc.id, 'ask the graph about Priya');
  assert.match(me.at(-1).message.text, /Done: Priya \[person\]/);
  me = await sse(mc.id, 'use the tea skill'); assert.ok(me.some((e) => e.type === 'tool_result' && e.name === 'skill_load' && e.ok), 'skill_load works');
  assert.ok(llmMsgs.at(-1).some((m) => String(m.content).includes('ALWAYS-MENTION-OOLONG')), 'the skill text arrives through the tool');
  ok('knowledge graph: learned from chat, one-value relations replaced with history, graph_query and skill_load tools');

  /* coding harness: detection, and a supervised job that needs a second round */
  const hz = (await call('GET', '/v1/coder/harnesses?fresh=1')).json;
  assert.equal(hz.codex.ok, true, JSON.stringify(hz.codex)); assert.match(hz.codex.version, /fake/); assert.equal(hz.builtin.ok, true);
  const ht = (await call('POST', '/v1/coder/test', { harness: 'codex', sandbox: 'host' })).json;
  assert.equal(ht.ok, true, JSON.stringify(ht)); assert.deepEqual(ht.files, ['hello.txt']);
  assert.ok(ht.logs.some((l) => /Review round 1: .*oops/.test(l)) && ht.logs.some((l) => /Review round 2: accepted/.test(l)), 'the supervisor sent it back once, then accepted');
  assert.ok(ht.logs.some((l) => /resumed thread-fake-1/.test(l)), 'round 2 resumed the same Codex session');
  assert.ok(ht.logs.some((l) => /check: node --version → exit 0/.test(l)), 'the brief\'s test command ran');
  assert.equal((await call('POST', '/v1/coder/test', { harness: 'nope' })).status, 400);
  { const rr = await call('PATCH', '/v1/settings', { coderHarness: 'codex', coderSandbox: 'host' }); assert.equal(rr.json.coderHarness, 'codex', rr.text.slice(0, 400)); }
  assert.ok((await call('GET', '/v1/server/status')).json.features.some((i) => i.key === 'harness' && /Codex/.test(i.note)), 'Server page shows the harness');
  await call('PATCH', '/v1/settings', { coderHarness: 'builtin', coderSandbox: 'auto' });
  ok('coding harness: detected via its npm shim, supervised brief → work → test → review → resume → accepted');

  /* scheduler */
  const before = (await call('GET', '/v1/runs')).json.length;
  await call('POST', '/v1/automations', { name: 'Every minute', description: 'Say hello', schedule: { kind: 'cron', cron: '* * * * *' }, enabled: true });
  assert.equal((await fetch(`${A}/internal/tick`, { headers: { 'x-cron-secret': 'wrong' } })).status, 401);
  const wait2 = 60500 - (Date.now() % 60000); console.log(`  … waiting ${Math.round(wait2 / 1000)}s for the next minute so the cron job is due`); await wait(wait2);
  const tk = await (await fetch(`${A}/internal/tick`, { headers: { 'x-cron-secret': 'cron' } })).json(); assert.equal(tk.fired, 1);
  await until(async () => (await call('GET', '/v1/runs')).json.length > before, 8000);
  ok('scheduler: due automation fires a run via /internal/tick');

  /* Jarvis mode: default watches, deadline alerts, call reminders, the daily call cap, watch_add by the leader */
  const tickNow = () => fetch(`${A}/internal/tick`, { headers: { 'x-cron-secret': 'cron' } }).then((r) => r.json());
  let lead = (await call('GET', '/v1/leader')).json;
  assert.equal(lead.leader, 'mimo'); assert.deepEqual(lead.watches.map((w) => w.kind).sort(), ['calendar', 'runs'], 'runs and calendar are watched by default');
  await call('POST', '/v1/tasks', { title: 'Send the invoice', detail: '', status: 'todo', tags: [], dueAt: new Date(Date.now() + 30 * 60_000).toISOString() });
  const calW = lead.watches.find((w) => w.kind === 'calendar');
  const raised = (await call('POST', `/v1/watches/${calW.id}/check`)).json.raised;
  assert.ok(raised.some((a) => a.title === 'Due within the hour: Send the invoice' && a.score === 4), JSON.stringify(raised));
  assert.equal((await call('POST', `/v1/watches/${calW.id}/check`)).json.raised.length, 0, 'the same alert is not raised twice');
  const callsBefore = (await call('GET', '/v1/calls?limit=50')).json.length;
  await call('PATCH', '/v1/settings', { maxCallsPerDay: 1 });
  await call('POST', '/v1/events', { title: 'Call the bank', start: new Date(Date.now() + 3000).toISOString(), end: new Date(Date.now() + 60_000).toISOString(), kind: 'reminder', notes: 'About the loan', deliver: 'call' });
  await wait(3500); await tickNow();
  const rang = await until(async () => { const c = (await call('GET', '/v1/calls?limit=50')).json; return c.length > callsBefore ? c : null; });
  assert.ok(rang.some((c) => c.reason === 'Reminder: Call the bank' && c.mate === 'mimo' && /About the loan/.test(c.goal)), 'a "call me" reminder rings through the leader');
  await call('POST', '/v1/events', { title: 'Second call', start: new Date(Date.now() + 3000).toISOString(), end: new Date(Date.now() + 60_000).toISOString(), kind: 'reminder', notes: '', deliver: 'call' });
  await wait(3500); await tickNow(); await wait(1500);
  assert.equal((await call('GET', '/v1/calls?limit=50')).json.filter((c) => c.reason === 'Reminder: Second call').length, 0, 'the daily call cap holds the second call');
  assert.ok((await call('GET', '/v1/inbox')).json.some((n) => /Reminder: Second call/.test(n.text) && /could not call/.test(n.text)), 'a held call becomes a message');
  await call('PATCH', '/v1/settings', { maxCallsPerDay: 3 });
  const lc2 = (await call('POST', '/v1/conversations', { title: 'watch', mate: 'mimo', messages: [] })).json;
  const wv = await sse(lc2.id, 'please keep an eye on acme for me');
  assert.ok(wv.some((e) => e.type === 'tool_result' && e.name === 'watch_add' && e.ok));
  lead = (await call('GET', '/v1/leader')).json; assert.ok(lead.watches.some((w) => w.kind === 'topic' && w.config.query === 'Acme Corp funding' && w.everyMinutes >= 60));
  assert.ok(lead.alerts.some((a) => a.source === 'calendar'));
  /* company: the directory, work for real people, check-in drafts */
  const imp = (await call('POST', '/v1/people/import', { csv: 'name,role,team,manager,email\nMeera Rao,CEO,Leadership,,meera@x.co\nArun Kumar,Designer,Design,Meera Rao,arun@x.co\n"Li, Wei",Engineer,Platform,Meera Rao,' })).json;
  assert.deepEqual([imp.added, imp.teams], [3, 3], JSON.stringify(imp));
  const ppl = (await call('GET', '/v1/people')).json; const arun = ppl.find((x) => x.name === 'Arun Kumar');
  assert.equal(arun.managerId, ppl.find((x) => x.name === 'Meera Rao').id); assert.ok(ppl.some((x) => x.name === 'Li, Wei'), 'quoted CSV names');
  const cc = (await call('POST', '/v1/conversations', { title: 'company', mate: 'mimo', messages: [] })).json;
  let ce = await sse(cc.id, 'please give arun the launch deck');
  assert.ok(ce.some((e) => e.type === 'tool_result' && e.name === 'assign_task' && e.ok), 'the leader assigns work to a person');
  assert.ok((await call('GET', '/v1/assignments')).json.some((x) => x.title === 'Launch deck' && x.assigneeId === arun.id && x.status === 'todo'));
  ce = await sse(cc.id, 'please check in with arun');
  const drafts = (await call('GET', '/v1/checkins')).json.filter((x) => x.personId === arun.id); assert.equal(drafts[0]?.status, 'draft');
  const sentTry = (await call('POST', `/v1/checkins/${drafts[0].id}/send`)).json; assert.equal(sentTry.status, 'draft'); assert.match(sentTry.error, /not joined/);
  const ov = (await call('GET', '/v1/company/overview')).json; assert.equal(ov.people.find((x) => x.id === arun.id).open, 1);
  assert.match((await call('POST', `/v1/people/${arun.id}/invite`)).json.command, /^\/join [A-F0-9]{8}$/);
  ok('company: CSV import with managers, the leader assigns work and drafts a check-in, overview, invites');

  ok('Jarvis mode: default watches, deadline alert scored 4 once, call reminder rings via the leader, daily call cap, watch_add tool');

  /* pairing, owner status, devices, inbox, ask_owner */
  const st = (await call('GET', '/v1/server/status')).json; assert.ok(st.features.some((f) => f.key === 'tunnel')); assert.equal(st.pairing.paired, false);
  assert.equal((await call('POST', '/v1/pair', { code: '000000' })).status, 400);
  const dev = await call('POST', '/v1/devices', { kind: 'expo', token: 'ExponentPushToken[abc123]', label: 'Pixel' }); assert.equal(dev.status, 201);
  assert.equal((await call('GET', '/v1/devices')).json.length, 1);
  assert.equal((await call('POST', '/v1/devices', { kind: 'web', subscription: { endpoint: 'http://insecure' } })).status, 400);
  assert.ok(Array.isArray((await call('GET', '/v1/inbox')).json));
  assert.equal((await call('GET', '/v1/questions')).json.length, 0);
  assert.ok((await call('GET', '/v1/push/key')).json.publicKey.length > 40);
  ok('owner status, pairing rejects a wrong code, devices registered, inbox, push key');

  /* integrations: the registry, link codes, webhooks with their own auth, health ingest, stand-up, voice */
  const ints = (await call('GET', '/v1/integrations')).json;
  for (const k of ['obsidian', 'notion', 'google', 'slack', 'wacloud', 'todoist', 'linear', 'spotify', 'feeds', 'health', 'home']) assert.ok(ints.some((i) => i.key === k && i.steps.length && i.what), `integration ${k} is described`);
  assert.ok(ints.find((i) => i.key === 'slack').manifest.includes('socket_mode_enabled'));
  assert.ok(ints.find((i) => i.key === 'feeds').ready && !ints.find((i) => i.key === 'home').ready);
  assert.equal((await call('POST', '/v1/integrations/slack/link-code', {})).status, 503, 'no link code before Slack is set up');
  assert.equal((await call('POST', '/v1/integrations/obsidian/test', {})).json.ok, false);
  assert.ok((await call('GET', '/v1/server/status')).json.features.some((f) => f.key === 'home' && !f.ready && /Optional/.test(f.fix)));
  assert.ok((await call('GET', '/v1/server/config')).json.some((f) => f.key === 'HA_TOKEN' && f.secret), 'integration keys are editable from the dashboard');
  assert.equal((await fetch(`${A}/whatsapp/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` }, body: '{}' })).status, 401, 'unsigned WhatsApp webhooks are refused');
  assert.equal((await fetch(`${A}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=x&hub.challenge=1`)).status, 403);
  assert.equal((await fetch(`${A}/health/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer lmh_nopenopenopenopenopenope' }, body: '{"days":[]}' })).status, 401);
  const hk = (await call('POST', '/v1/health/key', {})).json.key;
  const today = new Date().toISOString().slice(0, 10);
  const ing = await fetch(`${A}/health/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${hk}` }, body: JSON.stringify({ days: [{ date: today, steps: 9100, sleepMinutes: 440 }] }) });
  assert.equal((await ing.json()).saved, 1);
  assert.equal((await call('POST', '/v1/health/import', { csv: `date,steps\n${today},9200` })).json.saved, 1);
  const su2 = await call('POST', '/v1/leader/standup', {}); assert.equal(su2.status, 200); assert.ok(su2.json.text.length > 10);
  assert.equal((await call('GET', '/v1/standups')).json.length, 1);
  assert.equal((await call('PATCH', '/v1/settings', { standupOn: true, standupDay: 9, standupAt: '25:00' })).json.standupDay, 6, 'stand-up day clamped, bad time ignored');
  const pv = await call('GET', '/v1/voice/preview?mate=research&voice=Kore');
  assert.ok([200, 501, 502].includes(pv.status), 'voice preview answers (501 without a Gemini key)');
  ok('integrations: registry, link codes, signed webhooks, health ingest key + CSV, stand-up, settings, voice preview');

  /* the nightly review: a step the checker sent back becomes a lesson in that agent's next prompt; a drafted skill waits */
  {
    await call('PATCH', '/v1/settings', { retriesOnFailure: 1, permissionMode: 'ask', askBeforeRisky: true });
    const wf = (await call('POST', '/v1/workflows', { name: 'Units table', nodes: [{ id: 'n1', type: 'mate', mate: 'writer', label: 'Draft the units table', x: 0, y: 0 }], edges: [] })).json;
    const rr = (await call('POST', '/v1/runs', { prompt: 'Make a table of LDO specs', workflowId: wf.id })).json;
    const rd = await until(async () => { const r = (await call('GET', `/v1/runs/${rr.id}`)).json; return ['done', 'failed'].includes(r.status) ? r : null; });
    const st = rd.steps.find((x) => x.label === 'Draft the units table');
    assert.equal(st.status, 'done'); assert.equal(st.attempt, 2); assert.deepEqual(st.checks, ['The table has no units.'], 'the checker\'s reason is kept on the step');
    const rv = (await call('POST', '/v1/reflect', {})).json;
    const w = rv.mates.find((m) => m.mate === 'writer');
    assert.ok(w?.lessons.length && w.evidence.some((e) => /no units/.test(e.text)), JSON.stringify(rv).slice(0, 800));
    assert.equal(w.skill?.status, 'draft', 'in ask mode a self-written skill is a draft');
    const sk = (await call('GET', '/v1/skills')).json.find((s) => s.name === 'Tables with units');
    assert.equal(sk.enabled, false); assert.equal(sk.origin, 'self'); assert.equal(sk.by, 'writer'); assert.equal(sk.review, 'pending');
    const q = (await call('GET', '/v1/questions')).json.find((x) => /Tables with units/.test(x.question)); assert.ok(q, 'the owner is asked');
    await call('POST', `/v1/questions/${q.id}/answer`, { answer: q.options[0] });
    assert.equal((await call('GET', `/v1/skills/${sk.id}`)).json.enabled, true, 'answering "Switch it on" enables it');
    assert.ok((await call('GET', '/v1/memories')).json.some((m) => m.kind === 'lesson' && m.mate === 'writer' && m.scope === 'personal'));
    assert.equal((await call('GET', '/v1/reflections')).json[0].id, rv.id);
    const conv = (await call('POST', '/v1/conversations', { title: 'Tables', mate: 'writer', messages: [] })).json; const before = llmSys.length;
    await call('POST', `/v1/conversations/${conv.id}/messages`, { text: 'Make me a table of the three LDOs', mate: 'writer' });
    assert.ok(llmSys.slice(before).some((s) => s.includes('Lessons from your own past work') && s.includes('include the units in every row')), 'next time, the lesson is in front of Writer');
    assert.ok(!llmSys.slice(before).some((s) => s.includes('When Ops hands over')), 'and only Writer\'s own lessons');
    assert.equal((await call('PATCH', '/v1/settings', { reflectAt: '27:00' })).json.reflectAt, '03:00', 'a bad review time is ignored');
  }
  ok('nightly review: a sent-back step becomes a lesson, the lesson reaches only that agent\'s next prompt, a self-written skill waits for the owner\'s OK');
  console.log(`\nALL ${pass} CHECKS PASSED`);
} catch (e) { console.error('\nFAILED:', e.stack || e); process.exitCode = 1; }
finally { cleanup(); setTimeout(() => process.exit(process.exitCode ?? 0), 200); }
