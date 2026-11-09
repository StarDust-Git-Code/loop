// First-run setup and status page, served by the server itself at http://localhost:<port>/setup.
// Only answers requests made on this computer (loopback address, localhost Host header, no tunnel/proxy headers)
// and only with the setup key from <data>/setup.key (the Start menu shortcut and `loopmates setup` open it with the key).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../lib/env.js';
import { dataDir } from '../lib/paths.js';
import { saveConfig, publicConfig, configFile } from '../lib/config.js';
import { startTunnel, stopTunnel, tunnelStatus, installCloudflared } from '../lib/tunnel.js';

const here = dirname(fileURLToPath(import.meta.url));
const keyFile = join(dataDir, 'setup.key');
export const setupKey = (() => { if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(18).toString('base64url'), { mode: 0o600 }); return readFileSync(keyFile, 'utf8').trim(); })();
export const setupUrl = () => `http://localhost:${env('PORT', '8787')}/setup?key=${setupKey}`;

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const isLocal = (req) => LOOPBACK.has(req.socket.remoteAddress) && !req.headers['cf-connecting-ip'] && !req.headers['x-forwarded-for'] && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '');
const CORE = new Set(['FIREBASE_SERVICE_ACCOUNT_B64', 'ALLOWED_EMAILS', 'PORT']); // these need a restart
const bad = (m, statusCode = 400) => Object.assign(new Error(m), { statusCode });

let browserJob = { running: false, lines: [], code: null };

/**
 * deps (only when Firebase is configured): { serverStatus, newPairingCode, unpair, pairingState, driveAuthStart, driveOps, applyChanges }
 */
export async function mountSetup(app, { configured, deps = {}, problem = '' }) {
  const page = readFileSync(join(here, 'page.html'), 'utf8');
  const html = (req, reply) => {
    if (!isLocal(req)) return reply.code(404).send();
    if (req.query?.key !== setupKey) return reply.type('text/html').send('<!doctype html><meta charset="utf-8"><title>Loopmates setup</title><body style="font-family:system-ui;max-width:560px;margin:15vh auto;padding:0 16px;color:#0F172A"><h1 style="font-size:22px">Open setup with your key</h1><p style="color:#5B6474">Use the “Loopmates setup” shortcut, or run <code>loopmates setup</code> on this computer. It opens this page with the right key.</p></body>');
    return reply.type('text/html').header('cache-control', 'no-store').header('x-frame-options', 'DENY').send(page.replace('__SETUP_KEY__', setupKey));
  };
  app.get('/setup', html);
  app.get('/setup/status', html);

  await app.register(async (s) => {
    s.addHook('onRequest', async (req, reply) => {
      if (!isLocal(req)) return reply.code(404).send();
      if (req.headers['x-setup-key'] !== setupKey) return reply.code(401).send({ error: 'Setup key missing. Reopen setup from the shortcut.' });
    });

    s.get('/setup/api/state', async () => ({
      configured, problem, dataDir, configFile, url: setupUrl().replace(/\?.*$/, ''),
      config: publicConfig(), tunnel: tunnelStatus(), browser: browserJob,
      ...(configured ? { status: await deps.serverStatus(), pairing: deps.pairingState() } : { status: null, pairing: null }),
    }));

    s.post('/setup/api/config', async (req) => {
      const patch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([, v]) => typeof v === 'string' && !/^••••/.test(v)));
      await saveConfig(patch);
      const keys = Object.keys(patch);
      if (configured && deps.applyChanges) await deps.applyChanges(keys, req.log);
      const restart = !configured ? !!env('FIREBASE_SERVICE_ACCOUNT_B64') : keys.some((k) => CORE.has(k));
      if (restart) setTimeout(() => process.exit(75), 400); // the supervisor (bin/loopmates.js) starts it again
      return { ok: true, restart };
    });

    s.post('/setup/api/firebase', async (req) => {
      let sa; try { sa = typeof req.body?.json === 'string' ? JSON.parse(req.body.json) : req.body?.json; } catch { throw bad('That is not valid JSON. Paste the whole service-account file.'); }
      if (!sa?.project_id || !sa?.private_key || !sa?.client_email) throw bad('This JSON is not a service-account key (project_id, client_email, private_key are missing).');
      await saveConfig({ FIREBASE_SERVICE_ACCOUNT_B64: Buffer.from(JSON.stringify(sa)).toString('base64') });
      setTimeout(() => process.exit(75), 400);
      return { ok: true, project: sa.project_id, restart: true };
    });

    s.post('/setup/api/tunnel', async (req) => {
      const { mode = 'quick', token, url } = req.body ?? {};
      if (!['quick', 'named', 'off'].includes(mode)) throw bad('mode must be quick, named or off');
      await saveConfig({ TUNNEL_MODE: mode, ...(typeof token === 'string' && token && !/^••••/.test(token) ? { TUNNEL_TOKEN: token } : {}), ...(mode === 'named' && url ? { PUBLIC_URL: String(url).replace(/\/$/, '') } : {}), ...(mode === 'quick' ? { PUBLIC_URL: '' } : {}) });
      if (mode === 'off') stopTunnel(); else void startTunnel(req.log);
      return tunnelStatus();
    });
    s.post('/setup/api/tunnel/install', async () => ({ path: await installCloudflared() }));

    s.post('/setup/api/browser/install', async () => {
      if (browserJob.running) return browserJob;
      const cli = join(dirname(createRequire(import.meta.url).resolve('playwright-core/package.json')), 'cli.js');
      browserJob = { running: true, lines: ['Downloading Chromium (about 150 MB)…'], code: null };
      const c = spawn(process.execPath, [cli, 'install', 'chromium'], { windowsHide: true });
      const add = (d) => { for (const l of d.toString().split(/\r?\n|\r/).map((x) => x.trim()).filter(Boolean)) { browserJob.lines.push(l.slice(0, 200)); if (browserJob.lines.length > 40) browserJob.lines.shift(); } };
      c.stdout.on('data', add); c.stderr.on('data', add);
      c.on('close', (code) => { browserJob.running = false; browserJob.code = code; browserJob.lines.push(code === 0 ? 'Chromium is installed.' : `Install failed (exit ${code}).`); });
      return browserJob;
    });

    if (configured) {
      s.post('/setup/api/pair', async () => deps.newPairingCode());
      s.post('/setup/api/unpair', async () => { await deps.unpair(); return deps.pairingState(); });
      s.post('/setup/api/drive/start', async () => deps.driveAuthStart(`http://localhost:${env('PORT', '8787')}`));
      s.get('/setup/api/drive/folders', async (req) => deps.driveOps.folders({ parent: String(req.query?.parent ?? '') }));
      s.post('/setup/api/drive/folder', async (req) => { await saveConfig({ DRIVE_ROOT_FOLDER_ID: String(req.body?.id ?? '') }); await deps.applyChanges(['DRIVE_ROOT_FOLDER_ID']); return { ok: true }; });
    }
  });
}
