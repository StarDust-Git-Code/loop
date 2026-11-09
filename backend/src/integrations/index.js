// Every optional integration in one registry. Each one declares:
//   key, name, badge/bg/fg (dashboard tile), group (the tool group agents get), what (one paragraph),
//   fields (server settings it needs), steps (the setup guide, shown in Connections), ready(), note(),
//   test(uid) → a sentence, tools (only offered to agents while ready() is true), and optional extras:
//   linkCode (chat apps), oauth (sign-in), webhook, manifest, ingest (health), actions.
// The dashboard renders all of them from GET /v1/integrations, so the steps live in one place.
import { randomBytes } from 'node:crypto';
import { env, now } from '../lib/env.js';
import { db } from '../api/db.js';
import { obsidian, vaultLinks, obsidianReady } from './obsidian.js';
import { google } from './google.js';
import { notion, todoist, linear } from './workapps.js';
import { spotify, spotifyAuthUrl, spotifyExchange } from './spotify.js';
import { feeds, bindFeedFetch } from './feeds.js';
import { home } from './home.js';
import { health, saveDays, parseHealthCsv, newIngestKey, uidForIngestKey } from './health.js';
import { slack, startSlack, stopSlack, slackReady, notifySlack } from './slack.js';
import { wacloud, verifyMeta, verifyHandshake, handleWaWebhook, notifyWhatsApp } from './whatsappcloud.js';

export const INTEGRATIONS = [obsidian, notion, google, slack, wacloud, todoist, linear, spotify, feeds, health, home];
const BY = Object.fromEntries(INTEGRATIONS.map((i) => [i.key, i]));
/** Server settings the dashboard may change for integrations (added to admin.js REMOTE_KEYS). */
export const INTEGRATION_KEYS = [...new Set(INTEGRATIONS.flatMap((i) => i.fields.map((f) => f.key)).filter((k) => k !== 'GOOGLE_SCOPES')), 'SPOTIFY_REFRESH_TOKEN'];
/** Every integration tool (tools.js merges these; toolsFor() hides the ones whose integration is not ready). */
export const INTEGRATION_TOOLS = Object.assign({}, ...INTEGRATIONS.map((i) => i.tools));
export { bindFeedFetch, notifySlack, notifyWhatsApp };

/** Rows for the Server status page and connections_status. Integrations nobody started are listed as optional. */
export function integrationFeatures() {
  return INTEGRATIONS.filter((i) => i.fields.length || i.key === 'google').map((i) => {
    let ready = false; try { ready = !!i.ready(); } catch { /* treat as not ready */ }
    return { key: i.key, label: i.name, ready, note: i.note(), fix: `Optional: Connections → ${i.name}.` };
  });
}

/** Restart background connections after their settings changed. */
export async function restartIntegrations(keys, log) {
  if (keys.some((k) => k.startsWith('SLACK_'))) { stopSlack(); startSlack(log); }
}
export function bootIntegrations(log) { if (slackReady()) startSlack(log); }

const site = () => env('PUBLIC_URL').replace(/\/$/, '');
const describe = (i, local) => ({
  key: i.key, name: i.name, badge: i.badge, bg: i.bg, fg: i.fg, group: i.group, what: i.what, fields: i.fields, steps: i.steps,
  ready: (() => { try { return !!i.ready(); } catch { return false; } })(), note: i.note(),
  ...(i.manifest ? { manifest: JSON.stringify(i.manifest, null, 2) } : {}),
  ...(i.webhook ? { webhookUrl: site() ? `${site()}${i.webhook}` : '' } : {}),
  ...(i.oauth ? { oauth: { label: i.oauth.label, redirect: `${local}${i.oauth.callback}`, publicRedirect: site() ? `${site()}${i.oauth.callback}` : '' } } : {}),
  ...(i.linkCode ? { linkCode: true } : {}), ...(i.ingest ? { ingestUrl: site() ? `${site()}/health/ingest` : '' } : {}),
  ...(i.actions ? { actions: Object.entries(i.actions).map(([id, a]) => ({ id, label: a.label })) } : {}),
  tools: Object.keys(i.tools),
});

const bad = (m, statusCode = 400) => Object.assign(new Error(m), { statusCode });
const oauthStates = new Map();
const page = (reply, title, text) => reply.type('text/html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui;max-width:520px;margin:15vh auto;padding:0 16px;color:#0F172A"><h1 style="font-size:22px">${title}</h1><p style="color:#5B6474">${String(text).replace(/[<>&"]/g, '')}</p></body>`);

const localBase = () => `http://127.0.0.1:${env('PORT', '8787')}`;

/** Public routes with their own auth: the WhatsApp webhook, the health ingest key, the Spotify sign-in callback. */
export async function mountIntegrationsPublic(app) {
  // WhatsApp Cloud webhook: Meta signs the raw body, so this scope parses JSON itself.
  await app.register(async (inst) => {
    inst.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => done(null, body));
    inst.get('/whatsapp/webhook', async (req, reply) => { const c = verifyHandshake(req.query); return c === null ? reply.code(403).send('forbidden') : reply.type('text/plain').send(c); });
    inst.post('/whatsapp/webhook', async (req, reply) => {
      const raw = typeof req.body === 'string' ? req.body : '';
      if (!verifyMeta(raw, req.headers['x-hub-signature-256'])) return reply.code(401).send('bad signature');
      let body; try { body = JSON.parse(raw); } catch { return reply.code(400).send(); }
      void handleWaWebhook(body).catch((e) => req.log.warn(`whatsapp: ${e.message}`)); // answer Meta at once
      return reply.code(200).send('ok');
    });
  });

  // Phone automations post health numbers here with their own key (not a Firebase sign-in).
  app.post('/health/ingest', async (req, reply) => {
    const key = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const uid = await uidForIngestKey(key); if (!uid) return reply.code(401).send({ error: 'Unknown ingest key. Make a new one in Connections → Health.' });
    const days = Array.isArray(req.body?.days) ? req.body.days : req.body?.date ? [req.body] : [];
    return saveDays(uid, days, String(req.body?.source ?? 'automation'));
  });

  // Spotify sends the browser back here after sign-in.
  app.get('/spotify/oauth/callback', async (req, reply) => {
    const s = oauthStates.get(String(req.query?.state ?? '')); oauthStates.delete(String(req.query?.state ?? ''));
    if (!s || s.exp < Date.now()) return page(reply, 'That sign-in expired', 'Start again from Connections → Spotify.');
    if (req.query?.error) return page(reply, 'Spotify sign-in was cancelled', String(req.query.error));
    try {
      const rt = await spotifyExchange(String(req.query?.code ?? ''), s.redirectUri);
      const { saveConfig } = await import('../lib/config.js'); await saveConfig({ SPOTIFY_REFRESH_TOKEN: rt });
      return page(reply, 'Spotify is connected', 'Tune can now see what you play and build playlists. You can close this tab.');
    } catch (e) { return page(reply, 'Could not connect Spotify', e.message); }
  });
}

/** Owner routes inside the authenticated API scope `v1`. */
export function mountIntegrations(v1, { requireOwner }) {
  const local = localBase();
  v1.get('/v1/integrations', async () => INTEGRATIONS.map((i) => describe(i, local)));
  v1.post('/v1/integrations/:key/test', { preHandler: requireOwner }, async (req) => {
    const i = BY[req.params.key]; if (!i) throw bad('No such integration.', 404);
    try { return { ok: true, text: await i.test(req.user.uid) }; } catch (e) { return { ok: false, text: e.message }; }
  });
  v1.post('/v1/integrations/:key/link-code', { preHandler: requireOwner }, async (req) => {
    const i = BY[req.params.key]; if (!i?.linkCode) throw bad('This integration has no link code.', 404);
    if (!i.ready()) throw bad(`Set up ${i.name} first.`, 503);
    const code = randomBytes(4).toString('hex').toUpperCase();
    await db.collection('chatLinks').doc(code).set({ uid: req.user.uid, provider: i.linkCode, exp: Date.now() + 15 * 60_000, at: now() });
    return { code, command: `link ${code}`, expiresInMinutes: 15 };
  });
  v1.get('/v1/integrations/spotify/start', { preHandler: requireOwner }, async (req) => {
    if (!env('SPOTIFY_CLIENT_ID') || !env('SPOTIFY_CLIENT_SECRET')) throw bad('Save the Spotify client ID and secret first.');
    const redirectUri = req.query?.local === '1' || !site() ? `${local}/spotify/oauth/callback` : `${site()}/spotify/oauth/callback`;
    const state = randomBytes(16).toString('hex'); oauthStates.set(state, { redirectUri, exp: Date.now() + 10 * 60_000 });
    return { url: spotifyAuthUrl(redirectUri, state), redirectUri };
  });
  v1.post('/v1/integrations/obsidian/sync', { preHandler: requireOwner }, async (req) => {
    if (!obsidianReady()) throw bad('Set the Obsidian vault folder first.', 503);
    const { link } = await import('../api/graph.js');
    const pairs = await vaultLinks(3000); let n = 0;
    for (const p of pairs) { if (p.from.toLowerCase() === p.to.toLowerCase()) continue; await link(req.user.uid, { from: p.from, rel: 'links_to', to: p.to, fromType: 'topic', toType: 'topic', by: 'obsidian', confidence: 0.9 }).catch(() => {}); n++; }
    return { ok: true, text: `Added ${n} link(s) from your vault to the knowledge graph.` };
  });

  // Health: from the app or dashboard, CSV import, and the ingest key for phone automations.
  v1.post('/v1/health', async (req) => saveDays(req.user.uid, req.body?.days, String(req.body?.source ?? 'app')));
  v1.post('/v1/health/import', async (req) => saveDays(req.user.uid, parseHealthCsv(String(req.body?.csv ?? '').slice(0, 2_000_000)), 'csv'));
  v1.post('/v1/health/key', async (req) => ({ key: await newIngestKey(req.user.uid), url: site() ? `${site()}/health/ingest` : '' }));
}
