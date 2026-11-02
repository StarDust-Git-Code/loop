# Loopmates backend

One codebase, three services (plain Node 22 ESM, no build step):

| Service | Start | Host | Does |
|---|---|---|---|
| `api` | `node src/api/index.js` | Render #3 | Firebase-auth REST API, run engine (SSE), LLM gateway with failover, key vault, scheduler, Telegram, WhatsApp (read-only, optional) |
| `coder` | `node src/coder/index.js` | Render #1 | Coding agent: edits an ephemeral workspace, pushes a branch and opens a PR |
| `artifacts` | `node src/artifacts/index.js` | Render #2 | Stores files in **your** Google Drive (owner-only, OAuth refresh token) |

Data lives in Firestore (`users/{uid}/...`). The services talk to each other with HMAC-signed requests (`SERVICE_SECRET`, 60 s validity).

## Deploy (Windows)
1. `cd backend && npm ci` (only needed to run tests locally).
2. Get a Drive token once: `node scripts/drive-token.mjs <CLIENT_ID> <CLIENT_SECRET>`.
3. Download a Firebase service-account key (Project settings → Service accounts) and keep it outside the repo.
4. `.\scripts\deploy.ps1` — creates `scripts\deploy.env` from the example on first run; fill it in; run again. `-DryRun` checks everything without changing anything. It is safe to re-run.

Manual alternative: `render.api.yaml`, `render.coder.yaml`, `render.artifacts.yaml` are Blueprints (one per Render account).

## Test locally
`npm test` runs an end-to-end check with an in-memory Firestore, a fake LLM and a fake Drive (about 90 s, mostly waiting for a cron minute).

## Free-tier facts that shape the design
- Render free services sleep after 15 min without inbound traffic (about 1 min to wake). A free pinger should call `GET {api}/internal/tick?key=<CRON_SECRET>` every 5 min; that also fires due reminders and automations. The API pings itself while a run is active.
- 750 free hours per Render **workspace** per month, so each service sits in its own account.
- No persistent disk: all state is in Firestore, files are in Drive, workspaces are wiped.
- Firestore free quota: 20K writes/day. Live run events are streamed from memory; only checkpoints are written.

## Security notes
- Provider API keys and connection tokens are sealed with AES-256-GCM (per-secret data key wrapped by `MASTER_KEY`, AAD = owner + purpose). The browser only ever gets `••••1234`. **Back up `MASTER_KEY`; losing it makes stored keys unreadable.** It does not protect against someone who controls the running server.
- `ALLOWED_EMAILS` gates who may use the API. Firestore rules deny all browser access (the API uses the Admin SDK).
- The Coder runs only allow-listed commands without a shell and with a scrubbed environment, but it is not a hardened sandbox. Do not point it at repos you do not trust.

## Not built yet
Embeddings/vector search (knowledge search is keyword-only), a real browser service with live view (planned for the VM), stdio MCP servers, email delivery, Firestore backups to Drive.
