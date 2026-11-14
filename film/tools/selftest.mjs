// Run Motion.selfTest on a film page: node tools/selftest.mjs v2.html
// Opens <page>?selftest in headless Chrome (the page wires window.__ready to Motion.selfTest) and prints window.__seekcheck.
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
const SK = process.env.SK || path.join(os.homedir(), '.claude/skills/motionmaxxing');
const { launchChrome } = await import(pathToFileURL(path.join(SK, 'scripts/_cdp.mjs')).href);
const url = pathToFileURL(path.resolve(process.argv[2])).href + '?selftest';
const browser = await launchChrome({ args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage({ width: 1920, height: 1080, scale: 0.25 });
  await page.goto(url, { timeout: 60000 });
  const t0 = Date.now();
  for (;;) {
    const r = await page.eval('window.__seekcheck ? JSON.stringify({ ok: window.__seekcheck.ok, samples: window.__seekcheck.samples, elements: window.__seekcheck.elements, mismatches: (window.__seekcheck.mismatches || []).slice(0, 8) }) : null', { timeout: 30000 });
    if (r) { console.log(r); break; }
    if (Date.now() - t0 > 1500000) { console.log('timed out waiting for __seekcheck'); break; }
    await new Promise((res) => setTimeout(res, 3000));
  }
} finally { await browser.close(); }
