# Handoff

State as of 9 Nov 2026. The full task list with details is in `tasks.md`; architecture and API notes are in `CONTEXT.md` and `backend/README.md`.

**Nothing from the 8–9 Nov work is committed yet** (including the autonomous-team work below). It is all in the working tree. Commit it on a branch first: a push to `main` auto-deploys the dashboard.

## What changed

- **One backend instead of five Render services.** `backend/src/server.js` runs everything in one process on the owner's own computer (Windows or Linux):
  - REST API and SSE, the voice WebSocket at `/live`, the coder, Google Drive, the browser
  - Telegram (long polling) and Discord (Gateway), so neither needs a public address
  - the scheduler, and a local setup page at `/setup`
- **Setup and install.**
  - `backend/install.ps1` (Windows) and `backend/install.sh` (Linux) install Node 22, register a background service that restarts itself, and add the `loopmates` command.
  - Settings and secrets live encrypted in the data folder: `%LOCALAPPDATA%\Loopmates` on Windows, `~/.local/share/loopmates` on Linux.
- **Public address.** A Cloudflare Tunnel is started from the setup page. Quick tunnels are free, need no account, and change address on every restart. Named tunnels are stable.
- **Pairing.**
  - The setup page shows a 6-digit code, which the owner types into the dashboard.
  - The server then writes `servers/{uid}` in Firestore. The dashboard and the phone both read it to find the server, and follow it when the address changes.
- **Agents.**
  - The long system prompt (`backend/prompts/agent-system-prompt.md`) is used on every turn, with only the speaking Mate's role card. Role cards can be edited in Agents.
  - New `ask_owner` tool: a question with 2 to 4 options, answered from Home, a push notification, or Telegram/Discord buttons. In a run, the step waits for the answer.
  - `notify_me` and `call_me` use app push as well as Telegram and Discord, and respect quiet hours.
- **Dashboard.**
  - New screens: pairing, Server status, and an offline banner.
  - Redesigned: Connections (step by step, each with a Test button), Call, and the Chat start screen.
  - Web push notifications and new notification settings.
- **Design tokens.** `design/tokens.json` feeds both apps. After editing it, run `node design/build-tokens.mjs` to regenerate the dashboard CSS and the mobile theme.
- **Calling fixes** (phase 1 in `tasks.md`) are all done in code.

## Autonomous team (9 Nov, later)

- **Custom agents and a leader.** Agents → New agent / Remove / Restore / Make leader. The leader (default Mimo) is the first contact everywhere and gets the delegation, watch and company tools.
- **Memory.** Shared memory (every agent), personal notes (one agent), and a knowledge graph, all learned automatically from chats, calls and runs. Dashboard → Memory.
- **Access per agent.** The prompt lists only names (skills, MCP servers, memory, graph); agents load details with tools. Agents → Configure → Access; the server enforces it.
- **MCP servers** are really called now, HTTP and stdio, with encrypted headers or environment variables.
- **Coding harnesses.** Claude Code, Codex or OpenCode, supervised by the Code Mate (brief → work → tests → review → up to 3 rounds → PR). Connections → Coding harness. Codex and OpenCode are installed on this computer and detected; Claude Code and Docker are not.
- **Jarvis mode.** Home → Keeping watch: runs, approvals, deadlines and calendar by default; add topics and GitHub repos. Messages for important things, calls for urgent ones (capped per day, quiet hours respected), call reminders, an optional morning briefing.
- **Company.** Dashboard → Company: people (CSV import, org chart), assignments, check-ins (drafts you approve), digests. Employees join the Telegram bot with `/join CODE` and only see their own work and Knowledge marked Company.

## Distinct agents (9 Nov, latest)

- Every role card in `backend/prompts/agent-system-prompt.md` now has its own voice, a way of ending a message, a brainstorm stance and a short way of working. The card is sent once per turn, not twice.
- Run files and reports use the Mate's real card (`briefPersona()`), including cards the owner edited.
- Agents → Configure and New agent have **Personality** and **Voice on calls**. A custom agent no longer borrows the call voice of the Mate whose picture it uses.
- Telegram replies start with the agent's name; `@research ...` on Telegram asks that agent.
- Not tested for real yet: how distinct the voices feel with a live model, and a call with an owner-picked voice.

## Integrations and a livelier team (9 Nov, latest)

- **New integrations** in `backend/src/integrations/`, all optional, each drawn in Dashboard → Connections from `GET /v1/integrations` (steps, settings, test): Obsidian, Notion, Google Calendar + Gmail (drafts only), Slack (Socket Mode), WhatsApp Cloud API, Todoist, Linear, Spotify, RSS & YouTube, Health (ingest key / CSV), Home Assistant.
  - Their tools reach only the Mates whose job fits, and only once the integration is set up.
  - Slack and WhatsApp are also notification channels (Settings → Notifications).
  - Home Assistant locks, alarms and covers need approval.
  - New watch kinds: `feed` and `home`.
- **Google sign-in** now also asks for Calendar and Gmail (`GOOGLE_SCOPES`). Owners already signed in for Drive must **sign in again** to use them.
- **Mates:**
  - Every card has a **Team** line (who it relies on and pushes back on) and a **Sign-off** (added under its pings).
  - Each Mate has a **Journal** of feedback on its work (personal memories, shown in Agents → Configure → Journal).
  - **Voice preview** (▶ Play in Agents → Configure, Gemini TTS).
  - **Weekly stand-up** (Home → Watch settings).
- `future-idea.md` holds the deep-research harness idea (datasheets, patents, claims).
- Not done: phone Health Connect sync (needs a native module and a new build; phone automations can post to `/health/ingest` meanwhile), phone screens for the new integrations.

## To do before using it

1. **Commit** the work on a branch, review it, then merge.
2. **Install the server** on the owner's computer (`backend/install.ps1` or `backend/install.sh`). On the setup page:
   - paste the Firebase service-account key
   - start the quick tunnel
   - show a pairing code and enter it in the dashboard
3. **Deploy `firestore.rules`** (Firebase console → Firestore → Rules, or `firebase deploy --only firestore:rules`). Pairing fails without them.
4. **Vercel (dashboard project):** keep the `NEXT_PUBLIC_FIREBASE_*` variables. Remove `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_VOICE_URL`, which are no longer used.
5. **Shut down the five old Render services** once the new server is paired and working.
6. **Connections:** link Telegram, Discord, Google Drive and GitHub by following the steps in Dashboard → Connections.
7. **Phone:**
   - Add an EAS project id to `mobile/app.json` (`extra.eas.projectId`) to switch on phone push.
   - Make a new native build. It is also needed for calls to keep running with the screen off.

## Not tested for real yet

- **A real coding job** through Codex, OpenCode or Claude Code (tested with a fake Codex that follows the same protocol), and Docker mode (`docker build -t loopmates-harness -f backend/docker/harness.Dockerfile backend`).
- **Jarvis mode with real accounts:** a call reminder you answer, a topic watch over a few days, GitHub watch on a real repo.
- **An employee on Telegram** (`/join`, a check-in and its reply).

- **Voice calls with a real microphone and the real Gemini Live API**, in both directions: the owner calling a Mate, and a Mate ringing the owner with `call_me`. Test from the dashboard (Chrome desktop and Android) and from the phone app.
- Drive, Telegram, Discord and GitHub with real accounts on the new server.
- The installers on a clean Windows machine and a clean Ubuntu machine.
- The Cloudflare Tunnel, and pairing from a dashboard on another device.

## What is verified

| Check | Result |
|---|---|
| Backend end-to-end (`npm test` in `backend/`) | 22 checks pass, on Windows (custom agents, MCP, graph, access, harness supervision, Jarvis mode, company) |
| Backend unit checks (in the same `npm test` run) | 11 pass |
| Browser checks (`npm run test:browser`) | 8 pass, using Edge |
| Dashboard | typecheck, lint and build all clean |
| Mobile | typecheck clean, Android bundle builds, `expo-doctor` 20/20 |
| First-run setup page | needs its key and refuses requests that come through the tunnel |

## Still partly done (see `tasks.md`, phases 6 and 8)

- **New screens not reviewed visually yet:** Memory, Company, Keeping watch, Coding harness, New agent. They typecheck, lint and build.
- **Phone:** shows custom agents and the leader, but has no Memory, Company or watch screens yet.
- **Employees on Discord:** only Telegram is wired.

- **Older dashboard screens** have the new colours and font but their old layouts: Run detail, Studio, My Space, Knowledge, Skills, Tasks, Workflows, Automations and Files.
- **Dark mode:** the dashboard is light-only. The phone has dark mode, using the new palette.
- **Visual review:** checked at about 560 and 1440 px wide. The 360, 768 and 1920 px widths have not been checked.
- **Phone push:** uses Expo push instead of Firebase Cloud Messaging. It is free and needs no key in the app.
