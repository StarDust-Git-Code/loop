// Browser tools for Mates. They drive the browser service on the owner's Linux VM (BROWSER_URL).
// One browser session per chat/run; it closes itself after a few idle minutes.
import { env } from '../lib/env.js';
import { svcFetch } from '../lib/svc.js';
import { putFile } from './files.js';

const bad = (m) => Object.assign(new Error(m), { tool: true });
const sessions = new Map(); // "uid:scope" -> session id

const base = () => { const u = env('BROWSER_URL'); if (!u) throw bad('The browser is not set up yet (BROWSER_URL is missing on the API service). Use web_search or fetch_url instead.'); return u; };
const scope = (c) => `${c.uid}:${c.runId || c.convId || c.mate || 'x'}`;

async function call(c, path, body, { method = 'POST', timeoutMs = 60_000 } = {}) {
  let res;
  try { res = await svcFetch(base(), path, { method, body: { ...body, uid: c.uid }, timeoutMs }); }
  catch (e) { throw bad(`The browser machine is unreachable (${String(e.message).slice(0, 80)}).`); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const err = bad(j.error || `Browser service answered ${res.status}`); err.status = res.status; throw err; }
  return j;
}
async function session(c, { create = true } = {}) {
  const k = scope(c); let id = sessions.get(k);
  if (id) return id;
  if (!create) throw bad('No page is open. Call browser_open with a URL first.');
  id = (await call(c, '/v1/sessions', {})).id; sessions.set(k, id); return id;
}
async function act(c, action, body = {}) {
  const k = scope(c);
  try { return await call(c, `/v1/sessions/${await session(c, { create: action === 'goto' })}/${action}`, body); }
  catch (e) { if (e.status === 404) { sessions.delete(k); throw bad('The browser session expired. Call browser_open again.'); } throw e; }
}

const fmt = (s) => {
  const els = (s.elements ?? []).map((e) => `[${e.ref}] ${e.tag}${e.type ? `(${e.type})` : ''}${e.text ? ` "${e.text}"` : ''}${e.href ? ` -> ${e.href}` : ''}${e.value ? ` value="${e.value}"` : ''}${e.checked ? ' checked' : ''}${e.disabled ? ' disabled' : ''}`);
  return `Page: ${s.title || '(untitled)'} | ${s.url} | tab${s.tabs > 1 ? `s ${s.tabs}` : ' 1'} | scroll ${s.scroll?.y}/${s.scroll?.max}\n--- text ---\n${s.text || '(no visible text)'}\n--- interactive elements (use the number as ref) ---\n${els.join('\n') || '(none)'}`.slice(0, 9000);
};
const B = (desc, args, run, more = {}) => ({ group: 'Browser', net: true, desc, args, run, ...more });

export const BROWSER_TOOLS = {
  browser_open: B('Open a web page in a real browser (JavaScript runs, so it works on modern sites). Returns the page text and a numbered list of clickable/typeable elements. Prefer web_search for simple lookups; use the browser when you must read a specific page, click through, or fill a form.', '{"url": "https://..."}',
    async (c, a) => fmt(await act(c, 'goto', { url: String(a.url ?? '') }))),
  browser_read: B('Read the current page again (text plus numbered elements). Use after waiting or when the page changed by itself.', '{}', async (c) => fmt(await act(c, 'snapshot'))),
  browser_click: B('Click an element by its number from the last page reading. Returns the new page state.', '{"ref": 12}', async (c, a) => fmt(await act(c, 'click', { ref: a.ref })), { write: true }),
  browser_type: B('Type text into an input by its number. Set submit=true to press Enter afterwards. Refuses password, card and one-time-code fields: ask the owner to do those themselves.', '{"ref": 3, "text": "what to type", "submit?": true}', async (c, a) => fmt(await act(c, 'type', { ref: a.ref, text: String(a.text ?? ''), submit: !!a.submit })), { write: true }),
  browser_select: B('Choose an option in a dropdown by its number.', '{"ref": 5, "value": "option value or label"}', async (c, a) => fmt(await act(c, 'select', { ref: a.ref, value: String(a.value ?? '') })), { write: true }),
  browser_press: B('Press a key (Enter, Tab, Escape, ArrowDown, PageDown...).', '{"key": "Enter"}', async (c, a) => fmt(await act(c, 'press', { key: String(a.key ?? 'Enter') })), { write: true }),
  browser_scroll: B('Scroll the page down (default) or up to reveal more content.', '{"direction?": "down|up", "amount?": 700}', async (c, a) => fmt(await act(c, 'scroll', { direction: a.direction, amount: a.amount }))),
  browser_back: B('Go back to the previous page.', '{}', async (c) => fmt(await act(c, 'back'))),
  browser_wait: B('Wait a few seconds for a slow page, then read it.', '{"seconds?": 2}', async (c, a) => fmt(await act(c, 'wait', { seconds: a.seconds }))),
  browser_tabs: B('List, open, switch or close tabs.', '{"action": "list|new|switch|close", "index?": 0, "url?": "https://..."}', async (c, a) => {
    const r = await act(c, 'tabs', { action: a.action || 'list', index: a.index, url: a.url });
    return r.tabs ? r.tabs.map((t) => `${t.active ? '*' : ' '} ${t.index}: ${t.title} (${t.url})`).join('\n') : fmt(r);
  }),
  browser_screenshot: B('Take a screenshot of the current page and save it to the owner\'s Files.', '{"fullPage?": false}', async (c, a) => {
    const r = await act(c, 'screenshot', { fullPage: !!a.fullPage });
    const f = await putFile(c.uid, { name: `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`, mime: 'image/png', buf: Buffer.from(r.png, 'base64'), source: 'browser', runId: c.runId });
    return `Saved ${f.name} to Files (${Math.round(f.size / 1024)} KB) from ${r.url}. You cannot see images; use browser_read for the page's text.`;
  }),
  browser_close: B('Close the browser session when you are done (it also closes itself after a few idle minutes).', '{}', async (c) => {
    const k = scope(c); const id = sessions.get(k); if (!id) return 'Nothing to close.';
    sessions.delete(k); await call(c, `/v1/sessions/${id}`, {}, { method: 'DELETE' }).catch(() => {}); return 'Browser closed.';
  }),
};
