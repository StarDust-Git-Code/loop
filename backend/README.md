# Loopmates server

The whole backend in **one Node process on one port**, running on the owner's own computer (Windows 10/11 or Linux, x86_64, arm64 or s390x). The dashboard on Vercel and the phone app reach it through a free Cloudflare Tunnel. Data lives in the owner's own Firebase project.

## Install

Windows (PowerShell, in this folder):

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Linux:

```bash
./install.sh            # per-user systemd service
./install.sh --system   # system service (sudo)
```

Both install Node 22 if needed, run `npm ci`, register a background service that restarts the server if it stops, and open the setup page. Uninstall with `install.ps1 -Uninstall` or `install.sh --uninstall`. Your data stays in the data folder.

## First run: the setup page

`http://localhost:8787/setup?key=…` opens by itself after install (later: Start menu → **Loopmates setup**, or `loopmates setup`). It only answers on this computer and needs the key in `setup.key`.

1. **Firebase**: Firebase console → Project settings → Service accounts → Generate new private key. Paste the file. Add your email to the allow-list. The server restarts once.
2. **Public address**: start the **Quick tunnel** (free, no account; the address changes on restart and the dashboard follows it) or a **named tunnel** with your own domain (stable). `cloudflared` is downloaded automatically.
3. **Pair the dashboard**: press *Show a pairing code*, sign in to the dashboard, type the 6 digits. The server writes `servers/{uid}` in Firestore; the dashboard and the phone read it to find the server.
4. Optional: model keys (Gemini is free and powers voice), Telegram, Discord, Google Drive, GitHub, the browser. The dashboard's **Connections** page walks through each one.

Deploy `../firestore.rules` once (Firebase console → Firestore → Rules, or `firebase deploy --only firestore:rules`). They let the owner read only `servers/{uid}` and `pairings/{code}`; everything else is server-only.

## What runs inside

| Part | Where | Notes |
|---|---|---|
| REST API + SSE | `src/api/` | `/v1/...`, Firebase ID token in `Authorization: Bearer`. Allow-list: `ALLOWED_EMAILS` |
| Voice | `src/voice/` | WebSocket `/live` on the same port, relayed to Gemini Live |
| Coder | `src/coder/` | In-process job runner. Commands run in Docker when available (`SANDBOX=auto`), else as restricted processes |
| Google Drive | `src/drive/` | The owner's own OAuth client, confined to one folder |
| Browser | `src/browser/` | Starts on first use. Uses Edge/Chrome on the computer, or Chromium installed from the setup page; Firefox + geckodriver on s390x |
| Telegram | `src/api/telegram.js` | Long polling: no public URL needed |
| Discord | `src/api/discord.js` | Gateway WebSocket: no public URL needed |
| Scheduler | `src/api/sched.js` | Every 30 s. On boot, anything that came due while the computer was off fires once, marked late |
| Push | `src/api/push.js` | Web push (VAPID keys created on first run) and Expo push for the phone |
| Setup + status | `src/setup/` | `/setup`, `/setup/status`, local only |

## Agents, memory and the leader

- **Roster** (`src/api/roster.js`): built-in Mates plus custom agents (`users/{uid}/mates/{key}` with `custom: true`). `settings.leader` picks the leader (default `mimo`).
- **Memory** (`memory.js`): `scope: shared | personal` (+ `mate`). `learnFromTurn` runs after every chat, call and run and also feeds the **knowledge graph** (`graph.js`: `graph_nodes`, `graph_edges`).
- **Reach** (`reach.js`): the prompt lists only names; `skill_load`, `mcp_tools`, `mcp_call`, `memory_*`, `graph_*` load details. `access` on each agent's config is enforced in the tools.
- **MCP** (`mcp.js`): HTTP and stdio, pooled sessions (5 min idle), 60 s per call; `config` values are sealed (headers for HTTP, env for stdio).
- **Watch** (`watch.js`): `watches` + `alerts`, scheduled through `jobs`. Score 1-5 → digest / message / message with call link / call. `maxCallsPerDay`, `urgentBreaksQuiet`, `briefingOn/At/Call`.
- **Company** (`company.js`): `people`, `teams`, `projects`, `assignments`, `checkins`; employees on Telegram via `/join CODE` (`employeeChats`), restricted handler, `companyDailyLlmBudget`.

## Coding harnesses

`settings.coderHarness`: `builtin` | `claude` | `codex` | `opencode` (a Code step's `config.harness` overrides it); `settings.coderSandbox`: `auto` | `docker` | `host`. The harness signs in with your own account on this computer. Docker mode needs the image: `docker build -t loopmates-harness -f docker/harness.Dockerfile .`. Host mode runs in the job folder with the harness's safe mode (Codex `workspace-write`, Claude Code `acceptEdits` + a tool allow-list, OpenCode `--auto`) and an environment without Loopmates secrets. `GET /v1/coder/harnesses`, `POST /v1/coder/test`.

## Integrations

`src/integrations/` holds the optional apps. Each one declares its server settings, setup steps, status, a test and its tools in one object, listed in `integrations/index.js`; the dashboard draws Connections from `GET /v1/integrations`. An integration's tools only reach agents once it is set up (`ready()`), and only the Mates whose job fits get its tool group (`EXTRA_GROUPS` in `api/tools.js`).

| Integration | Group | Needs | Notes |
|---|---|---|---|
| Obsidian | Notes | `OBSIDIAN_VAULT` | Reads and writes the vault folder in place. Paths are confined to the vault; dot-folders are skipped. `[[links]]` can be synced to the graph. |
| Notion | Notes | `NOTION_TOKEN` | Internal integration; only pages shared with it. |
| Google Calendar & Gmail | Google | the Drive sign-in, done again with `GOOGLE_SCOPES` | Gmail is read + drafts only, never send. |
| Slack | Team Chat | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` | Socket Mode (outbound, no public address). Each Mate posts under its own name and mascot. Posting to channels needs approval. |
| WhatsApp (Cloud API) | Team Chat | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Webhook `/whatsapp/webhook`, signature-checked. Needs a stable public address. Separate from the read-only bridge in `api/whatsapp.js`. |
| Todoist, Linear | Task Apps | `TODOIST_TOKEN`, `LINEAR_API_KEY` | |
| Spotify | Music | `SPOTIFY_CLIENT_ID/SECRET`, then sign-in | Redirect `http://127.0.0.1:<port>/spotify/oauth/callback`. |
| RSS & YouTube | Feeds | nothing | Through the same SSRF guard as `fetch_url`. Watch kind `feed`. |
| Health | Health | an ingest key per owner | `POST /health/ingest` (Bearer ingest key), `POST /v1/health`, CSV import. Read-only tool. |
| Home Assistant | Home | `HA_URL`, `HA_TOKEN` | Only `HA_URL` is contacted. Locks, alarms, covers, valves, scripts and automations go through `home_control_secure` (needs approval). Watch kind `home`. |

Slack and WhatsApp are also notification channels (`notifySlack`, `notifyWhatsapp` in Settings), and link like Telegram: a code from Connections, then `link CODE`.

## Files

| Path | What |
|---|---|
| Data folder | Windows `%LOCALAPPDATA%\Loopmates`, Linux `~/.local/share/loopmates` (`LOOPMATES_DATA` overrides) |
| `config.json` | Settings. Secrets are sealed with `master.key` (AES-256-GCM envelope) |
| `master.key`, `setup.key` | Created on first run. Keep them private |
| `work/`, `bin/`, `server.log` | Coder workspaces, `cloudflared`, the log |

Real environment variables always win over `config.json`.

## Commands

```
loopmates run      # supervisor: starts the server, restarts it after setup changes or a crash (services use this)
loopmates setup    # open the setup page
loopmates status   # what is ready and what is missing
loopmates update   # git pull + npm ci + restart
loopmates stop | logs
```

## Tests

```
npm test               # unit checks + end-to-end against src/server.js (in-memory Firestore, fake LLM, in-memory Drive,
                       # a temporary Obsidian vault and a fake Home Assistant)
npm run test:browser   # browser engine smoke test (needs Edge/Chrome/Chromium)
```
