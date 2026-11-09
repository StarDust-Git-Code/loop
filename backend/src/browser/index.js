// Browser engine, in-process and lazy: nothing starts until a Mate first calls a browser_* tool.
//   playwright  Chromium, for x86_64 / arm64 machines (default). Chromium is downloaded on first use if missing.
//   webdriver   Firefox + geckodriver, for machines without Chromium such as IBM LinuxONE (s390x). Picked automatically there.
// env: BROWSER_ENGINE (auto), BROWSER_INSTANCES (2), BROWSER_MAX_SESSIONS (4, playwright only), BROWSER_IDLE_SECONDS (300),
//      BROWSER_EXECUTABLE (playwright) | BROWSER_BINARY + GECKODRIVER_PATH (webdriver)
import os from 'node:os';
import { env, num } from '../lib/env.js';
import { bad } from './guard.js';

const kind = () => env('BROWSER_ENGINE') || (os.arch() === 's390x' ? 'webdriver' : 'playwright');
let enginePromise = null;
let state = { status: 'idle', note: '' }; // idle | starting | ready | error
const sessions = new Map(); // id -> { id, uid, h, last }
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function engine() {
  if (!enginePromise) {
    state = { status: 'starting', note: `Starting ${kind()}…` };
    enginePromise = (async () => {
      const mod = await import(kind() === 'webdriver' ? './engine-webdriver.js' : './engine-playwright.js');
      const e = await mod.create({ instances: Math.max(1, num('BROWSER_INSTANCES', 2)), maxSessions: Math.max(1, num('BROWSER_MAX_SESSIONS', 4)) });
      state = { status: 'ready', note: `${kind()} on ${os.arch()}` };
      setInterval(() => { const idle = num('BROWSER_IDLE_SECONDS', 300) * 1000; for (const s of sessions.values()) if (Date.now() - s.last > idle) void drop(s.id); }, 30_000).unref();
      return e;
    })().catch((e) => { enginePromise = null; state = { status: 'error', note: e.message }; throw bad(`The browser could not start: ${e.message}`, 503); });
  }
  return enginePromise;
}

const drop = async (id) => { const s = sessions.get(id); if (!s) return; sessions.delete(id); await s.h.destroy().catch(() => {}); };
const get = (id, uid) => { const s = sessions.get(id); if (!s || s.uid !== uid) throw bad('Browser session expired. Open the page again.', 404); s.last = Date.now(); return s; };

export async function openSession(uid) {
  if (!uid) throw bad('uid is required');
  const e = await engine();
  const st = await e.stats();
  if (st.sessions >= st.max) for (const s of [...sessions.values()]) if (s.uid === uid) { await drop(s.id); break; } // when full, a user's older session makes room
  const id = rid(); sessions.set(id, { id, uid, h: await e.open(uid), last: Date.now() });
  return { id };
}

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
export async function act(id, uid, action, body = {}) {
  const { h } = get(id, uid);
  if (action === 'screenshot') return { png: await h.screenshot(!!body.fullPage), url: await h.url() };
  if (action === 'tabs' && (!body.action || body.action === 'list')) return { tabs: await h.listTabs() };
  const fn = ACTIONS[action]; if (!fn) throw bad('Unknown action', 404);
  await fn(h, body);
  return h.snapshot();
}
export const closeSession = (id) => drop(id);
export function browserStatus() { return { engine: kind(), arch: os.arch(), ...state, sessions: sessions.size }; }
