// Public HTTPS address through Cloudflare Tunnel (free). The browser on Vercel and the phone reach the server through it.
//   quick  `cloudflared tunnel --url http://127.0.0.1:PORT` -> a random https://*.trycloudflare.com (new on every restart)
//   named  `cloudflared tunnel run --token TOKEN` -> your own hostname (PUBLIC_URL), stable
// cloudflared is found on PATH or downloaded into <data>/bin on first use (Windows and Linux, x64 and arm64).
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, chmodSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from './env.js';
import { dir } from './paths.js';

const WIN = process.platform === 'win32';
const listeners = new Set();
let state = { mode: 'off', status: 'off', url: '', error: '' };
let child = null;

/** Called with the new public URL whenever it changes (to tell the paired dashboard). */
export const onPublicUrl = (fn) => listeners.add(fn);
export const tunnelStatus = () => ({ ...state, binary: binary() || null });
const set = (patch) => { state = { ...state, ...patch }; };

function binary() {
  const local = join(dir('bin'), WIN ? 'cloudflared.exe' : 'cloudflared');
  if (existsSync(local)) return local;
  try { execFileSync(WIN ? 'where' : 'which', ['cloudflared'], { stdio: 'ignore', timeout: 5000 }); return 'cloudflared'; } catch { return ''; }
}

/** Download cloudflared from Cloudflare's GitHub releases. */
export async function installCloudflared() {
  if (binary()) return binary();
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'amd64' : '';
  if (!arch || !['win32', 'linux'].includes(process.platform)) throw new Error(`Download cloudflared yourself for ${process.platform}/${process.arch} (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and put it on PATH.`);
  const name = WIN ? `cloudflared-windows-${arch}.exe` : `cloudflared-linux-${arch}`;
  const res = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/${name}`, { redirect: 'follow', signal: AbortSignal.timeout(180_000) });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const dest = join(dir('bin'), WIN ? 'cloudflared.exe' : 'cloudflared');
  await pipeline(Readable.fromWeb(res.body), createWriteStream(`${dest}.part`));
  await rename(`${dest}.part`, dest);
  if (!WIN) chmodSync(dest, 0o755);
  return dest;
}

export function stopTunnel() { if (child) { child.kill(); child = null; } set({ status: 'off', ...(env('TUNNEL_MODE') === 'quick' ? { url: '' } : {}) }); }

/** Start the tunnel TUNNEL_MODE asks for. Restarts it if it exits. */
export async function startTunnel(log) {
  stopTunnel();
  const mode = env('TUNNEL_MODE', 'off');
  set({ mode, error: '', url: mode === 'named' ? env('PUBLIC_URL') : '' });
  if (mode !== 'quick' && mode !== 'named') { if (env('PUBLIC_URL')) for (const f of listeners) f(env('PUBLIC_URL')); return; }
  if (mode === 'named' && !env('TUNNEL_TOKEN')) { set({ status: 'error', error: 'Named tunnel needs TUNNEL_TOKEN.' }); return; }
  let bin = binary();
  if (!bin) { set({ status: 'installing' }); try { bin = await installCloudflared(); } catch (e) { set({ status: 'error', error: e.message }); return; } }
  const args = mode === 'quick'
    ? ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${env('PORT', '8787')}`]
    : ['tunnel', '--no-autoupdate', 'run', '--token', env('TUNNEL_TOKEN')];
  set({ status: 'starting' });
  const c = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child = c;
  const scan = (d) => {
    const text = d.toString();
    const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(text);
    if (m && mode === 'quick' && m[0] !== state.url) { set({ url: m[0], status: 'online' }); process.env.PUBLIC_URL = m[0]; log?.info?.(`tunnel: ${m[0]}`); for (const f of listeners) f(m[0]); }
    if (mode === 'named' && /Registered tunnel connection/i.test(text) && state.status !== 'online') { set({ status: 'online' }); for (const f of listeners) f(env('PUBLIC_URL')); }
  };
  c.stdout.on('data', scan); c.stderr.on('data', scan);
  c.on('exit', (code) => {
    if (child !== c) return; // stopped on purpose
    child = null; set({ status: 'error', error: `cloudflared exited (${code}). Restarting in 10 s.` });
    setTimeout(() => { if (!child && env('TUNNEL_MODE') === mode) void startTunnel(log); }, 10_000).unref();
  });
}
