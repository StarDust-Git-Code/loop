// Owner routes for running the server from the dashboard: pairing, status, a safe subset of the server settings,
// and the Google Drive sign-in + folder picker. Everything except /v1/pair is limited to the paired owner.
import { randomBytes } from 'node:crypto';
import { env, now } from '../lib/env.js';
import { saveConfig, publicConfig } from '../lib/config.js';
import { tunnelStatus, startTunnel } from '../lib/tunnel.js';
import { commit } from '../lib/server.js';
import { driveReady, authUrl, exchangeCode, grantedScopes, ops as driveOps, resetFolder } from '../drive/index.js';
import { INTEGRATION_KEYS, integrationFeatures, restartIntegrations } from '../integrations/index.js';
import { browserStatus } from '../browser/index.js';
import { systemBrowser } from '../browser/engine-playwright.js';
import { sandboxInfo } from '../coder/index.js';
import { HARNESS_NAMES, detectHarnesses } from '../coder/harness.js';
import { getSettings } from './settings.js';
import { testHarness } from './engine.js';
import { voiceStatus } from '../voice/index.js';
import { telegramReady, pollingStatus, startPolling, stopPolling } from './telegram.js';
import { discordReady, gatewayStatus, startGateway, stopGateway, registerCommands } from './discord.js';
import { githubTokenFor } from './github.js';
import { pair, pairingState, publish, publicUrl } from './pairing.js';
import { pushReady } from './push.js';

const bad = (m, statusCode = 400) => Object.assign(new Error(m), { statusCode });
/** Settings the owner may change from the dashboard. Firebase, the allow-list and the port stay on the setup page. */
const REMOTE_KEYS = new Set(['TELEGRAM_BOT_TOKEN', 'DISCORD_APP_ID', 'DISCORD_PUBLIC_KEY', 'DISCORD_BOT_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DRIVE_ROOT_FOLDER_ID', 'GITHUB_REPOS', 'DEFAULT_REPO', 'GEMINI_API_KEY', 'NVIDIA_API_KEY', 'GROQ_API_KEY', 'CEREBRAS_API_KEY', 'OPENROUTER_API_KEY', 'BRAVE_API_KEY', 'GOOGLE_SCOPES', ...INTEGRATION_KEYS]);
const MODEL_KEYS = ['GEMINI_API_KEY', 'NVIDIA_API_KEY', 'GROQ_API_KEY', 'CEREBRAS_API_KEY', 'OPENROUTER_API_KEY'];

/** Every feature, whether it is ready, and the one step that is missing. Same list for the setup page and the dashboard. */
export async function serverStatus(deps = {}, uid = '') {
  const t = tunnelStatus(); const b = browserStatus(); const sb = await sandboxInfo(); const v = voiceStatus();
  const hz = await detectHarnesses().catch(() => ({})); const settingsHarness = (await getSettings(uid || env('OWNER_UID') || 'none').catch(() => ({}))).coderHarness || 'builtin';
  const owner = env('OWNER_UID');
  const gh = owner ? await githubTokenFor(owner).catch(() => '') : env('GITHUB_TOKEN');
  const item = (key, label, ready, note, fix = '') => ({ key, label, ready: !!ready, note, fix: ready ? '' : fix });
  return {
    commit, url: publicUrl(), uptime: Math.round(process.uptime()), at: now(), pairing: pairingState(),
    features: [
      item('firebase', 'Database (Firebase)', true, 'Connected'),
      item('owner', 'Paired dashboard', !!owner, owner ? 'Paired' : 'Not paired', 'Open the setup page, make a pairing code, enter it in the dashboard.'),
      item('tunnel', 'Public address', t.status === 'online' || (t.mode === 'off' && env('PUBLIC_URL')), t.url || env('PUBLIC_URL') || t.error || t.status, 'Setup page → Public address → Quick tunnel.'),
      item('models', 'AI models', MODEL_KEYS.some((k) => env(k)) || deps.hasProviders, MODEL_KEYS.filter((k) => env(k)).map((k) => k.replace('_API_KEY', '').toLowerCase()).join(', ') || (deps.hasProviders ? 'Providers in Settings' : 'None'), 'Add a Gemini key (free) on the setup page, or a provider in Settings.'),
      item('voice', 'Voice calls', v.ready, v.ready ? `${v.active}/${v.max} calls live` : 'No Gemini key', 'Add GEMINI_API_KEY.'),
      item('telegram', 'Telegram', telegramReady() && pollingStatus() === 'polling', telegramReady() ? pollingStatus() : 'No bot token', 'Connections → Telegram → paste the bot token.'),
      item('discord', 'Discord', discordReady() && gatewayStatus() === 'connected', discordReady() ? gatewayStatus() : 'Not set up', 'Connections → Discord → app ID, public key, bot token.'),
      item('drive', 'Google Drive', driveReady() && env('DRIVE_ROOT_FOLDER_ID'), driveReady() ? (env('DRIVE_ROOT_FOLDER_ID') ? 'Connected, folder chosen' : 'Connected, no folder chosen (a "Loopmates" folder is used)') : 'Not connected', 'Connections → Google Drive.'),
      item('github', 'GitHub', !!gh, gh ? `Token set${env('GITHUB_REPOS') ? `, repos: ${env('GITHUB_REPOS')}` : ''}` : 'No token', 'Connections → GitHub → paste a fine-grained token.'),
      item('browser', 'Browser', b.status === 'ready' || !!systemBrowser() || b.engine === 'webdriver', b.status === 'idle' ? (systemBrowser() ? `Will use ${systemBrowser().split(/[\\/]/).pop()}` : 'No Chromium found') : `${b.status}${b.note ? `: ${b.note}` : ''}`, 'Setup page → Install browser, or install Chrome/Chromium.'),
      item('harness', 'Coding harness', hz[settingsHarness]?.ok !== false, `${HARNESS_NAMES[settingsHarness] ?? 'Built-in coder'}${hz[settingsHarness]?.version ? ` (${hz[settingsHarness].version})` : ''}. Installed: ${['claude', 'codex', 'opencode'].filter((k) => hz[k]?.ok).map((k) => HARNESS_NAMES[k]).join(', ') || 'none'}`, 'Dashboard → Connections → Coding harness.'),
      item('sandbox', 'Coding sandbox', sb.kind === 'docker', sb.kind === 'docker' ? `Docker (${sb.image})` : sb.warning, 'Install Docker Desktop (Windows) or docker.io (Linux) for isolated code runs.'),
      item('push', 'App notifications', pushReady(), pushReady() ? 'Web push ready' : 'Starting', ''),
      ...integrationFeatures().map((f) => item(f.key, f.label, f.ready, f.note, f.fix)),
    ],
  };
}

const oauth = new Map(); // state -> { redirectUri, exp }
/** Start a Google sign-in for Drive. `base` is where Google sends the browser back (localhost or the public URL). */
export function driveAuthStart(base) {
  if (!env('GOOGLE_CLIENT_ID') || !env('GOOGLE_CLIENT_SECRET')) throw bad('Save the OAuth client ID and secret first.');
  const redirectUri = `${base}/drive/oauth/callback`;
  const state = randomBytes(16).toString('hex');
  oauth.set(state, { redirectUri, exp: Date.now() + 10 * 60_000 });
  return { url: authUrl(redirectUri, state), redirectUri };
}

export function mountAdmin(app, v1, { requireOwner }) {
  v1.post('/v1/pair', async (req) => pair(req.user, req.body?.code));

  v1.get('/v1/server/status', { preHandler: requireOwner }, async (req) => serverStatus({}, req.user.uid));
  v1.get('/v1/coder/harnesses', { preHandler: requireOwner }, async (req) => detectHarnesses({ fresh: req.query?.fresh === '1' }));
  v1.post('/v1/coder/test', { preHandler: requireOwner }, async (req, reply) => {
    const h = String(req.body?.harness ?? ''); if (!HARNESS_NAMES[h]) return reply.code(400).send({ error: 'Pick builtin, claude, codex or opencode.' });
    return testHarness(req.user.uid, h, ['auto', 'docker', 'host'].includes(req.body?.sandbox) ? req.body.sandbox : 'auto');
  });
  v1.get('/v1/server/config', { preHandler: requireOwner }, async () => publicConfig().filter((f) => REMOTE_KEYS.has(f.key)));
  v1.patch('/v1/server/config', { preHandler: requireOwner }, async (req) => {
    const patch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k, v]) => REMOTE_KEYS.has(k) && typeof v === 'string' && !/^••••/.test(v)));
    if (!Object.keys(patch).length) throw bad('Nothing to save.');
    await saveConfig(patch);
    await applyChanges(Object.keys(patch), req.log);
    return publicConfig().filter((f) => REMOTE_KEYS.has(f.key));
  });

  /* Google Drive: the owner's own OAuth client, then a folder pick. */
  v1.get('/v1/drive/oauth/start', { preHandler: requireOwner }, async (req) => driveAuthStart(req.query?.local === '1' ? `http://localhost:${env('PORT', '8787')}` : publicUrl()));
  v1.get('/v1/drive/folders', { preHandler: requireOwner }, async (req) => driveOps.folders({ parent: String(req.query?.parent ?? '') }));
  v1.post('/v1/drive/folder', { preHandler: requireOwner }, async (req) => {
    const id = String(req.body?.id ?? '').trim(); if (!id) throw bad('Pick a folder.');
    await saveConfig({ DRIVE_ROOT_FOLDER_ID: id }); resetFolder();
    return { ok: true, id, name: String(req.body?.name ?? '') };
  });

  // Google sends the browser back here after sign-in. The state proves the owner started it.
  app.get('/drive/oauth/callback', async (req, reply) => {
    const s = oauth.get(String(req.query?.state ?? '')); oauth.delete(String(req.query?.state ?? ''));
    const page = (title, text) => reply.type('text/html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui;max-width:520px;margin:15vh auto;padding:0 16px;color:#0F172A"><h1 style="font-size:22px">${title}</h1><p style="color:#5B6474">${text}</p></body>`);
    if (!s || s.exp < Date.now()) return page('That sign-in expired', 'Start again from Connections → Google Drive.');
    if (req.query?.error) return page('Google sign-in was cancelled', String(req.query.error).replace(/[<>&"]/g, ''));
    try {
      const rt = await exchangeCode(String(req.query?.code ?? ''), s.redirectUri);
      await saveConfig({ GOOGLE_REFRESH_TOKEN: rt, GOOGLE_GRANTED_SCOPES: grantedScopes() }); resetFolder();
      return page('Google is connected', 'Drive, plus Calendar and Gmail if you allowed them. Go back to Loopmates and pick the folder your agents may use. You can close this tab.');
    } catch (e) { return page('Could not connect Google Drive', String(e.message).replace(/[<>&"]/g, '')); }
  });
}

/** Restart whatever a changed setting affects. */
export async function applyChanges(keys, log) {
  const has = (...k) => k.some((x) => keys.includes(x));
  if (has('TELEGRAM_BOT_TOKEN')) { stopPolling(); if (telegramReady()) startPolling(log); }
  if (has('DISCORD_APP_ID', 'DISCORD_PUBLIC_KEY', 'DISCORD_BOT_TOKEN')) {
    stopGateway();
    if (discordReady()) { registerCommands().catch(() => {}); const { startRun, liveRuns } = await import('./engine.js'); const { answerFromDiscord } = await import('./ask.js'); startGateway({ startRun, liveRuns, onComponent: answerFromDiscord, log }); }
  }
  if (has('DRIVE_ROOT_FOLDER_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN')) resetFolder();
  if (has('TUNNEL_MODE', 'TUNNEL_TOKEN', 'PUBLIC_URL')) await startTunnel(log);
  if (has('PUBLIC_URL')) await publish().catch(() => {});
  await restartIntegrations(keys, log);
}
