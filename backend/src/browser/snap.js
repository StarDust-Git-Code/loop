// Runs INSIDE the page: returns visible text plus numbered interactive elements (tagged data-lmref). Must be self-contained.
export const SNAP = () => {
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
