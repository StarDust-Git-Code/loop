// Browser service: runs on your own Linux VM (not Render). A pool of headless Chromium instances (default 2) hosts
// isolated sessions that Mates drive through the API's browser_* tools. Every call is signed with SERVICE_SECRET.
//
//   node src/browser/index.js        env: SERVICE_SECRET, PORT (default 10000), BROWSER_INSTANCES (2),
//                                         BROWSER_MAX_SESSIONS (4), BROWSER_IDLE_SECONDS (300), BROWSER_EXECUTABLE (optional)
import dns from 'node:dns/promises';
import net from 'node:net';
import { env, need, num } from '../lib/env.js';
import { createServer, svcOnly, listen } from '../lib/server.js';

need('SERVICE_SECRET');
const INSTANCES = Math.max(1, num('BROWSER_INSTANCES', 2));
const MAX_SESSIONS = Math.max(1, num('BROWSER_MAX_SESSIONS', 4));
const IDLE_MS = num('BROWSER_IDLE_SECONDS', 300) * 1000;
const NAV_MS = 30_000, ACT_MS = 10_000;
const ALLOW_PRIVATE = env('BROWSER_ALLOW_PRIVATE') === '1';

const { chromium } = await import('playwright-core').catch(() => { console.error('playwright-core is not installed. Run: npm i playwright-core && npx playwright-core install chromium'); process.exit(1); });
const app = await createServer('browser');

/* ------------------------------------------------------------ safety: never let a page reach the VM's own network */
const privateIp = (ip) => {
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:') && privateIp(l.slice(7)); }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};
const hostOk = new Map(); // host -> { ok, at }
async function allowedHost(host) {
  if (ALLOW_PRIVATE) return true;
  const hit = hostOk.get(host); if (hit && Date.now() - hit.at < 60_000) return hit.ok;
  let ok = false;
  try {
    if (net.isIP(host)) ok = !privateIp(host);
    else if (!/^(localhost|.*\.local|.*\.internal)$/i.test(host)) { const addrs = await dns.lookup(host, { all: true }); ok = addrs.length > 0 && addrs.every((a) => !privateIp(a.address)); }
  } catch { ok = false; }
  hostOk.set(host, { ok, at: Date.now() }); if (hostOk.size > 2000) hostOk.clear();
  return ok;
}
async function guard(route) {
  const u = new URL(route.request().url());
  if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return route.continue();
  if (!['http:', 'https:'].includes(u.protocol) || !(await allowedHost(u.hostname.replace(/^\[|\]$/g, '')))) return route.abort('blockedbyclient');
  return route.continue();
}

/* ------------------------------------------------------------ browser pool */
const pool = Array.from({ length: INSTANCES }, (_, i) => ({ i, browser: null, launching: null, sessions: new Set() }));
async function instance(slot) {
  if (slot.browser?.isConnected()) return slot.browser;
  slot.launching ??= chromium.launch({
    headless: true, executablePath: env('BROWSER_EXECUTABLE') || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-background-networking', '--disable-extensions', '--mute-audio', '--no-first-run', '--js-flags=--max-old-space-size=1024'],
  }).then((b) => { slot.browser = b; b.on('disconnected', () => { for (const id of slot.sessions) drop(id, true); slot.browser = null; }); return b; }).finally(() => { slot.launching = null; });
  return slot.launching;
}

/* ------------------------------------------------------------ sessions */
const sessions = new Map(); // id -> { id, uid, slot, ctx, pages, cur, last }
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

async function drop(id, crashed = false) {
  const s = sessions.get(id); if (!s) return; sessions.delete(id); s.slot.sessions.delete(id);
  if (!crashed) await s.ctx.close().catch(() => {});
}
setInterval(() => { for (const s of sessions.values()) if (Date.now() - s.last > IDLE_MS) void drop(s.id); }, 30_000).unref();

async function open(uid) {
  for (const s of [...sessions.values()]) if (s.uid === uid && sessions.size >= MAX_SESSIONS) { await drop(s.id); break; } // a user never holds more than needed when full
  if (sessions.size >= MAX_SESSIONS) throw Object.assign(new Error(`All ${MAX_SESSIONS} browser sessions are busy. Try again in a minute.`), { statusCode: 429 });
  const slot = [...pool].sort((a, b) => a.sessions.size - b.sessions.size)[0];
  const browser = await instance(slot);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', acceptDownloads: false, serviceWorkers: 'block', permissions: [] });
  await ctx.route('**/*', guard);
  ctx.setDefaultTimeout(ACT_MS); ctx.setDefaultNavigationTimeout(NAV_MS);
  const page = await ctx.newPage();
  const s = { id: rid(), uid, slot, ctx, cur: page, last: Date.now() };
  ctx.on('page', (p) => { s.cur = p; }); // a link that opens a new tab moves focus to it
  slot.sessions.add(s.id); sessions.set(s.id, s);
  return s;
}
const get = (id, uid) => { const s = sessions.get(id); if (!s || s.uid !== uid) throw Object.assign(new Error('Browser session expired. Open the page again.'), { statusCode: 404 }); s.last = Date.now(); return s; };

/* ------------------------------------------------------------ reading a page: text + numbered interactive elements */
const SNAP = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0; };
  document.querySelectorAll('[data-lmref]').forEach((e) => e.removeAttribute('data-lmref'));
  const sel = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=radio],[role=switch],[role=combobox],[onclick],[contenteditable=""],[contenteditable=true]';
  const els = []; let n = 0;
  for (const el of document.querySelectorAll(sel)) {
    if (n >= 120) break; if (!vis(el)) continue; if (el.tagName === 'INPUT' && el.type === 'hidden') continue;
    n++; el.setAttribute('data-lmref', String(n));
    const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    els.push({ ref: n, tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || el.getAttribute('role') || '', text: label, href: el.tagName === 'A' ? (el.getAttribute('href') || '').slice(0, 100) : undefined, value: ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && el.type !== 'password' ? String(el.value ?? '').slice(0, 60) : undefined, checked: el.checked || undefined, disabled: el.disabled || undefined });
  }
  const text = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000);
  return { title: document.title.slice(0, 120), url: location.href, text, elements: els, scroll: { y: Math.round(scrollY), max: Math.max(0, Math.round(document.documentElement.scrollHeight - innerHeight)) } };
};
async function snapshot(s) {
  const page = s.cur;
  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {}); // many sites never go idle: just move on
  const snap = await page.evaluate(SNAP).catch((e) => { throw Object.assign(new Error(`Could not read the page: ${String(e.message).slice(0, 120)}`), { statusCode: 502 }); });
  return { ...snap, tabs: s.ctx.pages().length };
}
const target = (s, ref) => { const n = Number(ref); if (!Number.isInteger(n) || n < 1) throw Object.assign(new Error('ref must be a number from the last page reading'), { statusCode: 400 }); return s.cur.locator(`[data-lmref="${n}"]`).first(); };
const bad = (m, c = 400) => Object.assign(new Error(m), { statusCode: c });

/* ------------------------------------------------------------ actions */
const ACTIONS = {
  async goto(s, a) {
    let u; try { u = new URL(/^[a-z]+:\/\//i.test(a.url) ? a.url : `https://${a.url}`); } catch { throw bad('That is not a valid address'); }
    if (!['http:', 'https:'].includes(u.protocol)) throw bad('Only http and https pages can be opened');
    if (!(await allowedHost(u.hostname.replace(/^\[|\]$/g, '')))) throw bad('That address is private or blocked');
    await s.cur.goto(u.href, { waitUntil: 'domcontentloaded' }).catch((e) => { if (!/net::ERR_ABORTED/.test(e.message)) throw bad(`Could not open the page: ${String(e.message).split('\n')[0].slice(0, 160)}`, 502); });
  },
  async snapshot() {},
  async click(s, a) { await target(s, a.ref).click({ timeout: ACT_MS }).catch((e) => { throw bad(`Click failed: ${String(e.message).split('\n')[0].slice(0, 140)}. Read the page again; the layout may have changed.`); }); },
  async hover(s, a) { await target(s, a.ref).hover(); },
  async type(s, a) {
    const el = target(s, a.ref);
    const kind = await el.evaluate((n) => `${n.type || ''}|${n.getAttribute('autocomplete') || ''}`).catch(() => '|');
    if (/password/i.test(kind) || /cc-|one-time-code/i.test(kind)) throw bad('Refusing to type into a password, card or one-time-code field. Ask the owner to do that step.', 403);
    if (a.clear !== false) await el.fill(String(a.text ?? '').slice(0, 5000)); else await el.pressSequentially(String(a.text ?? '').slice(0, 5000));
    if (a.submit) await el.press('Enter');
  },
  async select(s, a) { await target(s, a.ref).selectOption(String(a.value ?? '')); },
  async press(s, a) { await s.cur.keyboard.press(String(a.key ?? 'Enter').slice(0, 30)); },
  async scroll(s, a) { const dy = (a.direction === 'up' ? -1 : 1) * Math.min(5000, Number(a.amount) || 700); await s.cur.mouse.wheel(0, dy); await s.cur.waitForTimeout(300); },
  async back(s) { await s.cur.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {}); },
  async wait(s, a) { await s.cur.waitForTimeout(Math.min(10, Math.max(0.2, Number(a.seconds) || 1)) * 1000); },
  async tabs(s, a) {
    const pages = s.ctx.pages();
    if (a.action === 'new') { const p = await s.ctx.newPage(); s.cur = p; if (a.url) await ACTIONS.goto(s, { url: a.url }); }
    else if (a.action === 'switch') { const p = pages[Number(a.index)]; if (!p) throw bad('No such tab'); s.cur = p; await p.bringToFront(); }
    else if (a.action === 'close') { if (pages.length <= 1) throw bad('This is the last tab'); const p = pages[Number(a.index ?? pages.indexOf(s.cur))]; if (!p) throw bad('No such tab'); await p.close(); s.cur = s.ctx.pages().at(-1); }
  },
};

app.post('/v1/sessions', { preHandler: svcOnly }, async (req) => {
  const uid = String(req.body?.uid ?? ''); if (!uid) throw bad('uid is required');
  const s = await open(uid); return { id: s.id };
});
app.post('/v1/sessions/:id/:action', { preHandler: svcOnly }, async (req, reply) => {
  const { id, action } = req.params; const body = req.body ?? {};
  const s = get(id, String(body.uid ?? ''));
  if (action === 'screenshot') { const png = await s.cur.screenshot({ type: 'png', fullPage: !!body.fullPage }); return { png: png.toString('base64'), url: s.cur.url() }; }
  if (action === 'tabs' && (!body.action || body.action === 'list')) {
    const list = await Promise.all(s.ctx.pages().map(async (p, i) => ({ index: i, url: p.url(), title: (await p.title().catch(() => '')).slice(0, 80), active: p === s.cur }))); return { tabs: list };
  }
  const fn = ACTIONS[action]; if (!fn) return reply.code(404).send({ error: 'Unknown action' });
  await fn(s, body);
  return snapshot(s);
});
app.delete('/v1/sessions/:id', { preHandler: svcOnly }, async (req) => { const s = sessions.get(req.params.id); if (s) await drop(s.id); return { ok: true }; });
app.get('/v1/status', { preHandler: svcOnly }, async () => ({ instances: pool.map((p) => ({ i: p.i, up: !!p.browser?.isConnected(), sessions: p.sessions.size })), sessions: sessions.size, max: MAX_SESSIONS, mem: Math.round(process.memoryUsage().rss / 1048576) }));

await listen(app);
