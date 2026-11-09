# Loopmates: context for the mobile app agent

Loopmates is an agentic AI workspace. A user has a roster of AI "Mates" (agents, each a mascot with a role). They chat with them, hand them multi-step tasks ("runs"), schedule things, keep memories, and now **call them by voice**. The web dashboard already exists. **Your job: build the mobile app** (a client of the same backend) with the screens listed under "What the mobile app must do".

Everything must run on free tiers. Do not add paid services.

## 1. Systems and URLs

| Piece | Where | Notes |
|---|---|---|
| Repo | `github.com/StarDust-Git-Code/loop`, branch `main` | Landing page at the root, dashboard in `dashboard/`, backend in `backend/` |
| Dashboard | Vercel, `dashboard-loopmates.vercel.app` | Next.js. Auto-deploys on push |
| **Server** | The owner's own computer (Windows or Linux), one process: `backend/src/server.js` | API, SSE, voice (`/live`), coder, Drive, browser, Telegram, Discord, scheduler. Reached through a Cloudflare Tunnel. See `backend/README.md` |
| Auth + DB | Firebase project `loop-mates` (Auth + Firestore) | Email/password and Google sign-in |

**Finding the server.** Its address is not fixed (a quick tunnel changes on restart). After sign-in, read `servers/{uid}` from Firestore (`{ url, lastSeen, commit, platform }`; only the owner can read it, see `firestore.rules`). The owner pairs once from the dashboard; every client of the same account then finds the server by itself. If a request fails, read the doc again before giving up. If the server is offline, say so with the last-seen time.

## 2. Auth

- Sign in with the Firebase Auth SDK (project `loop-mates`; the web config is in `dashboard/lib/firebase.ts` and the `NEXT_PUBLIC_FIREBASE_*` vars).
- Every API call sends `Authorization: Bearer <Firebase ID token>`. Refresh the token before it expires (`getIdToken()`).
- `GET /v1/auth/session` returns the signed-in user. 401 means sign in again.
- Never put a Firebase service account or any API key in the app. The app holds only the ID token. All model keys live on the servers.

## 3. REST API (base `<server url>/v1`, JSON)

Generic collections follow the same pattern: `GET /<name>`, `POST /<name>`, `GET|PATCH|DELETE /<name>/:id`.
Collections: `tasks`, `workflows`, `automations`, `knowledge`, `memories`, `skills`, `mcp-servers`, `connections`, `conversations`, `events`, `files` (no create here), `runs` (read only), `mates` (the roster and per-Mate config), `providers`.

Special endpoints:

| Method and path | Purpose |
|---|---|
| `GET/PATCH /settings` | Workspace settings (`displayName`, `defaultThinking`, `showReasoning`, `maxContextTokens`, `maxOutputTokens`, `brainstormRounds`, `allowNetwork`, `permissionMode`, ...) |
| `POST /conversations/:id/messages` | Send a user message. Body `{text, mate}`. Add `?stream=1` for Server-Sent Events (below) |
| `POST /runs` | Start a run `{prompt, workflowId?, askFirst?, title?}` |
| `GET /runs/:id/events` | SSE: live run log |
| `POST /runs/:id/steer` | Add an instruction to a live run `{text}` |
| `POST /runs/:id/approvals/:aid` | Approve or reject a step `{decision}` |
| `POST /files` | Multipart upload (field `file`, max 15 MB). Needs Drive (not configured yet, so it returns 501) |
| `GET /files/:id/content` | Download a file (authenticated) |
| `GET /knowledge/search?q=` | Search the Knowledge library |
| `POST /telegram/link-code` | Get a code to link Telegram (`/start CODE` to the bot) |

### Chat streaming (SSE)

`POST /conversations/:id/messages?stream=1` replies with `text/event-stream`. Each `data:` line is JSON:

- `{type:'start'}`: the user message was stored.
- `{type:'mate', mate, round?, summary?}`: a Mate is about to speak.
- `{type:'delta', text}`: append to that Mate's answer.
- `{type:'think', text}`: reasoning tokens (show in a collapsible "Thought process" if `settings.showReasoning`).
- `{type:'tool', name}` and `{type:'tool_result', ...}`: the Mate is using a tool (show a small chip).
- `{type:'reset'}`: discard the partial answer and start again.
- `{type:'round', n, of}`: brainstorm round marker.
- `{type:'done', message}`: the final stored message. Replace the partial text with `message`.

A `Message` is `{id, role:'user'|'mate'|'system', mate?, text, at, state:'sent'|'pending'|'error', thought?, round?, summary?}`. Mate text is Markdown (render it: bold, lists, tables, code).

A `Conversation` is `{id, title, mate, messages[], mode:'chat'|'plan'|'ultracode'|'brainstorm', rounds?, members?, thinking?:'default'|'low'|'medium'|'high'|'xhigh'}`.

Chat behaviours the app should support:
- `@name` in a message pings extra Mates (up to 3 answer in turn). `/plan`, `/ultracode`, `/brainstorm` change the chat mode.
- **Brainstorm mode**: with 2 or more Mates pinged, they hold a multi-round round table, then a summary message (`summary:true`) is posted. Show "Round N" dividers and a highlighted summary card with a "Save to memory" button (`POST /memories {kind:'decision', text, scope:'private'}`).
- A per-chat Thinking level (`low|medium|high|xhigh|default`).

## 4. Voice calls (the main new feature)

**`backend/src/voice/index.js`** is mounted on the same server at `/live`. It is a WebSocket relay between the phone and Gemini's Live API. The Gemini key stays on the server.

**Connect:** `wss://<server host>/live?token=<Firebase ID token>&mate=<mateKey>&reason=<optional text>&greet=1`
- `reason` set: the Mate "called you" and opens by saying why. Otherwise `greet=1` makes it greet briefly.
- The server picks the newest Live-capable Gemini model for the key (or `VOICE_MODEL` if pinned).

**Client to server**
- Binary frames: **16 kHz, mono, PCM16 little-endian** microphone audio. Send about 100 ms chunks (3,200 bytes).
- Text frames: `{"type":"text","text":"..."}` to inject typed text, `{"type":"end"}` to hang up.

**Server to client**
- Binary frames: **24 kHz, mono, PCM16** speech. Queue and play them back to back (schedule on an audio clock to avoid gaps).
- Text frames (JSON): `{type:'ready', mate, name, model}`, `{type:'transcript', who:'you'|'mate', text}` (partial chunks, append), `{type:'interrupted'}` (the user talked over the Mate: **stop and clear playback immediately**), `{type:'turn'}` (the Mate finished a turn), `{type:'error', message}`, `{type:'end', why}` (`hangup`, `silence`, `time limit`, ...).

**Limits:** 3 concurrent calls, 10 minutes per call, hangs up after 90 seconds of silence. Show these states plainly ("The line is busy", "Call ended after a long silence").

**Reference client:** `dashboard/lib/voice.ts` (AudioWorklet capture, resampling, playback queue, barge-in) and `dashboard/components/screens/Call.tsx` (UI). Port the same protocol natively.

Mobile specifics to handle:
- Microphone permission, echo cancellation on, route to speaker/earpiece, keep the screen awake and the app alive during a call (foreground service on Android, audio background mode on iOS).
- Handle a dropped network by ending cleanly and offering "Call again".
- **Mates calling the user:** the backend tool `call_me` rings through app push (web push and Expo push), Telegram and Discord with a link `<dashboard>/call?mate=<key>&call=<id>&reason=<text>`. The app opens the Call screen with those values. Phones register an ExponentPushToken with `POST /v1/devices {kind:'expo', token, label}`.

## 5. The Mates

19 Mates. `on` means enabled by default; the user can switch any on or off (`PATCH /mates/:key {enabled}`). Mascot images are in `dashboard/public/dots/<key>.png`.

| key | Name | Default | Role |
|---|---|---|---|
| research | Research | on | Finds information, analyses sources and keeps notes. |
| code | Code | on | Writes, reviews and runs code in a contained container. |
| planner | Planner | on | Breaks big jobs into steps and decides who does each one. |
| flow | Flow | on | Designs and edits your workflow canvas from a plain-language goal. |
| writer | Writer | on | Produces reports, scripts and drafts in your voice. |
| browser | Browser | on | Drives a browser to read pages and fill in forms. |
| ops | Ops | on | Coordinates operational tasks, files and approvals. |
| mimo | Mimo | off | Your private second brain: memories, reminders and a daily plan. |
| orbit | Orbit | off | Plans your week and moves things around when plans change. |
| recall | Recall | off | Finds anything in your memories, files and sources. |
| spark | Spark | off | Brainstorms ideas and turns rough thoughts into clear ones. |
| zen | Zen | off | Protects your focus time and keeps breaks on the calendar. |
| luna | Luna | off | Reflects on your day and keeps a journal. |
| scout | Scout | off | Explores topics and places, builds reading lists. |
| chef | Chef | off | Plans meals, grocery lists and routines. |
| tune | Tune | off | Handles audio and music tasks, playlists and notes. |
| data | Data | off | Cleans data, builds tables and charts and explains them. |
| byte | Byte | off | Specialist for long coding jobs with checkpoints. |
| halo | Halo | off | Reviews risky actions and asks for your approval. |

Agents use native tool calling (86 tools: web search with Gemini Google grounding, files, memory, calendar, tasks, run monitoring and control, workflows, delegation, utilities). All of that is server side; the app only displays `tool` events as chips.

## 6. What the mobile app must do (priority order)

1. **Sign in** (Firebase email/password and Google) and keep the session.
2. **Call screen** (top priority): pick a Mate, dial, live transcript, mute, hang up, a pulsing avatar that reacts to mic level, call timer, clear error and busy states, deep link entry with `mate` and `reason`.
3. **Chat**: conversation list, streaming replies (SSE) with Markdown, "thought process" fold, tool chips, `@` mention picker, slash commands, mode and thinking selectors, brainstorm rounds and summary card.
4. **Attachments in chat**: text and code files up to 60 KB are pasted into the message as a fenced block (works without Drive). Other files use `POST /files` and show a clear message when storage is not set up (501). Add photos and camera as a later step: they need storage first.
5. **Home** (what should Loop do today), **Tasks**, **Schedule** (events and reminders), **My Space** (memories), **Runs** (start, live log, approve, steer, stop).
6. **Settings**: display name, default thinking level, show reasoning, brainstorm rounds, Telegram link code.

Keep the web look (clean multi-agent): white, one blue accent `#2F6BFF`, tint `#EAF1FF`, slate text `#0F172A` / `#5B6474`, thin `rgba(15,23,42,.12)` borders, Plus Jakarta Sans, mascots as avatars. All values come from `design/tokens.json` (`node design/build-tokens.mjs` writes the dashboard CSS and the mobile theme).

## 7. Known gaps and honest caveats

- **Voice has not been tested against the real Gemini Live API with a real microphone**, in either direction. It was tested against a fake upstream.
- Google Drive, Telegram, Discord and GitHub each need the owner to follow the steps in Dashboard → Connections once.
- Phone push needs an EAS project id in `app.json` (`extra.eas.projectId`); without it the app still checks runs every 15 minutes.
- The dashboard is light-only for now; the dark palette is ready in `design/tokens.json` and used by the phone.
- Provider-specific reasoning parameters and native tool calling were written from documentation and are untested against every provider.

## 8. Where to read more

`HANDOFF.md` (setup state), `dashboard/BACKEND.md` (API shapes), `backend/README.md` (install, setup page, what runs inside, tests), `dashboard/lib/types.ts` (all TypeScript types, the best schema reference), `dashboard/lib/api/http.ts` (a working REST and SSE client), `backend/scripts/e2e.mjs` (executable examples of every endpoint, run with `npm test` in `backend/`).

## Intelligence layer (added)
- **Memory**: `backend/src/api/memory.js` + `vec.js`. Chats are mined in the background for durable facts ("User likes Genshin Impact"); recall is semantic (Gemini/NVIDIA embeddings, int8 vectors stored on the doc, keyword fallback). Knowledge chunks are embedded at index time. Toggle: Settings > autoMemory.
- **Runs**: each step is verified (cheap second opinion) and retried with feedback; a failed run gets a written failure report, per-step errors, a Log tab and a Retry button that resumes from the failed step (`POST /v1/runs/:id/retry`).
- **Call missions**: `call_me({reason, goal, questions})` creates `users/{uid}/calls/{id}`; the voice service runs a Gemini Live sub-agent with that mission, it files the result via `finish_call`, and `calls.js:wrapUp` writes the report to the chat, Telegram and Discord. Agents read it with `call_report`.
- **Discord**: `discord.js`, over the Gateway (an outgoing WebSocket; slash commands /link /ask /run /status, and buttons). Set up in Dashboard → Connections → Discord.
- **Telegram and Discord chat** now run the real Mate (tools + memory) via `bridge.js`.
- **Files**: work without Drive (small files stored inline, <= 700 KB); connect Drive for larger files.

## Browser (added)
`backend/src/browser/` runs inside the server and starts on first use (engines: `engine-playwright.js` for x86_64/arm64, using Edge/Chrome on the computer or Chromium installed from the setup page; `engine-webdriver.js` Firefox for s390x/IBM LinuxONE; shared `guard.js`, `snap.js`). Pooled instances, isolated sessions, SSRF guard, password-field refusal. `backend/src/api/browsertools.js` exposes it to Mates as `browser_*` tools.

## Autonomous team (added, Nov 2026)
- Custom agents and a leader (`settings.leader`, default `mimo`): `GET /v1/mates/roster`, `POST /v1/mates`, `DELETE /v1/mates/:key` (built-ins are hidden, restorable with `POST /v1/mates/:key/restore`). Agent keys are lowercase letters and digits; treat any key as valid, and fall back to the leader for unknown ones.
- Memory scopes (`shared` / `personal` + `mate`) and a knowledge graph: `GET /v1/graph`, `DELETE /v1/graph/nodes/:id`, `POST /v1/graph/merge`.
- Per-agent `access` on the mate config: `{ memory: {personal, shared}, graph, skills, mcp, knowledge }`.
- Coding harness: `settings.coderHarness`, `settings.coderSandbox`, `GET /v1/coder/harnesses`, `POST /v1/coder/test`.
- Jarvis mode: `GET /v1/leader`, `/v1/watches` (CRUD), `POST /v1/watches/:id/check`, `POST /v1/leader/briefing`; calendar events accept `deliver: 'call'`.
- Company: `/v1/people`, `/v1/teams`, `/v1/projects`, `/v1/assignments`, `/v1/checkins` (CRUD), `POST /v1/people/import {csv}`, `POST /v1/people/:id/invite`, `POST /v1/checkins/:id/send`, `GET /v1/company/overview`. Knowledge items with `company: true` are what employees may be told.

## Single server, prompts and asking (added, Nov 2026)
- One process (`backend/src/server.js`) replaces the five Render services. No service-to-service HMAC; the coder, Drive and browser are function calls.
- The agents' system prompt is `backend/prompts/agent-system-prompt.md`, filled per turn by `buildSystem()` (`src/api/prompt.js`): only the speaking Mate's role card, plus connections, server, surface and run context. A small context window gets a compact version. Owners can edit each Mate's role card in Agents.
- **Each Mate sounds like itself.** Every role card has `How you work`, `Voice`, `Ends with` and `In a brainstorm` lines. The shared "Your character" section only holds rules every Mate shares. `cardFor()` in `prompt.js` builds the card: the owner's edited card, else the built-in one, else a starter card for a custom agent, plus an optional owner `personality` line that overrides the Voice. Run files, final reports and failure reports use `briefPersona()`, which carries the same card. Call voices come from `voiceFor()` in `mates.js`: the owner's `voice` pick, else the built-in voice, else a spare voice no built-in uses (custom agents). Telegram replies are signed with the agent's name, and `@name message` on Telegram asks that agent.
- **Integrations** (`backend/src/integrations/`): `GET /v1/integrations` (descriptors: steps, fields, ready, note, manifest, webhookUrl, oauth, linkCode, ingestUrl), `POST /v1/integrations/:key/test`, `POST /v1/integrations/:key/link-code` (Slack `slack`, WhatsApp `wacloud`: then "link CODE" in the chat), `GET /v1/integrations/spotify/start`, `POST /v1/integrations/obsidian/sync`. Health: `POST /v1/health {days}`, `POST /v1/health/import {csv}`, `POST /v1/health/key`, public `POST /health/ingest` (Bearer ingest key). Public webhooks: `GET|POST /whatsapp/webhook` (Meta signature), `GET /spotify/oauth/callback`. Tool groups: Notes, Google, Team Chat, Task Apps, Music, Feeds, Health, Home. Watch kinds `feed` (config.url) and `home` (config.entity + state/above/below, forMinutes, score).
- **Team features:** `POST /v1/leader/standup`, `GET /v1/standups`, settings `standupOn/standupDay/standupAt`, `notifySlack`, `notifyWhatsapp`. `GET /v1/voice/preview?mate=&voice=&personality=` returns `audio/wav`. Role cards have `Team:` and `Sign-off:` lines; `notify_me` appends the sign-off.
- `ask_owner`: a Mate asks a multiple-choice question; it appears in Home → Needs you, as push, and as Telegram/Discord buttons. In a run, the step waits for the answer or uses the default on timeout. API: `GET /v1/questions`, `POST /v1/questions/:id/answer`.
- Notifications: `notify_me` and `call_me` go to app push + Telegram + Discord as the owner chose, always land in `GET /v1/inbox`, and respect quiet hours (Settings).

