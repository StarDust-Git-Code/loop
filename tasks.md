# Loopmates: task list

Target system: **one standalone backend** that runs on the owner's own computer (Windows or Linux), **one frontend** on Vercel, **Firebase** for auth and the database. No Render, no paid services.

Status keys: `[ ]` to do, `[~]` in progress, `[x]` done. Work top to bottom: each phase assumes the ones above it are done.

---

## 0. Decisions to make before building

- [x] **Mobile app**: keep the Expo app as a second client of the same backend, or pause it until the web app is redone? (Recommended: keep it, but fix only the call path in phase 1 and redesign it after the web app.) *(Took the recommended option, 8 Nov 2026.)*
- [x] **How the Vercel frontend reaches a backend on a home computer.** The browser needs a public HTTPS address. Recommended: **Cloudflare Tunnel** (free; a stable `https://loop.<your-domain>` with a named tunnel, or a random `trycloudflare.com` address with no domain). Alternative: Tailscale Funnel (free, `*.ts.net` address). *(Took the recommended option, 8 Nov 2026.)*
- [x] **One owner per server or many?** Recommended: one owner per server (the person whose computer it is), with `ALLOWED_EMAILS` as the guard. This keeps the Firebase rules and the pairing simple. *(Took the recommended option, 8 Nov 2026.)*
- [x] **Coding sandbox on a personal computer**: Docker when installed (recommended), otherwise the current restricted child process with a warning in the UI. *(Took the recommended option, 8 Nov 2026.)*
- [x] **New visual direction** for the UI (see phase 6, then pick one). *(Clean multi-agent.)*

---

## 1. Fix calling now (both directions are broken)

Found while reviewing (8 Nov 2026). The live voice service was tested.

- [x] **The voice relay refuses the phone app.** `backend/src/voice/index.js:51` only accepts an `Origin` listed in `ALLOWED_ORIGINS`. React Native sends the socket's own host as the origin, so the live server answers **404** and the app shows "may be waking up". Fix: also accept a missing origin and the relay's own host. The Firebase token is the real check.
- [x] **Mate-calls-you links lose the mission.** `mobile/src/app/call.tsx` drops the `call` parameter when it redirects, so the call has no briefing and no report is written. Forward `call` too.
- [x] **The voice relay ignores the allow-list.** It verifies the Firebase token but not `ALLOWED_EMAILS`, so any new account can use the owner's Gemini key. Reuse the API's allow-list check.
- [x] Hanging up while the call is still connecting leaves the Gemini session open (it is opened after `end()`). Check `ended` after each `await` in `handle()`.
- [x] The 90-second silence hang-up never fires, because every mic frame resets the timer. Count only speech (transcripts and turns), not raw audio frames.
- [x] Mobile: `useKeepAwake()` runs for as long as the Call tab is mounted. Activate it only during a live call.
- [x] Mobile: when the server's `end` event arrives with a reason, keep that reason. Don't let it be overwritten by the generic `closed` from `onclose`.
- [x] Mobile: add the audio foreground service on Android and the audio background mode on iOS (`app.json`, `react-native-audio-api` plugin options), so calls survive the screen turning off. *(Config done. Needs a new native build to confirm.)*
- [ ] **(Needs you)** **Test against the real Gemini Live API with a real microphone**, in both directions: owner calls a Mate, and a Mate rings the owner with `call_me` → Telegram link → app/dashboard → mission report lands in the chat. This has never been run for real.
- [ ] Web dashboard call: run the same real test from Chrome on desktop and Android.

---

## 2. One standalone backend (`loopmates-server`)

Merge the five Render services (api, voice, coder, artifacts, browser) into **one Node process on one port**.

### 2.1 Structure
- [x] New entry point `backend/src/server.js` that mounts everything on one Fastify instance:
  - REST API (`/v1/...`) and SSE, as today
  - voice WebSocket `/live` on the same HTTP server
  - Drive access as an in-process module (today's `src/artifacts/index.js` becomes `src/drive/`)
  - coder as an in-process job queue that spawns the sandbox (`src/coder/`)
  - browser engine loaded lazily, only when a `browser_*` tool is first used (`src/browser/`)
- [x] Delete the service-to-service HMAC hops (`svcFetch`, `/internal/llm`, `/internal/runs/:id/events`, `CODER_URL`, `ARTIFACTS_URL`, `BROWSER_URL`). Use direct function calls instead.
- [x] Remove the free-tier workarounds: the self-ping during runs, `/internal/tick` for an external pinger, the "waking up" retries in the clients (keep a short retry for flaky networks).
- [x] Keep Firestore through `firebase-admin`. Keep `MEMORY_DB=1` for tests.
- [x] Workspaces, browser profiles and caches go in a data folder (`%LOCALAPPDATA%\Loopmates` on Windows, `~/.local/share/loopmates` on Linux), not `/tmp`. This also fixes the Windows-only e2e failure (`/tmp` resolves to `C:\tmp` and the coder's path check rejects it).
- [x] Scheduler: on boot, send reminders and run automations that came due while the computer was off (once each, marked "late").

### 2.2 Configuration and setup
- [x] One `.env` file (generated) plus a **first-run setup page** served by the server at `http://localhost:<port>/setup`: Firebase service-account upload, allowed email, model API keys, optional Telegram/Discord/Drive/GitHub keys. Secrets are sealed with `MASTER_KEY` as today.
- [x] **Pairing with the web app**: the server shows a 6-digit code, and the owner enters it in the dashboard. The server then writes its public URL to `users/{uid}/server` in Firestore. Firestore rules: the owner may read only that doc, and everything else stays server-only.
- [x] The frontend reads the backend URL from that doc at sign-in (no more `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_VOICE_URL` baked into the build). It falls back to an env var for development.
- [x] Public address: the setup page offers a one-click **Cloudflare Tunnel** (quick tunnel by default, named tunnel if the owner has a domain), and shows the URL it got.
- [x] CORS and the voice origin check: allow the Vercel origin, `localhost`, and native apps (no origin).

### 2.3 Install and run on the owner's computer
- [x] **Windows**: `install.ps1`. It checks for Node 22 (installing it if missing), runs `npm ci`, creates the data folder, and registers a background service (Task Scheduler "at log on" or NSSM). It also adds Start Menu shortcuts for "Open Loopmates setup" and "Stop Loopmates".
- [x] **Linux (Ubuntu/Debian/Fedora)**: `install.sh`. Node 22 + `npm ci` + a `systemd --user` unit (or a system unit with `--system`), on x86_64 and arm64. Reuse the s390x notes from `vm-browser-setup.sh` where they apply.
- [x] Browser engine: install Playwright Chromium on first use (download with progress in the setup page). The WebDriver/Firefox path stays for s390x.
- [x] Updates: `loopmates update` (git pull + npm ci + restart), with the commit shown in `/healthz`.
- [x] Status page at `/setup/status`: which features are ready (models, voice, Drive, Telegram, Discord, GitHub, browser, tunnel) and which env var or step is missing.

### 2.4 Bots without inbound traffic where possible
- [x] **Telegram**: switch from webhook to **long polling** (`getUpdates`). This needs no public URL and works behind any router.
- [x] **Discord**: interactions need a public HTTPS endpoint (through the tunnel). Alternatively, use a Gateway WebSocket bot so slash commands work with no inbound traffic. Recommended: the Gateway, to match Telegram.

### 2.5 Clean-up
- [x] Delete `render.*.yaml`, `scripts/deploy.ps1`, `scripts/deploy-voice.ps1` and `deploy.env.example` once the new server works. Update `backend/README.md`, `CONTEXT.md` and `HANDOFF.md`.
- [x] e2e test boots `src/server.js` once (instead of 3 services) and passes on Windows and Linux.

---

## 3. One frontend on Vercel

- [x] The dashboard stays the single web frontend (Vercel project with root `dashboard/`).
- [x] Connect to the paired backend (2.2). Show a clear state when the owner's computer is offline: "Your Loopmates server is offline. Last seen 14:02." plus retry. *(Offline banner with last-seen time and Retry; the dashboard finds the server through servers/{uid}.)*
- [x] Add the **pairing** and **server status** screens. *(First-run pairing screen, Server page with feature status and notifications.)*
- [x] Fix the 4 lint errors in `dashboard/components/screens/Connections.tsx` (unescaped `"`).
- [x] The landing page (repo root) keeps its own Vercel project. No change.

---

## 4. Agents: new system prompt and the missing tools

- [x] Wire `backend/prompts/agent-system-prompt.md` into `buildSystem()` in `backend/src/api/prompt.js`:
  - load it once, fill the `{{placeholders}}`, keep or drop the `[[if]]` blocks
  - send only the speaking Mate's role card
  - keep the strings the tests key on (`You are the Planner` in the plan JSON prompt)
- [x] Add `{{connections}}`, `{{server}}`, `{{surface}}` and `{{run}}` to the dynamic context (new), and pass `surface` from chat, run, voice, Telegram and Discord.
- [x] Give every Mate a full role card in the Mate config (Agents screen → editable). Don't hard-code it in the clients.
- [x] **New tool `ask_owner`**: a question, 2 to 4 options and a default, delivered in the app and on linked channels. Inside a run it pauses the step until answered or timed out. Tap-to-answer works from Telegram (inline buttons) and Discord (buttons).
- [x] **`notify_me` through the app**: web push (dashboard) and FCM (mobile), plus a device-token endpoint `POST /v1/devices`. The owner picks the channels in Settings, and there are quiet hours. *(Web push (service worker + VAPID) and Expo push for the phone instead of FCM: free, no Google key in the app. POST /v1/devices. Quiet hours in Settings.)*
- [x] `call_me`: respect quiet hours, at most one ring per topic per hour, and an in-app ring when push is linked.
- [x] Remove "Browser mate has no working tool" from `PLANNER_GUIDE`. It is out of date now that the browser tools exist.

---

## 5. Connections: linking flows the owner can follow

Each flow gets a step-by-step screen in Connections with a Test button. The steps are the same ones written in section 8 of the system prompt, so agents and the UI say the same thing.

- [x] **Telegram**: token field (stored on the server), "Get link code", `/start CODE`, Test.
- [x] **Discord**: application ID / public key / bot token fields, invite link, `/link code:CODE`, Test.
- [x] **Google Drive**: in-app OAuth instead of `scripts/drive-token.mjs`. The owner enters their own OAuth client ID and secret, the server runs the callback on `localhost`, then the owner picks the folder in a folder browser. Warn about the 7-day expiry while the consent screen is in Testing.
- [x] **GitHub**: fine-grained token field (sealed), a repo allow-list, Test. Use the same token for the coder (no separate `GITHUB_TOKEN`).
- [x] `connections_status` returns the same states the UI shows.

---

## 6. UI redesign (pixel-precise, not "AI-generated")

**What makes the current UI read as AI-generated**: lavender gradients and purple everywhere, every block a rounded white card with the same shadow, mascots bobbing and wiggling, many equal-weight tiles with no clear first thing to look at, generic SaaS copy ("Hand a goal to your Mates"), the same 16 px radius on everything, and stat tiles with no context.

**Chosen direction (8 Nov 2026): "Clean multi-agent".** The mock-up is https://claude.ai/artifact/NvyrwAR6fkdxiqBrKRfqY9 (version 3 onward).
- White background with a soft blue blur behind the top of the page. One accent blue (#2F6BFF), slate text (#0F172A / #5B6474), Plus Jakarta Sans.
- **One job per screen.** Home asks one question ("What should your team work on?") in one composer. The composer shows which agents are on the task, as removable chips, plus a Chat / Run switch.
- **The agents are the interface.** "Your team" is a grid of agent tiles: a blue ring means working, an amber dot means it needs you, and tapping a tile adds that agent to the task.
- Only two small panels below: **Needs you** (answer in place) and **Working on it** (each run shows the agents on it as a stack of avatars, the hand-off "Research → Writer", and a thin progress bar).
- Everything else moves to its own page: timeline → Schedule, channels → Settings, run detail → Runs.

Earlier directions considered (kept for reference):

1. **"Switchboard, daylight"** (recommended; a one-screen mock-up is published for review: https://claude.ai/artifact/NvyrwAR6fkdxiqBrKRfqY9):
   - Look: a cool neutral background (#EDEEEA), ink-black 1 px structural rules instead of cards, 2–3 px radii. One signal blue (tweakable), with amber kept only for "needs you" and green lamps for "live".
   - Type: a wide industrial grotesk (Archivo, stretched) for headlines and UI, and JetBrains Mono for times, IDs and status.
   - Home opens with **one sentence that states the day** ("Two things need you. Three runs are moving. Next up at 16:00."), then:
     - the things that need you (approvals and questions, answerable in place)
     - the day as one timeline with a now-line
     - runs as a ledger with step bars
   - The right side is **the line**: an incoming call at the top, then the team as a switchboard (status lamp, what each Mate is doing, a call button per Mate), then channel status.
   - Mascots are small and still, used like bylines. There's one composer at the bottom: Chat / Start a run / Call a Mate.
2. **"Switchboard, night"**: the same structure as a dark control room. Near-black, phosphor-green and amber signals, live meters for calls and runs. Good as the designed dark mode of option 1.
3. **"Notebook"**: soft graph-paper background, handwritten-style accents only on headings, sticky-note memories, and a chat that looks like a margin conversation. Friendly and personal, but harder to make dense.

Avoid on purpose: the purple-lavender palette, warm-paper + serif + clay (another overused AI look), gradient washes, left-border accent cards, emoji icons, bobbing mascots.

Tasks once a direction is picked:
- [x] Design tokens file (colour, type scale, spacing on a 4 px grid, radii, rules, motion), shared by the dashboard and mobile (`tokens.json` → CSS variables and the RN theme). *(design/tokens.json → node design/build-tokens.mjs writes dashboard/app/tokens.css and mobile/src/lib/tokens.ts.)*
- [~] Redo the **Call** screen first (the main feature), then Home, Chat, Runs, then the rest. *(Done: Home, Call, Chat start screen, Connections, Server, pairing, Settings notifications. Every other screen uses the new colours and font but keeps its old layout: Run detail, Studio, My Space, Knowledge, Skills, Tasks, Workflows, Automations, Files.)*
- [~] Every screen has designed states: empty, loading, error, offline server, and no permission. *(Done for the screens above, and the offline/unpaired states are global. The older screens still need theirs.)*
- [~] Dark mode designed, not inverted. Check contrast for WCAG AA. *(Dark palette designed in tokens.json and used by the phone. The dashboard is still light-only: many older screens hard-code white.)*
- [x] Remove the idle animations (bob, wiggle, shine). Keep motion only for state changes.
- [~] Rewrite UI copy to be specific (say what will happen, with numbers). *(New and redone screens use specific copy. Older screens not reviewed yet.)*
- [~] Visual review at 360, 768, 1280 and 1920 px widths against the mock-ups, before calling a screen done. *(Checked at 1440 and ~560 px with a headless browser (Home, Call, Connections, Runs, Chat, Agents). 360/768/1920 still to do, preferably on real devices.)*

---

## 7. Smaller fixes and gaps (from the review)

- [x] Mobile Settings: add display name, default thinking, show reasoning, brainstorm rounds and Telegram link.
- [x] Mobile chat:
  - Thinking chip: include medium and xhigh
  - hide "Thought process" when `showReasoning` is off
  - handle `/plan`, `/brainstorm` and `/ultracode` as commands like the dashboard does
- [x] Mobile dark mode: transcript bubbles hard-code `#fff`, and the Settings voice field has no text colour.
- [x] `mobile/app.json`: remove `newArchEnabled` (no longer valid in SDK 58), then run `npx expo install --fix` for the patch-version mismatches. *(newArchEnabled removed, expo install --fix run, splash moved into the expo-splash-screen plugin; expo-doctor 20/20.)*
- [x] After a deep-linked call, clear `reason` and `call`, so the next call to another Mate doesn't reuse them.

## 8. Autonomous multi-agent team (Nov 2026)

- [x] **Custom agents and a leader.** Create agents (name, job, role card, tools, picture) and delete them; built-in Mates can be removed and restored. Any agent can be made the leader (default Mimo): it is the first contact on chat, voice, Telegram and Discord, gets the delegation, watch and company tools and the leader playbook, and cannot be removed or switched off while it leads. *(`backend/src/api/roster.js`; dashboard Agents; phone Agents, Call and @mentions.)*
- [x] **Personal and shared memory.** Shared memory is used by every agent; personal notes belong to the agent that wrote them. Every chat, call and run teaches the agents automatically. *(`memory.js`; dashboard Memory → Shared / Personal notes.)*
- [x] **Knowledge graph.** The same learning pass extracts people, teams, projects, places and preferences and how they connect. One-value relations (reports_to, lives_in…) replace the old value and keep it as history. Tools `graph_search`, `graph_query`, `graph_link`. *(`graph.js`; dashboard Memory → Graph, with merge and forget.)*
- [x] **Prompt lists, tools load.** The system prompt lists only the names of the skills, MCP servers, memory and graph an agent may reach; it loads details with `skill_load`, `mcp_tools`/`mcp_call`, `memory_recall`, `graph_*`. Per-agent access (Agents → Configure → Access) is enforced on the server. *(`reach.js`.)*
- [x] **MCP servers work.** HTTP and stdio (a command on your computer) servers are verified and called; headers and environment variables are stored encrypted.
- [x] **Coding harnesses.** Claude Code, Codex or OpenCode do coding steps under the Code Mate's supervision: brief with acceptance criteria → harness works → diff and test command checked → review → sent back with feedback (up to 3 rounds) → one commit and a PR. Runs in Docker (`docker/harness.Dockerfile`) or on the computer with a scrubbed environment. Connections → Coding harness has a Test button. *(`coder/harness.js`, `coder/index.js`.)*
- [x] **Jarvis mode.** The leader watches runs and approvals, deadlines and the calendar by default, plus topics and GitHub repos you name. Events are scored 1-5: digest, message, message with a call link, or a voice call. Calls are capped per day and respect quiet hours. "Call me at 6 about X" schedules a call reminder. Optional morning briefing (message or call). *(`watch.js`; Home → Keeping watch.)*
- [x] **Company layer.** People directory (CSV import, org chart), teams, assignments for people, check-ins on Telegram (drafts you approve unless you allow them), standup/weekly digests, meeting notes → assignments. Employees `/join` the bot and get a restricted assistant: their own work, and only Knowledge marked Company. A daily AI budget caps employee chats. *(`company.js`; dashboard Company.)*
- [ ] **(Needs you)** Run a real job with Codex and OpenCode (both are installed on this computer) and with Claude Code once installed; build the Docker image and try Docker mode.
- [ ] **(Needs you)** A real "call me in 5 minutes" reminder, a topic watch over a few days, and one test employee on Telegram.
- [ ] Employees on Discord (only Telegram is wired for `/join` and check-ins).
- [ ] Phone screens for Memory, the graph, Company and the Leader panel (dashboard only for now).
- [ ] Visual review of the new dashboard screens (Memory, Company, Leader panel, Coding harness, New agent) at 360/768/1440 px.

## 9. Distinct Mates and integrations (Nov 2026)

- [x] **Each Mate sounds like itself.** Role cards have How you work, Voice, Ends with, In a brainstorm, Team and Sign-off. Owners can set a personality and a call voice per agent; custom agents get a spare voice and a starter card. Run files and reports use the same card. *(`prompts/agent-system-prompt.md`, `prompt.js` `cardFor`/`briefPersona`/`signoffFor`, `mates.js` `voiceFor`.)*
- [x] **Agent journals.** Feedback on a Mate's work is saved as its personal note and followed every time. *(memory mining prompt; Agents → Configure → Journal.)*
- [x] **Voice preview** in Agents → Configure (Gemini TTS, `voice/preview.js`).
- [x] **Weekly stand-up**: every busy Mate writes one line in its own voice. *(`watch.js` `runStandup`; Home → Watch settings; `team_standup` tool.)*
- [x] **Integrations**: Obsidian, Notion, Google Calendar + Gmail drafts, Slack (Socket Mode), WhatsApp Cloud API, Todoist, Linear, Spotify, RSS & YouTube, Health, Home Assistant. Each is set up in Connections with a Test. *(`backend/src/integrations/`.)*
- [x] Watch kinds `feed` and `home`; Slack and WhatsApp as notification channels; `@name` on Telegram, Slack and WhatsApp.
- [ ] **(Needs you)** Try each integration with a real account: Slack app from the manifest, WhatsApp webhook on a named tunnel, Spotify sign-in, Notion/Todoist/Linear tokens, Home Assistant token, Google sign-in again with Calendar and Gmail.
- [ ] Hear the voice previews and a call with an owner-picked voice; check the Mates really sound different with a live model.
- [ ] Phone: Health Connect / Apple Health sync from the app (needs a native module and a new build); until then, a phone automation posts to `/health/ingest`.
- [ ] Phone screens for the new Connections, Journal and stand-up (dashboard only for now).
- [ ] Visual review of Connections → Apps, Agents → Journal / voice preview, and the stand-up settings at 360/768/1440 px.
- [ ] Deep-research harness (datasheets, patents, claims): see `future-idea.md`.

## 10. Calls on a timer and Python for agents (Nov 2026)

- [x] `python_run` (Code Interpreter group: Data, Code, Byte): a throwaway folder, input files in, output and new files out. Docker (no network unless asked, `PY_IMAGE`, `docker/python.Dockerfile` for pandas) or a scrubbed process. Needs approval. *(`api/python.js`.)*
- [x] `schedule_call`: any Mate sets a call timer; its context (chat, run, memories) is saved as a snapshot and loaded into the Gemini Live call; it rings as that Mate. `call_cancel`; "Calls coming up" with Cancel on the Call screen. *(`calls.js` `scheduleCall`/`ringCall`/`callSnapshot`, scheduler job kind `call`.)*
- [x] Any Mate can call for your opinion; inside a run `call_me` waits for the answers.
- [x] After a call: report plus condensed transcript join the Mate's chat as history, follow-ups become tasks, a live run is steered with the answers, and feedback goes to the Mate's journal.
- [x] Call reminders made with `calendar_add` ring as the Mate that set them; "Call {Mate}" in chat carries the chat's snapshot.
- [ ] **(Needs you)** A real scheduled call end to end with Gemini Live; build `loopmates-python` and try `python_run` in Docker.
