// Smoke test for the in-process browser engine (uses Edge/Chrome on this computer, BROWSER_EXECUTABLE, or Chromium
// installed from the setup page). node scripts/browser-test.mjs
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The address guard reads its setting at startup, so the "blocked" checks run in their own process.
const blockedOnly = process.argv[2] === 'blocked';
process.env.BROWSER_ALLOW_PRIVATE = blockedOnly ? '' : '1';
process.env.BROWSER_INSTANCES = '2';
const B = await import('../src/browser/index.js');
const site = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(q.url === '/next' ? '<title>Next</title><p>arrived</p>' : '<title>Home</title><h1>Hello</h1><a href="/next">Go next</a><form><input aria-label="Name"><input type="password" aria-label="Pass"></form>'); }).listen(0);
const port = site.address().port;
const status = async (p) => { try { await p; return 200; } catch (e) { return e.statusCode ?? 500; } };
let n = 0; const ok = (m) => console.log(`  ✓ ${m}`, ++n && '');

if (blockedOnly) {
  const s = await B.openSession('u3');
  assert.equal(await status(B.act(s.id, 'u3', 'goto', { url: `http://127.0.0.1:${port}/` })), 400); ok('private/localhost addresses are blocked');
  assert.equal(await status(B.act(s.id, 'u3', 'goto', { url: 'http://169.254.169.254/latest/meta-data' })), 400); ok('cloud metadata address is blocked');
  process.exit(0);
}

const s1 = await B.openSession('u1'); await B.openSession('u2');
let r = await B.act(s1.id, 'u1', 'goto', { url: `http://127.0.0.1:${port}/` });
assert.equal(r.title, 'Home'); assert.ok(r.text.includes('Hello')); assert.ok(r.elements.some((e) => e.text === 'Go next')); ok('opens a page, reads text and numbered elements');
r = await B.act(s1.id, 'u1', 'click', { ref: r.elements.find((e) => e.text === 'Go next').ref }); assert.equal(r.title, 'Next'); ok('click follows a link');
await B.act(s1.id, 'u1', 'back');
r = await B.act(s1.id, 'u1', 'snapshot');
const name = r.elements.find((e) => e.text === 'Name'), pass = r.elements.find((e) => e.text === 'Pass');
r = await B.act(s1.id, 'u1', 'type', { ref: name.ref, text: 'Star' }); assert.equal(r.elements.find((e) => e.ref === name.ref).value, 'Star'); ok('types into an input');
assert.equal(await status(B.act(s1.id, 'u1', 'type', { ref: pass.ref, text: 'hunter2' })), 403); ok('refuses to type into a password field');
assert.ok((await B.act(s1.id, 'u1', 'screenshot')).png.length > 500); ok('screenshot');
assert.equal(await status(B.act(s1.id, 'u2', 'snapshot')), 404); ok('another user cannot use the session');
await B.closeSession(s1.id);

process.stdout.write(execFileSync(process.execPath, [fileURLToPath(import.meta.url), 'blocked']));
console.log(`\nALL ${n + 2} BROWSER CHECKS PASSED`); site.close(); process.exit(0);
