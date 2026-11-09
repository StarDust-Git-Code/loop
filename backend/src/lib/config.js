// Server settings, kept on the owner's computer in <data>/config.json. Secret values are sealed with MASTER_KEY
// (envelope AES-256-GCM, see crypto.js); the key itself lives in <data>/master.key and is created on first run.
// Real environment variables always win over the file, so a .env or a service manager can still override anything.
import { existsSync, readFileSync, writeFileSync, chmodSync, renameSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { dataDir, dir } from './paths.js';

/** Every setting the setup page knows. `secret` values are sealed on disk and never sent back in full. */
export const FIELDS = [
  { key: 'FIREBASE_SERVICE_ACCOUNT_B64', group: 'core', label: 'Firebase service account', secret: true, help: 'Firebase console → Project settings → Service accounts → Generate new private key. Paste the JSON file here.' },
  { key: 'ALLOWED_EMAILS', group: 'core', label: 'Allowed email(s)', help: 'The Google account(s) that may use this server, comma separated.' },
  { key: 'ALLOWED_ORIGINS', group: 'core', label: 'Dashboard address', help: 'Your Vercel dashboard URL, e.g. https://dashboard-loopmates.vercel.app. Localhost is always allowed.' },
  { key: 'PORT', group: 'core', label: 'Port', help: 'Default 8787.' },
  { key: 'GEMINI_API_KEY', group: 'models', label: 'Gemini API key', secret: true, help: 'Free at aistudio.google.com. Needed for voice calls; also a chat model.' },
  { key: 'NVIDIA_API_KEY', group: 'models', label: 'NVIDIA NIM API key', secret: true, help: 'Optional. build.nvidia.com.' },
  { key: 'GROQ_API_KEY', group: 'models', label: 'Groq API key', secret: true, help: 'Optional. console.groq.com.' },
  { key: 'CEREBRAS_API_KEY', group: 'models', label: 'Cerebras API key', secret: true, help: 'Optional.' },
  { key: 'OPENROUTER_API_KEY', group: 'models', label: 'OpenRouter API key', secret: true, help: 'Optional. Free models available.' },
  { key: 'BRAVE_API_KEY', group: 'models', label: 'Brave Search API key', secret: true, help: 'Optional. Without it web search uses DuckDuckGo.' },
  { key: 'TUNNEL_MODE', group: 'tunnel', label: 'Public address', help: 'quick = free random trycloudflare.com address (changes on restart); named = your own domain with a Cloudflare tunnel token; off = you handle it.' },
  { key: 'TUNNEL_TOKEN', group: 'tunnel', label: 'Cloudflare tunnel token', secret: true, help: 'Only for a named tunnel (Zero Trust → Networks → Tunnels → your tunnel → Install connector).' },
  { key: 'PUBLIC_URL', group: 'tunnel', label: 'Public URL', help: 'Set automatically by a quick tunnel. For a named tunnel, the https:// hostname you routed to this server.' },
  { key: 'TELEGRAM_BOT_TOKEN', group: 'channels', label: 'Telegram bot token', secret: true, help: 'From @BotFather → /newbot.' },
  { key: 'DISCORD_APP_ID', group: 'channels', label: 'Discord application ID', help: 'discord.com/developers → your app → General Information.' },
  { key: 'DISCORD_PUBLIC_KEY', group: 'channels', label: 'Discord public key', help: 'Same page as the application ID.' },
  { key: 'DISCORD_BOT_TOKEN', group: 'channels', label: 'Discord bot token', secret: true, help: 'Bot → Reset Token.' },
  { key: 'GOOGLE_CLIENT_ID', group: 'drive', label: 'Google OAuth client ID', help: 'Google Cloud console → APIs & Services → Credentials → OAuth client (Desktop or Web).' },
  { key: 'GOOGLE_CLIENT_SECRET', group: 'drive', label: 'Google OAuth client secret', secret: true },
  { key: 'GOOGLE_REFRESH_TOKEN', group: 'drive', label: 'Drive refresh token', secret: true, help: 'Filled in by "Connect Google Drive".' },
  { key: 'DRIVE_ROOT_FOLDER_ID', group: 'drive', label: 'Drive folder', help: 'The one folder the agents may use. Pick it after connecting.' },
  { key: 'GOOGLE_SCOPES', group: 'drive', label: 'Google access', help: 'What the Google sign-in asks for: drive, plus calendar and gmail (comma separated, default "drive,calendar,gmail"). Sign in again after changing it.' },
  { key: 'GOOGLE_GRANTED_SCOPES', group: 'drive', label: 'Granted Google scopes', help: 'Filled in by the Google sign-in.' },
  // Integrations (backend/src/integrations). All optional; each one's tools only appear once its keys are set.
  { key: 'OBSIDIAN_VAULT', group: 'integrations', label: 'Obsidian vault folder', help: 'The full path of your vault on this computer, e.g. C:\\Users\\you\\Documents\\Vault.' },
  { key: 'OBSIDIAN_DAILY_FOLDER', group: 'integrations', label: 'Obsidian daily notes folder', help: 'Optional. Read from the vault\'s Daily notes settings when empty.' },
  { key: 'SLACK_BOT_TOKEN', group: 'integrations', label: 'Slack bot token', secret: true, help: 'xoxb-… from OAuth & Permissions.' },
  { key: 'SLACK_APP_TOKEN', group: 'integrations', label: 'Slack app-level token', secret: true, help: 'xapp-… with connections:write (Socket Mode, no public address needed).' },
  { key: 'WHATSAPP_TOKEN', group: 'integrations', label: 'WhatsApp Cloud API token', secret: true, help: 'A permanent system-user token from Meta Business settings.' },
  { key: 'WHATSAPP_PHONE_ID', group: 'integrations', label: 'WhatsApp phone number ID', help: 'WhatsApp → API Setup → Phone number ID.' },
  { key: 'WHATSAPP_VERIFY_TOKEN', group: 'integrations', label: 'WhatsApp webhook verify token', secret: true, help: 'Any long random text; type the same in the Meta webhook settings.' },
  { key: 'WHATSAPP_APP_SECRET', group: 'integrations', label: 'Meta app secret', secret: true, help: 'App settings → Basic → App secret. Used to check webhook signatures.' },
  { key: 'NOTION_TOKEN', group: 'integrations', label: 'Notion integration secret', secret: true, help: 'notion.so/my-integrations → internal integration → secret. Share pages with it.' },
  { key: 'NOTION_PARENT_PAGE', group: 'integrations', label: 'Notion page for new notes', help: 'Optional. The id of the page new pages are created under.' },
  { key: 'TODOIST_TOKEN', group: 'integrations', label: 'Todoist API token', secret: true, help: 'Todoist → Settings → Integrations → Developer.' },
  { key: 'LINEAR_API_KEY', group: 'integrations', label: 'Linear API key', secret: true, help: 'Linear → Settings → Security & access → Personal API keys.' },
  { key: 'SPOTIFY_CLIENT_ID', group: 'integrations', label: 'Spotify client ID', help: 'developer.spotify.com/dashboard → Create app.' },
  { key: 'SPOTIFY_CLIENT_SECRET', group: 'integrations', label: 'Spotify client secret', secret: true },
  { key: 'SPOTIFY_REFRESH_TOKEN', group: 'integrations', label: 'Spotify refresh token', secret: true, help: 'Filled in by "Sign in with Spotify".' },
  { key: 'HA_URL', group: 'integrations', label: 'Home Assistant address', help: 'e.g. http://homeassistant.local:8123 (your server can reach your home network).' },
  { key: 'HA_TOKEN', group: 'integrations', label: 'Home Assistant token', secret: true, help: 'Home Assistant → your profile → Security → Long-lived access tokens.' },
  { key: 'GITHUB_TOKEN', group: 'github', label: 'GitHub fine-grained token', secret: true, help: 'github.com/settings/personal-access-tokens → only the repos you list below; Contents + Pull requests: read and write.' },
  { key: 'GITHUB_REPOS', group: 'github', label: 'Allowed repositories', help: 'owner/name, comma separated. The coder may only clone and push these.' },
  { key: 'DEFAULT_REPO', group: 'github', label: 'Default repository', help: 'Used when a coding step names none. https://github.com/owner/name' },
  { key: 'SANDBOX', group: 'advanced', label: 'Coding sandbox', help: 'auto = Docker when installed, else a restricted process; docker; process.' },
  { key: 'PY_IMAGE', group: 'advanced', label: 'Python image for agents', help: 'Docker image for python_run (default python:3.12-slim). Build docker/python.Dockerfile as loopmates-python for pandas, numpy and matplotlib.' },
  { key: 'VAPID_PUBLIC_KEY', group: 'advanced', label: 'Web push public key', help: 'Created automatically.' },
  { key: 'VAPID_PRIVATE_KEY', group: 'advanced', label: 'Web push private key', secret: true },
  { key: 'OWNER_UID', group: 'advanced', label: 'Paired owner', help: 'Set when you pair the dashboard.' },
];
const SECRET = new Set(FIELDS.filter((f) => f.secret).map((f) => f.key));
const KNOWN = new Set(FIELDS.map((f) => f.key));

export const configFile = join(dataDir, 'config.json');
const keyFile = join(dataDir, 'master.key');
let file = {}; // key -> plain string or sealed blob
const fromEnv = new Set(); // keys that came from the real environment (not overwritten)

const writeSafe = (path, text) => { const tmp = `${path}.tmp`; writeFileSync(tmp, text, { mode: 0o600 }); renameSync(tmp, path); try { chmodSync(path, 0o600); } catch { /* Windows */ } };

/** Load master.key and config.json into process.env. Call once, before anything reads env. */
export async function loadConfig() {
  dir('.');
  if (!process.env.MASTER_KEY) {
    if (!existsSync(keyFile)) writeSafe(keyFile, randomBytes(32).toString('base64'));
    process.env.MASTER_KEY = readFileSync(keyFile, 'utf8').trim();
  }
  for (const k of KNOWN) if (process.env[k]) fromEnv.add(k);
  try { file = JSON.parse(readFileSync(configFile, 'utf8')); } catch { file = {}; }
  const { open } = await import('./crypto.js');
  for (const [k, v] of Object.entries(file)) {
    if (fromEnv.has(k)) continue;
    try { process.env[k] = typeof v === 'string' ? v : open(v, `config|${k}`); } catch { console.error(`config: could not unseal ${k} (was master.key replaced?)`); }
  }
  if (!process.env.PORT) process.env.PORT = '8787';
  if (!process.env.ALLOWED_ORIGINS) process.env.ALLOWED_ORIGINS = 'https://dashboard-loopmates.vercel.app';
}

/** Save settings. '' removes a key; secrets are sealed. Applies to process.env immediately. */
export async function saveConfig(patch) {
  const { seal } = await import('./crypto.js');
  for (const [k, raw] of Object.entries(patch)) {
    if (!KNOWN.has(k)) continue;
    const v = String(raw ?? '').trim();
    if (!v) { delete file[k]; if (!fromEnv.has(k)) delete process.env[k]; continue; }
    file[k] = SECRET.has(k) ? seal(v, `config|${k}`) : v;
    if (!fromEnv.has(k)) process.env[k] = v;
  }
  writeSafe(configFile, JSON.stringify(file, null, 2));
}

/** What the setup page may show: secrets as "set" plus the last 4 characters, never in full. */
export function publicConfig() {
  return FIELDS.map((f) => {
    const v = process.env[f.key] ?? '';
    return { ...f, set: !!v, value: f.secret ? (v ? `••••${v.slice(-4)}` : '') : v, fromEnv: fromEnv.has(f.key) };
  });
}
