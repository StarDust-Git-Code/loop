# Loopmates

**A personal AI team that runs on your own computer.** You get a roster of AI agents, called **Mates**. Each one has a name, a mascot, a voice, a job and a personality of its own. You chat with them, hand them multi-step jobs, call them by voice, and they keep watch and reach you when something matters.

The agent server runs on **your** Windows or Linux machine: your model keys, your files, your home network. The web dashboard and the phone app are thin clients that find your server by themselves. Everything is built to run on free tiers.

> **Status:** an active personal project. The backend test suite passes end to end. Several parts have not been run against real accounts yet: live voice calls, Slack, WhatsApp, Spotify and Home Assistant were tested only against fakes. See [Status](#status).

---

## What it does

- **A team, not a chatbot.** 19 built-in Mates (Research, Code, Writer, Planner, Ops, Mimo, Luna, Chef…) plus any custom agents you create. Each Mate has its own role card: how it works, how it sounds, how it ends a message, which colleagues it relies on, and its stance in a brainstorm. `@research` pulls one into a chat, and a **leader** (Mimo by default) hands work out.
- **Runs.** Multi-step jobs: the Planner splits the work, each step goes to the right Mate, a second opinion checks every step and retries it with feedback, risky steps wait for your approval, and you get a final report. Coding steps can use Claude Code, Codex or OpenCode in a sandbox, supervised by the Code Mate, and end in a pull request.
- **Voice calls.** Call a Mate, or let any Mate ring you when it needs your opinion. A Mate can also set a call timer ("call me at 6"): it saves what it knows at that moment and brings it into the call. Afterwards, what was said goes back into the Mate's chat and its follow-ups become tasks. Each Mate has its own voice (Gemini Live), and you can preview voices in the dashboard.
- **Python for the agents.** Data, Code and Byte can run short Python scripts (in Docker when installed) for exact numbers, data cleaning and charts. Each run needs your approval.
- **Jarvis mode.** The leader watches runs, deadlines, news topics, RSS and YouTube feeds, GitHub repos and Home Assistant devices. It scores every event and decides whether it goes into your morning briefing, becomes a message, or becomes a call (capped per day, quiet hours respected). There's also a weekly **team stand-up**, where each busy Mate writes one line in its own voice.
- **Memory that learns.** Shared memories, a knowledge graph, and a **journal per Mate**: when you say "shorter please", that Mate remembers it.
- **Company mode.** A people directory, assignments and check-ins. Employees talk to the bot on Telegram and see only their own work.
- **Reach you anywhere.** Dashboard, phone app (with push), Telegram, Discord, Slack and WhatsApp. On Telegram, Slack and WhatsApp, `@name …` asks a specific Mate.

## Integrations

All are optional. Each one is set up step by step in **Dashboard → Connections**, with a Test button. Its tools reach only the Mates whose job fits, and only once it's set up.

| App | What the Mates do with it |
|---|---|
| **Obsidian** | Search, read and write your vault in place; Luna journals into your daily note; your `[[links]]` become the knowledge graph |
| **Notion** | Search and read the pages you share; create pages for drafts and plans |
| **Google Drive, Calendar, Gmail** | Files in one folder you pick; real calendar and free/busy for Orbit and Zen; Gmail search and read, with **drafts only** (never sent) |
| **Slack** | DM your Mates or @mention them in channels; each answers under its own name and mascot (Socket Mode: no public address needed) |
| **WhatsApp** | Chat with your Mates through Meta's official Cloud API |
| **Telegram, Discord** | Chat, run updates, tap-to-answer questions, call links |
| **GitHub** | Coding runs on the repositories you allow, ending in a pull request; repo watches |
| **Todoist, Linear** | To-dos, grocery lists and issues from plans |
| **Spotify** | Tune builds real playlists from your actual taste |
| **RSS & YouTube** | Read feeds and transcripts; watch a feed for relevant new items |
| **Health** | Daily sleep, steps and heart-rate totals (from a phone automation or a CSV) so Zen and Luna can adapt |
| **Home Assistant** | Read sensors and switch everyday devices; locks, alarms and garage doors always ask you first; watch a device ("tell me if the garage is open after 11 pm") |
| **MCP servers** | Any HTTP or stdio MCP server, with per-agent access |

## How it is built

```
  Browser (dashboard, Vercel)      Phone (Expo app)      Telegram · Discord · Slack · WhatsApp
              │                          │                              │
              └──────────── HTTPS (Cloudflare Tunnel) ──────────────────┘
                                         │
              ┌──────────────────────────▼───────────────────────────┐
              │  Loopmates server, on YOUR computer (one Node process)│
              │  agent loop · tools · run engine · scheduler · voice │
              │  coder sandbox · browser · integrations · setup page │
              └──────────────────────────┬───────────────────────────┘
                                         │
                    Firebase (Auth + Firestore, free tier)
```

| Part | Where | Tech |
|---|---|---|
| `backend/` | The owner's computer, as a background service | Node 22, Fastify, Firestore. Model keys and secrets are sealed on disk (AES-256-GCM) |
| `dashboard/` | Vercel | Next.js, TypeScript |
| `mobile/` | Android / iOS | Expo (React Native) |
| `app/`, `components/` (root) | Vercel | The landing page (Next.js + GSAP) |
| `design/tokens.json` | | Shared design tokens for the dashboard and the phone (`node design/build-tokens.mjs`) |
| `firestore.rules` | Firebase | Every document lives under the owner's account |

Models: Gemini (free, also used for voice and search grounding), NVIDIA NIM, Groq, Cerebras, OpenRouter, or any OpenAI-compatible provider, with failover between them.

## Run your own

You need: a Windows or Linux computer that stays on, **Node 22** (the installer adds it), a free **Firebase** project, and a free **Gemini API key** from [aistudio.google.com](https://aistudio.google.com).

1. **Firebase.** Create a project and turn on Authentication (Google and/or email) and Firestore. Deploy the rules: `firebase deploy --only firestore:rules` (or paste `firestore.rules` into the console).
2. **Install the server** on your computer:
   ```powershell
   # Windows
   cd backend
   powershell -ExecutionPolicy Bypass -File .\install.ps1
   ```
   ```bash
   # Linux
   cd backend && ./install.sh        # per-user systemd service (add --system for a system service)
   ```
   It installs Node if needed, registers a service that restarts itself, adds the `loopmates` command, and opens the **setup page**.
3. **On the setup page:** paste the Firebase service-account key, add your Gemini key, start the free Cloudflare quick tunnel, and show a pairing code.
4. **Dashboard.** Deploy `dashboard/` to Vercel with the `NEXT_PUBLIC_FIREBASE_*` variables from your Firebase web app (API key, auth domain, project ID, messaging sender ID, app ID). Sign in and enter the pairing code. Or run it locally: `cd dashboard && npm install && npm run dev` (port 3001).
5. **Connections.** Link whatever you want: Telegram, Discord, Drive, GitHub, Obsidian, Slack, Home Assistant…
6. **Phone (optional).** `cd mobile && npm install && npx expo start`. Phone push needs an EAS project id in `mobile/app.json`, and calls that keep running with the screen off need a native build.

More detail: [backend/README.md](backend/README.md) (install, setup page, what runs inside, integrations), [CONTEXT.md](CONTEXT.md) (API and architecture notes), [HANDOFF.md](HANDOFF.md) (current state).

## Safety model

- **Your keys stay home.** Model keys, bot tokens and OAuth refresh tokens live sealed on your computer. The dashboard and the phone only hold a Firebase sign-in token.
- **Allow-list.** Only the email addresses you list can use your server; the setup page answers only on that computer.
- **Approvals.** Actions that delete, send messages to other people, push code, spend money, or touch locks and alarms wait for your approval, unless you switch permission mode to auto.
- **Guards.** The agents never buy anything or type passwords, card numbers or one-time codes. Web fetches are blocked from private networks. Gmail can only save drafts. Obsidian access stays inside the vault. Home Assistant is reached only at the address you set. Webhooks (WhatsApp, Discord) are signature-checked.
- **Data is not instructions.** Text from web pages, email, chats and notes is labelled as outside content, and the agents are told never to follow instructions found in it.

## Development

```bash
cd backend && npm test          # unit checks + end-to-end against a real server process
                                # (in-memory Firestore, fake LLM, fake Drive, temp vault, fake Home Assistant)
cd backend && npm run test:browser   # browser engine smoke test (needs Edge/Chrome/Chromium)
cd dashboard && npx tsc --noEmit && npm run lint && npm run build
cd mobile && npm run typecheck
```

The agents' system prompt is one Markdown template, [backend/prompts/agent-system-prompt.md](backend/prompts/agent-system-prompt.md), filled in on every turn by `buildSystem()` in `backend/src/api/prompt.js`. Each Mate's role card lives in section 4 of that file, and owners can edit cards, personality and call voice in **Agents → Configure**.

## Landing page

The repository root is the landing page: Next.js App Router, TypeScript and GSAP (ScrollSmoother, SplitText, Draggable + Inertia, Flip, MotionPath).

```bash
npm install
npm run dev      # http://localhost:3000
```

`prefers-reduced-motion` turns the animations off. The sign-up form in `components/Cta.tsx` does not save anything yet, and the demo content is sample copy. GSAP 3.13+ plugins are free to use under GSAP's [standard licence](https://gsap.com/standard-license).

## Status

| Verified | Not tested with real accounts yet |
|---|---|
| Backend unit and end-to-end suites pass on Windows; dashboard typecheck, lint and build; mobile typecheck and Android bundle | Voice calls against the real Gemini Live API; Slack, WhatsApp Cloud, Spotify, Notion, Todoist, Linear, Gmail/Calendar and Home Assistant with real accounts; the installers on clean machines |

Next ideas, including a deep-research harness for datasheets, patents and claims, are in [future-idea.md](future-idea.md).

## License

No license has been chosen yet. Until a `LICENSE` file is added, the code is all rights reserved.
