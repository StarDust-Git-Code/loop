#!/usr/bin/env node
// loopmates <command>
//   run      start the server and keep it running (restarts it after setup changes or a crash). Services use this.
//   setup    open the setup page in your browser (this computer only)
//   status   print what is ready and what is missing
//   update   git pull + npm ci, then restart the service
//   stop     stop the background service
//   logs     print the server log
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync, statSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { dataDir } = await import('../src/lib/paths.js');
const logFile = join(dataDir, 'server.log');
const WIN = process.platform === 'win32';
const cmd = process.argv[2] || 'run';
const port = () => { try { return JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8')).PORT || process.env.PORT || '8787'; } catch { return process.env.PORT || '8787'; } };
const key = () => { try { return readFileSync(join(dataDir, 'setup.key'), 'utf8').trim(); } catch { return ''; } };
const open = (url) => { const [c, a] = WIN ? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]; spawn(c, a, { stdio: 'ignore', detached: true, windowsHide: true }).unref(); };
const log = (line) => { try { if (existsSync(logFile) && statSync(logFile).size > 10 * 1024 * 1024) renameSync(logFile, `${logFile}.1`); appendFileSync(logFile, line); } catch { /* best effort */ } };

if (cmd === 'run') {
  let quickFails = 0;
  const start = () => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [join(root, 'src', 'server.js')], { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    for (const s of [child.stdout, child.stderr]) s.on('data', (d) => { process.stdout.write(d); log(d.toString()); });
    const stop = () => child.kill();
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    child.on('exit', (code, sig) => {
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
      if (sig === 'SIGINT' || sig === 'SIGTERM' || code === 0) process.exit(0);
      if (code === 75) return start(); // setup saved: restart right away
      quickFails = Date.now() - t0 < 15_000 ? quickFails + 1 : 0;
      const wait = Math.min(60_000, 2000 * 2 ** quickFails);
      console.error(`server exited (${code}); restarting in ${Math.round(wait / 1000)} s`);
      setTimeout(start, wait);
    });
  };
  start();
} else if (cmd === 'setup') {
  const url = `http://localhost:${port()}/setup?key=${key()}`;
  try { await fetch(`http://127.0.0.1:${port()}/healthz`, { signal: AbortSignal.timeout(3000) }); open(url); console.log(`Opened ${url.replace(/key=.*/, 'key=…')}`); }
  catch { console.error(`The Loopmates server is not running on port ${port()}. Start it with "loopmates run" (or start the service), then try again.`); process.exit(1); }
} else if (cmd === 'status') {
  try {
    const r = await fetch(`http://127.0.0.1:${port()}/setup/api/state`, { headers: { 'x-setup-key': key(), host: `localhost:${port()}` }, signal: AbortSignal.timeout(5000) });
    const s = await r.json();
    if (!s.configured) { console.log('Not set up yet. Run: loopmates setup'); process.exit(0); }
    for (const f of s.status.features) console.log(`${f.ready ? '✓' : '·'} ${f.label.padEnd(22)} ${f.note}${f.fix ? `\n  → ${f.fix}` : ''}`);
  } catch { console.error(`The server is not running on port ${port()}.`); process.exit(1); }
} else if (cmd === 'update') {
  const run = (c, a) => { console.log(`> ${c} ${a.join(' ')}`); const r = spawnSync(c, a, { cwd: root, stdio: 'inherit', shell: WIN }); if (r.status !== 0) process.exit(r.status ?? 1); };
  run('git', ['pull', '--ff-only']);
  run('npm', ['ci', '--omit=dev']);
  console.log(`Now at ${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim()}. Restarting…`);
  if (WIN) spawnSync('schtasks', ['/End', '/TN', 'Loopmates'], { stdio: 'ignore' }), spawnSync('schtasks', ['/Run', '/TN', 'Loopmates'], { stdio: 'inherit' });
  else spawnSync('systemctl', ['--user', 'restart', 'loopmates'], { stdio: 'inherit' });
} else if (cmd === 'stop') {
  if (WIN) spawnSync('schtasks', ['/End', '/TN', 'Loopmates'], { stdio: 'inherit' });
  else spawnSync('systemctl', ['--user', 'stop', 'loopmates'], { stdio: 'inherit' });
} else if (cmd === 'logs') {
  try { process.stdout.write(readFileSync(logFile, 'utf8').split('\n').slice(-200).join('\n')); } catch { console.log('No log yet.'); }
} else {
  console.log('Usage: loopmates run | setup | status | update | stop | logs');
  process.exit(cmd === 'help' || cmd === '--help' ? 0 : 1);
}
