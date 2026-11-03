# Loopmates: context for the mobile app agent

Loopmates is an agentic AI workspace. A user has a roster of AI "Mates" (agents, each a mascot with a role). They chat with them, hand them multi-step tasks ("runs"), schedule things, keep memories, and now **call them by voice**. The web dashboard already exists. **Your job: build the mobile app** (a client of the same backend) with the screens listed under "What the mobile app must do".

Everything must run on free tiers. Do not add paid services.

## 1. Systems and URLs

| Piece | Where | Notes |
|---|---|---|
| Repo | `github.com/StarDust-Git-Code/loop`, branch `main` | Landing page at the root, dashboard in `dashboard/`, backend in `backend/` |
| Dashboard | Vercel, `dashboard-loopmates.vercel.app` | Next.js. Auto-deploys on push |
| API | Render, `https://loopmates-api-82ub.onrender.com` | Fastify. `/healthz` returns `{ok, service, commit, uptime, mem}` |
| Coder | Render (separate service) | Runs coding jobs in a sandbox |
| Artifacts | Render (separate service) | Stores files in the owner's Google Drive (not set up yet) |
| **Voice** | Render, `backend/render.voice.yaml` (new, **must be created by the owner**) | WebSocket relay to Gemini Live. URL goes in `NEXT_PUBLIC_VOICE_URL` |
| Auth + DB | Firebase project `loop-mates` (Auth + Firestore) | Email/password and Google sign-in |

Free-tier Render services sleep after inactivity: the first request can take about a minute. Show a "waking up" state and retry. Do not treat it as a failure.

## 2. Auth

- Sign in with the Firebase Auth SDK (project `loop-mates`; the web config is in `dashboard/lib/firebase.ts` and the `NEXT_PUBLIC_FIREBASE_*` vars).
- Every API call sends `Authorization: Bearer <Firebase ID token>`. Refresh the token before it expires (`getIdToken()`).
- `GET /v1/auth/session` returns the signed-in user. 401 means sign in again.
- Never put a Firebase service account or any API key in the app. The app holds only the ID token. All model keys live on the servers.

## 3. REST API (base `https://loopmates-api-82ub.onrender.com/v1`, JSON)

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

A separate Render service, **`backend/src/voice/index.js`**, keeps audio load off the other three. It is a WebSocket relay between the phone and Gemini's Live API. The Gemini key stays on the server.

**Connect:** `wss://<voice-service>/live?token=<Firebase ID token>&mate=<mateKey>&reason=<optional text>&greet=1`
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
- **Mates calling the user:** the backend tool `call_me` sends a Telegram message with a link `<dashboard>/call?mate=<key>&reason=<text>`. In the app, register that link (deep link or universal link) so tapping it opens the Call screen and dials with that `mate` and `reason`. Push notifications (FCM) are an optional upgrade: add a device-token endpoint if you build it.

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

Keep the web look: purple accent `#6A4DF4`, tint `#ECE7FF`, deep text `#1B1822`, muted `#6B6572`, white cards with a thin `rgba(31,26,23,.14)` border, rounded 16 px corners, mascot images as avatars.

## 7. Known gaps and honest caveats

- **Voice has not been tested against the real Gemini Live API or a real microphone.** It was tested against a fake upstream. The model choice is automatic; the owner can pin `VOICE_MODEL`.
- **Google Drive (Artifacts) is not set up**, so file upload returns 501 until the owner finishes the OAuth steps. Images cannot be attached yet.
- **Telegram is not linked**, so reminders and `call_me` messages cannot be delivered until the owner links it.
- Provider-specific reasoning parameters and native tool calling were written from documentation memory and are untested against every provider.
- The Vercel `NEXT_PUBLIC_*` variables, the cron-job.org keep-alive pinger and key rotation are still on the owner's to-do list (`HANDOFF.md`).
- The owner is rewriting the Mates' system prompts by hand. Do not hard-code prompts in the app.

## 8. Where to read more

`HANDOFF.md` (setup state), `dashboard/BACKEND.md` (API shapes), `backend/README.md` (services, env vars, tests), `dashboard/lib/types.ts` (all TypeScript types, the best schema reference), `dashboard/lib/api/http.ts` (a working REST and SSE client), `backend/scripts/e2e.mjs` (executable examples of every endpoint, run with `npm test` in `backend/`).
