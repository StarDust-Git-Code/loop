// loopmates-server: the whole backend in one process on one port, running on the owner's computer.
//   REST API + SSE (/v1/...), voice WebSocket (/live), Drive, the coder and the browser engine (in-process),
//   Telegram long polling, the Discord Gateway, the scheduler, and the local setup page (/setup).
// First run: with no Firebase key yet (or a key that does not work), only the setup page is served. Saving it exits
// with code 75 and the supervisor (bin/loopmates.js) starts the server again with the new settings.
import { loadConfig } from './lib/config.js';

await loadConfig();
const { env } = await import('./lib/env.js');
const { createServer, listen } = await import('./lib/server.js');
const { mountSetup, setupUrl } = await import('./setup/index.js');

const testDb = env('MEMORY_DB') === '1' && env('NODE_ENV') !== 'production';
let problem = env('FIREBASE_SERVICE_ACCOUNT_B64') || testDb ? '' : 'Firebase is not connected yet.';
let api = null;
if (!problem) {
  try { api = await import('./api/index.js'); } // connects to Firestore
  catch (e) { problem = `The Firebase key did not work: ${String(e.message).slice(0, 200)}. Paste the service-account file again.`; }
}
const app = await createServer('loopmates-server', { bodyLimit: 4 * 1024 * 1024 });

if (!api) {
  await mountSetup(app, { configured: false, problem });
  await listen(app);
  console.log(`\n  Loopmates is not set up yet (${problem}) Open this on this computer:\n  ${setupUrl()}\n`);
} else {
  const { captureConsole } = await import('./lib/console.js');
  captureConsole();
  const { mountVoice } = await import('./voice/index.js');
  const admin = await import('./api/admin.js');
  const pairing = await import('./api/pairing.js');
  const { ops: driveOps } = await import('./drive/index.js');
  const { startTunnel, onPublicUrl } = await import('./lib/tunnel.js');

  await mountSetup(app, { configured: true, deps: { serverStatus: admin.serverStatus, applyChanges: admin.applyChanges, driveAuthStart: admin.driveAuthStart, driveOps, newPairingCode: pairing.newPairingCode, unpair: pairing.unpair, pairingState: pairing.pairingState } });
  await api.mountApi(app);
  mountVoice(app);
  await listen(app);
  await api.bootApi(app);
  onPublicUrl(() => { pairing.publish().catch(() => {}); });
  if (!testDb) void startTunnel(app.log);
  console.log(`\n  Loopmates server is running on port ${env('PORT')}.\n  Setup and status: ${setupUrl()}\n`);
}
