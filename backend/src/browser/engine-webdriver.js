// Engine B: WebDriver (Selenium) + Firefox + geckodriver. For machines where Chromium does not exist, such as IBM LinuxONE (s390x).
// One Firefox process per session (warm slots are pre-started); a slot is quit and relaunched after each session so nothing leaks.
import { env } from '../lib/env.js';
import { SNAP } from './snap.js';
import { bad, isSecretField, normalizeUrl, urlAllowed } from './guard.js';

export const name = 'webdriver';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function create({ instances }) {
  const wd = await import('selenium-webdriver');
  const { Builder, By, Key } = wd;
  const browserName = env('BROWSER_NAME', 'firefox');
  const KEYS = { Enter: Key.ENTER, Tab: Key.TAB, Escape: Key.ESCAPE, ArrowDown: Key.ARROW_DOWN, ArrowUp: Key.ARROW_UP, ArrowLeft: Key.ARROW_LEFT, ArrowRight: Key.ARROW_RIGHT, PageDown: Key.PAGE_DOWN, PageUp: Key.PAGE_UP, Backspace: Key.BACK_SPACE, Space: ' ', Home: Key.HOME, End: Key.END };

  async function launch() {
    const b = new Builder().forBrowser(browserName);
    if (browserName === 'firefox') {
      const firefox = await import('selenium-webdriver/firefox.js');
      const o = new firefox.Options().addArguments('-headless').windowSize({ width: 1280, height: 800 });
      if (env('BROWSER_BINARY')) o.setBinary(env('BROWSER_BINARY'));
      for (const [k, v] of Object.entries({ 'permissions.default.camera': 2, 'permissions.default.microphone': 2, 'permissions.default.geo': 2, 'permissions.default.desktop-notification': 2, 'geo.enabled': false, 'dom.webnotifications.enabled': false, 'media.navigator.permission.disabled': false, 'browser.download.folderList': 2, 'browser.download.dir': '/nonexistent', 'browser.helperApps.neverAsk.saveToDisk': '', 'pdfjs.disabled': false, 'datareporting.healthreport.uploadEnabled': false, 'toolkit.telemetry.enabled': false, 'app.update.auto': false, 'browser.safebrowsing.malware.enabled': false, 'network.http.speculative-parallel-limit': 0, 'network.prefetch-next': false, 'dom.serviceWorkers.enabled': false })) o.setPreference(k, v);
      b.setFirefoxOptions(o);
      if (env('GECKODRIVER_PATH')) b.setFirefoxService(new firefox.ServiceBuilder(env('GECKODRIVER_PATH')));
    } else { // chrome: only used to test this engine on machines that have chromedriver
      const chrome = await import('selenium-webdriver/chrome.js');
      const o = new chrome.Options().addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800');
      if (env('BROWSER_BINARY')) o.setChromeBinaryPath(env('BROWSER_BINARY'));
      b.setChromeOptions(o);
      if (env('CHROMEDRIVER_PATH')) b.setChromeService(new chrome.ServiceBuilder(env('CHROMEDRIVER_PATH')).addArguments('--disable-build-check'));
    }
    const d = await b.build();
    await d.manage().setTimeouts({ pageLoad: 30_000, script: 15_000, implicit: 0 });
    return d;
  }

  const slots = Array.from({ length: instances }, (_, i) => ({ i, driver: null, starting: null, busy: false }));
  const warm = (slot) => { slot.starting = launch().then((d) => { slot.driver = d; }).catch((e) => { console.error(`browser slot ${slot.i} failed to start:`, e.message); slot.driver = null; }).finally(() => { slot.starting = null; }); return slot.starting; };
  slots.forEach((s) => { void warm(s); });

  return {
    stats: () => ({ instances: slots.map((s) => ({ i: s.i, up: !!s.driver, sessions: s.busy ? 1 : 0 })), sessions: slots.filter((s) => s.busy).length, max: instances }),
    async open() {
      const slot = slots.find((s) => !s.busy);
      if (!slot) throw bad(`All ${instances} browsers are busy. Try again in a minute.`, 429);
      slot.busy = true;
      try { if (slot.starting) await slot.starting; if (!slot.driver) await warm(slot); if (!slot.driver) throw bad('The browser could not start on this machine. Check the service log.', 502); }
      catch (e) { slot.busy = false; throw e; }
      const d = slot.driver;
      const css = (n) => { const k = Number(n); if (!Number.isInteger(k) || k < 1) throw bad('ref must be a number from the last page reading'); return d.findElement(By.css(`[data-lmref="${k}"]`)); };
      const checkUrl = async () => { const u = await d.getCurrentUrl().catch(() => 'about:blank'); if (!(await urlAllowed(u))) { await d.get('about:blank').catch(() => {}); throw bad('That page is private or blocked', 403); } };
      const ready = async () => { for (let i = 0; i < 20; i++) { const st = await d.executeScript('return document.readyState').catch(() => 'loading'); if (st === 'complete' || st === 'interactive') break; await sleep(250); } await sleep(300); };
      const wrap = async (fn, msg) => { try { return await fn(); } catch (e) { if (e.statusCode) throw e; throw bad(`${msg}: ${String(e.message).split('\n')[0].slice(0, 140)}`, e.name === 'TimeoutError' ? 504 : 400); } };
      const h = {
        async goto(raw) { const u = normalizeUrl(raw); if (!(await urlAllowed(u.href))) throw bad('That address is private or blocked'); await wrap(() => d.get(u.href), 'Could not open the page'); await checkUrl(); },
        async snapshot() { await ready(); await checkUrl(); const s = await d.executeScript(`return (${SNAP.toString()})()`).catch((e) => { throw bad(`Could not read the page: ${String(e.message).slice(0, 120)}`, 502); }); return { ...s, tabs: (await d.getAllWindowHandles()).length }; },
        click: (r) => wrap(async () => { const el = await css(r); await d.executeScript('arguments[0].scrollIntoView({block:"center"})', el); await el.click(); await checkUrl(); }, 'Click failed. Read the page again; the layout may have changed'),
        hover: (r) => wrap(async () => d.actions().move({ origin: await css(r) }).perform(), 'Hover failed'),
        type: (r, text, { submit, clear }) => wrap(async () => {
          const el = await css(r); const kind = `${await el.getAttribute('type') || ''}|${await el.getAttribute('autocomplete') || ''}`;
          if (isSecretField(kind)) throw bad('Refusing to type into a password, card or one-time-code field. Ask the owner to do that step.', 403);
          if (clear !== false) await el.clear(); await el.sendKeys(String(text).slice(0, 5000)); if (submit) await el.sendKeys(Key.ENTER);
        }, 'Typing failed'),
        select: (r, v) => wrap(async () => { const ok = await d.executeScript('const s=arguments[0],v=arguments[1];const o=[...s.options].find(x=>x.value===v||x.text.trim()===v);if(!o)return false;s.value=o.value;s.dispatchEvent(new Event("input",{bubbles:true}));s.dispatchEvent(new Event("change",{bubbles:true}));return true', await css(r), String(v)); if (!ok) throw bad('No such option'); }, 'Select failed'),
        press: (k) => wrap(() => d.actions().sendKeys(KEYS[k] ?? String(k).slice(0, 30)).perform(), 'Key press failed'),
        async scroll(dir, amount) { await d.executeScript('window.scrollBy(0, arguments[0])', (dir === 'up' ? -1 : 1) * Math.min(5000, Number(amount) || 700)); await sleep(300); },
        back: () => wrap(async () => { await d.navigate().back(); await checkUrl(); }, 'Back failed'),
        wait: (s) => sleep(Math.min(10, Math.max(0.2, Number(s) || 1)) * 1000),
        async listTabs() { const cur = await d.getWindowHandle(); const out = []; let i = 0; for (const hd of await d.getAllWindowHandles()) { await d.switchTo().window(hd); out.push({ index: i++, url: await d.getCurrentUrl(), title: (await d.getTitle()).slice(0, 80), active: hd === cur }); } await d.switchTo().window(cur); return out; },
        async tab(action, index, url) {
          const hs = await d.getAllWindowHandles();
          if (action === 'new') { await d.switchTo().newWindow('tab'); if (url) await h.goto(url); }
          else if (action === 'switch') { const x = hs[Number(index)]; if (!x) throw bad('No such tab'); await d.switchTo().window(x); }
          else if (action === 'close') { if (hs.length <= 1) throw bad('This is the last tab'); const x = hs[Number(index ?? hs.indexOf(await d.getWindowHandle()))]; if (!x) throw bad('No such tab'); await d.switchTo().window(x); await d.close(); await d.switchTo().window((await d.getAllWindowHandles()).at(-1)); }
        },
        screenshot: () => d.takeScreenshot(),
        url: () => d.getCurrentUrl(),
        async destroy() { slot.driver = null; try { await d.quit(); } catch { /* already gone */ } slot.busy = false; void warm(slot); }, // fresh browser for the next user
      };
      return h;
    },
  };
}
