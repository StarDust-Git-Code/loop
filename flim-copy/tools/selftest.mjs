// Seek-safety check: plays the film in order, then jumps to random frames, and compares every element.
// Usage: node tools/selftest.mjs [index.html]      (needs CHROME_PATH and SK from tools/env.sh)
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sk = process.env.SK;
if (!sk) { console.error('source tools/env.sh first'); process.exit(2); }
const { launchChrome } = await import(pathToFileURL(path.join(sk.replace(/^\/c\//, 'C:/'), 'scripts', '_cdp.mjs')).href);

const file = path.resolve(process.argv[2] || 'index.html');
const br = await launchChrome({ args: ['--allow-file-access-from-files'] });
try {
  const page = await br.newPage({ width: 1920, height: 1080 });
  const errors = [];
  page.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text));
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error' || p.type === 'warning') errors.push(p.type + ': ' + (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ')); });
  await page.goto(pathToFileURL(file).href + '?selftest', { timeout: 45000 });
  const res = await page.eval('Promise.resolve(window.__ready).then(() => JSON.stringify(window.__seekcheck || null))', { timeout: 240000 });
  const r = JSON.parse(res);
  if (!r) console.log('no result');
  else console.log(`selfTest ${r.ok ? 'PASS' : 'FAIL'}  samples=${r.samples}  elements=${r.elements}  mismatches=${r.mismatches.length}`);
  if (r && r.mismatches.length) console.log(r.mismatches.slice(0, 6));
  if (errors.length) console.log('page messages:\n  ' + [...new Set(errors)].slice(0, 12).join('\n  '));
  process.exitCode = r && r.ok ? 0 : 1;
} finally { await br.close(); }
