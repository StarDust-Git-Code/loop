// Smoke test for the browser service (needs a Chromium: set BROWSER_EXECUTABLE or install via playwright-core).
// node scripts/browser-test.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
process.env.SERVICE_SECRET = 'test-secret-test-secret-test-secret';
const { svcFetch } = await import('../src/lib/svc.js');
const site = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(q.url === '/next' ? '<title>Next</title><p>arrived</p>' : '<title>Home</title><h1>Hello</h1><a href="/next">Go next</a><input placeholder="Name"><input type="password" placeholder="Pass"><button onclick="document.title=\'clicked\'">Press</button>'); }).listen(0);
const port = site.address().port;
const start = (extra) => new Promise((res) => { const p = spawn('node', ['src/browser/index.js'], { env: { ...process.env, PORT: String(0 + extra.port), BROWSER_INSTANCES: '2', ...extra.env }, stdio: ['ignore', 'pipe', 'inherit'] }); p.stdout.on('data', (d) => { if (String(d).includes('listening')) res(p); }); });
const call = (base, path, body, method = 'POST') => svcFetch(base, path, { method, body }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
let n = 0; const ok = (m) => console.log(`  ✓ ${m}`, ++n && '');

const A = await start({ port: 10411, env: { BROWSER_ALLOW_PRIVATE: '1' } }); const base = 'http://127.0.0.1:10411';
try {
  const s1 = await call(base, '/v1/sessions', { uid: 'u1' }); const s2 = await call(base, '/v1/sessions', { uid: 'u2' });
  const st = await call(base, '/v1/status', undefined, 'GET');
  assert.deepEqual(st.instances.map((i) => i.sessions).sort(), [1, 1]); ok('two sessions are spread over two browser instances');
  let r = await call(base, `/v1/sessions/${s1.id}/goto`, { uid: 'u1', url: `http://127.0.0.1:${port}/` });
  assert.equal(r.title, 'Home'); assert.ok(r.text.includes('Hello')); assert.ok(r.elements.some((e) => e.text === 'Go next')); ok('opens a page, reads text and numbered elements');
  const link = r.elements.find((e) => e.text === 'Go next');
  r = await call(base, `/v1/sessions/${s1.id}/click`, { uid: 'u1', ref: link.ref }); assert.equal(r.title, 'Next'); ok('click follows a link');
  await call(base, `/v1/sessions/${s1.id}/back`, { uid: 'u1' });
  r = await call(base, `/v1/sessions/${s1.id}/snapshot`, { uid: 'u1' });
  const name = r.elements.find((e) => e.text === 'Name'), pass = r.elements.find((e) => e.text === 'Pass');
  r = await call(base, `/v1/sessions/${s1.id}/type`, { uid: 'u1', ref: name.ref, text: 'Star' }); assert.equal(r.elements.find((e) => e.ref === name.ref).value, 'Star'); ok('types into an input');
  const pw = await call(base, `/v1/sessions/${s1.id}/type`, { uid: 'u1', ref: pass.ref, text: 'hunter2' }); assert.equal(pw.status, 403); ok('refuses to type into a password field');
  const shot = await call(base, `/v1/sessions/${s1.id}/screenshot`, { uid: 'u1' }); assert.ok(shot.png.length > 500); ok('screenshot');
  const other = await call(base, `/v1/sessions/${s1.id}/snapshot`, { uid: 'u2' }); assert.equal(other.status, 404); ok('another user cannot use the session');
  const unsigned = await fetch(`${base}/v1/status`); assert.equal(unsigned.status, 401); ok('unsigned requests are rejected');
  await call(base, `/v1/sessions/${s1.id}`, {}, 'DELETE');
} finally { A.kill(); }

const B = await start({ port: 10412, env: {} });
try {
  const s = await call('http://127.0.0.1:10412', '/v1/sessions', { uid: 'u1' });
  const blocked = await call('http://127.0.0.1:10412', `/v1/sessions/${s.id}/goto`, { uid: 'u1', url: `http://127.0.0.1:${port}/` }); assert.equal(blocked.status, 400); ok('private/localhost addresses are blocked by default');
  const meta = await call('http://127.0.0.1:10412', `/v1/sessions/${s.id}/goto`, { uid: 'u1', url: 'http://169.254.169.254/latest/meta-data' }); assert.equal(meta.status, 400); ok('cloud metadata address is blocked');
} finally { B.kill(); }
console.log(`\nALL ${n} BROWSER CHECKS PASSED`); site.close(); process.exit(0);
