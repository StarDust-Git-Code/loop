// Engine A: Playwright + Chromium (x86_64 / arm64). A pool of browser processes hosts isolated contexts.
import { env, num } from '../lib/env.js';
import { SNAP } from './snap.js';
import { allowedHost, bad, isSecretField, normalizeUrl, urlAllowed } from './guard.js';

const NAV_MS = 30_000, ACT_MS = 10_000;
export const name = 'playwright';

export async function create({ instances, maxSessions }) {
  const { chromium } = await import('playwright-core');
  const pool = Array.from({ length: instances }, (_, i) => ({ i, browser: null, launching: null, sessions: new Set() }));
  let total = 0;
  const launch = (slot) => {
    if (slot.browser?.isConnected()) return slot.browser;
    slot.launching ??= chromium.launch({
      headless: true, executablePath: env('BROWSER_EXECUTABLE') || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-background-networking', '--disable-extensions', '--mute-audio', '--no-first-run', '--js-flags=--max-old-space-size=1024'],
    }).then((b) => { slot.browser = b; b.on('disconnected', () => { slot.browser = null; }); return b; }).finally(() => { slot.launching = null; });
    return slot.launching;
  };
  const guard = async (route) => {
    const u = route.request().url();
    return (await urlAllowed(u)) ? route.continue() : route.abort('blockedbyclient');
  };

  return {
    stats: () => ({ instances: pool.map((p) => ({ i: p.i, up: !!p.browser?.isConnected(), sessions: p.sessions.size })), sessions: total, max: maxSessions }),
    async open() {
      if (total >= maxSessions) throw bad(`All ${maxSessions} browser sessions are busy. Try again in a minute.`, 429);
      const slot = [...pool].sort((a, b) => a.sessions.size - b.sessions.size)[0];
      const ctx = await (await launch(slot)).newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', acceptDownloads: false, serviceWorkers: 'block', permissions: [] });
      await ctx.route('**/*', guard);
      ctx.setDefaultTimeout(ACT_MS); ctx.setDefaultNavigationTimeout(NAV_MS);
      let cur = await ctx.newPage(); ctx.on('page', (p) => { cur = p; });
      const key = Symbol('s'); slot.sessions.add(key); total++;
      const ref = (n) => { const k = Number(n); if (!Number.isInteger(k) || k < 1) throw bad('ref must be a number from the last page reading'); return cur.locator(`[data-lmref="${k}"]`).first(); };
      const h = {
        async goto(raw) {
          const u = normalizeUrl(raw); if (!(await allowedHost(u.hostname.replace(/^\[|\]$/g, '')))) throw bad('That address is private or blocked');
          await cur.goto(u.href, { waitUntil: 'domcontentloaded' }).catch((e) => { if (!/net::ERR_ABORTED/.test(e.message)) throw bad(`Could not open the page: ${String(e.message).split('\n')[0].slice(0, 160)}`, 502); });
        },
        async snapshot() {
          await cur.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
          await cur.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
          const s = await cur.evaluate(SNAP).catch((e) => { throw bad(`Could not read the page: ${String(e.message).slice(0, 120)}`, 502); });
          return { ...s, tabs: ctx.pages().length };
        },
        click: (r) => ref(r).click({ timeout: ACT_MS }).catch((e) => { throw bad(`Click failed: ${String(e.message).split('\n')[0].slice(0, 140)}. Read the page again; the layout may have changed.`); }),
        hover: (r) => ref(r).hover(),
        async type(r, text, { submit, clear }) {
          const el = ref(r); const kind = await el.evaluate((n) => `${n.type || ''}|${n.getAttribute('autocomplete') || ''}`).catch(() => '|');
          if (isSecretField(kind)) throw bad('Refusing to type into a password, card or one-time-code field. Ask the owner to do that step.', 403);
          if (clear !== false) await el.fill(String(text).slice(0, 5000)); else await el.pressSequentially(String(text).slice(0, 5000));
          if (submit) await el.press('Enter');
        },
        select: (r, v) => ref(r).selectOption(String(v)),
        press: (k) => cur.keyboard.press(String(k).slice(0, 30)),
        async scroll(dir, amount) { await cur.mouse.wheel(0, (dir === 'up' ? -1 : 1) * Math.min(5000, Number(amount) || 700)); await cur.waitForTimeout(300); },
        back: () => cur.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {}),
        wait: (s) => cur.waitForTimeout(Math.min(10, Math.max(0.2, Number(s) || 1)) * 1000),
        async listTabs() { return Promise.all(ctx.pages().map(async (p, i) => ({ index: i, url: p.url(), title: (await p.title().catch(() => '')).slice(0, 80), active: p === cur }))); },
        async tab(action, index, url) {
          const pages = ctx.pages();
          if (action === 'new') { cur = await ctx.newPage(); if (url) await h.goto(url); }
          else if (action === 'switch') { const p = pages[Number(index)]; if (!p) throw bad('No such tab'); cur = p; await p.bringToFront(); }
          else if (action === 'close') { if (pages.length <= 1) throw bad('This is the last tab'); const p = pages[Number(index ?? pages.indexOf(cur))]; if (!p) throw bad('No such tab'); await p.close(); cur = ctx.pages().at(-1); }
        },
        screenshot: async (full) => (await cur.screenshot({ type: 'png', fullPage: !!full })).toString('base64'),
        url: () => cur.url(),
        async destroy() { slot.sessions.delete(key); total--; await ctx.close().catch(() => {}); },
      };
      return h;
    },
  };
}
