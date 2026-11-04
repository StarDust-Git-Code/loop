// Browser service: runs on your own Linux VM (not Render). Mates drive it through the API's browser_* tools.
// Every call is signed with SERVICE_SECRET. Two engines behind one API:
//   playwright  Chromium, for x86_64 / arm64 machines (default)
//   webdriver   Firefox + geckodriver, for machines without Chromium such as IBM LinuxONE (s390x). Picked automatically there.
// Hosted option: set BROWSERLESS_TOKEN (browserless.io free tier, 1 concurrent session) and this can run on Render with no browser installed.
// env: SERVICE_SECRET, PORT (10000), HOST, BROWSER_ENGINE (auto), BROWSER_INSTANCES (2), BROWSER_MAX_SESSIONS (4, playwright only),
//      BROWSER_IDLE_SECONDS (300), BROWSER_EXECUTABLE (playwright) | BROWSER_BINARY + GECKODRIVER_PATH (webdriver)
import os from 'node:os';
import { env, need, num } from '../lib/env.js';
import { createServer, svcOnly, listen } from '../lib/server.js';
import { bad } from './guard.js';

need('SERVICE_SECRET');
const INSTANCES = Math.max(1, num('BROWSER_INSTANCES', 2));
const IDLE_MS = num('BROWSER_IDLE_SECONDS', 300) * 1000;
const kind = env('BROWSER_ENGINE') || (os.arch() === 's390x' ? 'webdriver' : 'playwright');
const engine = await (await import(kind === 'webdriver' ? './engine-webdriver.js' : './engine-playwright.js')).create({ instances: INSTANCES, maxSessions: Math.max(1, num('BROWSER_MAX_SESSIONS', 4)) })
  .catch((e) => { console.error(`Could not start the ${kind} engine: ${e.message}`); process.exit(1); });
console.log(`browser engine: ${kind} on ${os.arch()}, ${INSTANCES} instance(s)`);

const app = await createServer('browser');
const sessions = new Map(); // id -> { id, uid, h, last }
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const drop = async (id) => { const s = sessions.get(id); if (!s) return; sessions.delete(id); await s.h.destroy().catch(() => {}); };
setInterval(() => { for (const s of sessions.values()) if (Date.now() - s.last > IDLE_MS) void drop(s.id); }, 30_000).unref();
const get = (id, uid) => { const s = sessions.get(id); if (!s || s.uid !== uid) throw bad('Browser session expired. Open the page again.', 404); s.last = Date.now(); return s; };

app.post('/v1/sessions', { preHandler: svcOnly }, async (req) => {
  const uid = String(req.body?.uid ?? ''); if (!uid) throw bad('uid is required');
  for (const s of [...sessions.values()]) if (s.uid === uid && (await engine.stats()).sessions >= (await engine.stats()).max) { await drop(s.id); break; } // when full, a user's older session makes room
  const id = rid(); sessions.set(id, { id, uid, h: await engine.open(uid), last: Date.now() });
  return { id };
});

const ACTIONS = {
  goto: (h, a) => h.goto(String(a.url ?? '')),
  snapshot: () => {},
  click: (h, a) => h.click(a.ref),
  hover: (h, a) => h.hover(a.ref),
  type: (h, a) => h.type(a.ref, String(a.text ?? ''), { submit: a.submit, clear: a.clear }),
  select: (h, a) => h.select(a.ref, a.value),
  press: (h, a) => h.press(String(a.key ?? 'Enter')),
  scroll: (h, a) => h.scroll(a.direction, a.amount),
  back: (h) => h.back(),
  wait: (h, a) => h.wait(a.seconds),
  tabs: (h, a) => h.tab(a.action, a.index, a.url),
};
app.post('/v1/sessions/:id/:action', { preHandler: svcOnly }, async (req, reply) => {
  const { id, action } = req.params; const body = req.body ?? {};
  const { h } = get(id, String(body.uid ?? ''));
  if (action === 'screenshot') return { png: await h.screenshot(!!body.fullPage), url: await h.url() };
  if (action === 'tabs' && (!body.action || body.action === 'list')) return { tabs: await h.listTabs() };
  const fn = ACTIONS[action]; if (!fn) return reply.code(404).send({ error: 'Unknown action' });
  await fn(h, body);
  return h.snapshot();
});
app.delete('/v1/sessions/:id', { preHandler: svcOnly }, async (req) => { await drop(req.params.id); return { ok: true }; });
app.get('/v1/status', { preHandler: svcOnly }, async () => ({ engine: kind, arch: os.arch(), ...engine.stats(), mem: Math.round(process.memoryUsage().rss / 1048576) }));

await listen(app);
