// One-time: get a Google Drive refresh token for the Artifacts service.
// 1) Google Cloud Console -> APIs & Services -> enable "Google Drive API"
// 2) OAuth consent screen: External, add yourself as a Test user (keep it in Testing; fine for personal use)
// 3) Credentials -> Create OAuth client ID -> "Desktop app". Copy the client id and secret.
// 4) node scripts/drive-token.mjs <CLIENT_ID> <CLIENT_SECRET>   -> prints GOOGLE_REFRESH_TOKEN
// Note: while the consent screen is in "Testing", Google expires refresh tokens after 7 days. Publish the app (To production)
// for a long-lived token (drive.file is a narrow, non-sensitive scope, so this should not need Google verification; check the consent screen).
import http from 'node:http';
import { exec } from 'node:child_process';

const [id, secret] = process.argv.slice(2);
if (!id || !secret) { console.error('usage: node scripts/drive-token.mjs <CLIENT_ID> <CLIENT_SECRET>'); process.exit(1); }
const PORT = 53682; const redirect = `http://127.0.0.1:${PORT}/cb`;
const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent' })}`;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== '/cb') { res.statusCode = 404; return res.end(); }
  const code = u.searchParams.get('code');
  if (!code) { res.end('No code. Close this tab and try again.'); return; }
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' }) });
  const j = await r.json();
  res.end(j.refresh_token ? 'Done. You can close this tab and return to the terminal.' : 'Google returned no refresh token. See the terminal.');
  if (!j.refresh_token) console.error('No refresh_token in response:', j);
  else console.log(`\nGOOGLE_CLIENT_ID=${id}\nGOOGLE_CLIENT_SECRET=${secret}\nGOOGLE_REFRESH_TOKEN=${j.refresh_token}\n\nPaste these three lines into scripts/deploy.env`);
  server.close(); process.exit(j.refresh_token ? 0 : 1);
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('Opening Google sign-in. If nothing opens, visit:\n' + url + '\n');
  const open = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(open, () => {});
});
