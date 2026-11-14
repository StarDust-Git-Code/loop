# Loopmates: a personal AI team, powered by Gemini

**Submission for Build with Gemini, Chennai (MLH), Nov 14–15, 2026. Track: Best Use of the Google Gemini API.**

Loopmates is a team of 19 AI agents, called **Mates**, that runs on your own computer. Each Mate has a name, a mascot, a job, a personality and **its own Gemini voice**. You chat with them, give them multi-step jobs, and **call them on the phone**. They keep watch for you and get in touch when something matters.

Built with Gemini and Claude.

---

## Where Gemini is used

| Feature | Gemini API | What it does |
|---|---|---|
| **Voice calls with your Mates** | Gemini **Live API** (`BidiGenerateContent` over WebSocket) | Real-time, two-way voice calls from the browser or phone. The server picks the newest Live model your key can use. Each Mate gets a distinct prebuilt Gemini voice. A Mate can also ring *you* when it needs your opinion, or call you at a set time ("call me at 6"). After the call, the transcript goes back into that Mate's chat and its follow-ups become tasks. |
| **Voice previews** | Gemini **TTS** (`gemini-2.5-flash-preview-tts`) | Hear each Mate's voice in the dashboard before you pick one. |
| **The agents' brain** | **Gemini 2.5 Flash** through the OpenAI-compatible endpoint | Chat, planning, tool calling, step checking and the final reports. |
| **Web search** | Gemini with **Google Search grounding** | Research and Scout look things up with grounded, cited answers. |
| **Memory** | **`gemini-embedding-001`** | Semantic search over shared memories, each Mate's journal and its lessons. |
| **Deep research** | Gemini's long context | Reads uploaded PDFs, datasheets and patents. It pulls out values with quotes, and the program checks every quote against the source page before anything reaches the report. |

## What the Mates can do

- **Runs:** the Planner splits a job into steps and hands each step to the right Mate. A second Mate checks each step and sends it back with feedback when it falls short. Risky steps wait for your approval, and you get a final report.
- **Jarvis mode:** the leader Mate watches deadlines, news, RSS, YouTube, GitHub and Home Assistant. It decides whether each event goes into your morning briefing, becomes a message, or becomes a phone call (with a daily cap and quiet hours respected).
- **Memory that learns:** say "shorter please" and that Mate remembers it.
- **Self-improvement (built this weekend):** when the PC is idle, every Mate reviews its own recent mistakes (failed steps, work sent back, actions you refused). From that it writes **lessons** that go into its future prompts, and it can draft new **skills** for you to approve.
- **Deep research harness (built this weekend):** you get a report with verified tables (value, unit, conditions, source page), claim checks and patent claim charts. Anything that couldn't be verified against the source is listed under "Dropped" instead of being made up.
- **Reach you anywhere:** web dashboard, phone app (Expo), Telegram, Discord, Slack and WhatsApp.

## How it is built

```
 Browser dashboard (Next.js)    Phone app (Expo)    Telegram · Discord · Slack
              └───────────────── HTTPS ─────────────────┘
                                   │
         Loopmates server on YOUR PC (Node 22 + Fastify)
         agent loop · run engine · scheduler · tools
         voice relay ──► Gemini Live API
         LLM gateway ──► Gemini (+ failover)
                                   │
                    Firebase Auth + Firestore
```

- **Backend:** Node 22, Fastify, Firestore. Keys are sealed on disk with AES-256-GCM.
- **Dashboard:** Next.js. **Mobile:** Expo / React Native.
- **Safety:** never buys anything, never types passwords, treats web pages as data rather than instructions, respects robots.txt, guards against SSRF, and asks for approval before risky actions.
- **Also works with other providers:** any OpenAI-compatible API (OpenRouter, Groq, local Ollama…) can be added as a fallback. Gemini is the default.

## Run it

```bash
cd backend
npm install
echo "GEMINI_API_KEY=your-key" >> .env   # the one key you need
npm start                                # then open the setup page it prints
```

Tests: `node scripts/unit.mjs` and `node scripts/e2e.mjs`.

## Built during the hackathon

Loopmates started before this event. New this weekend:
- Nightly self-review: lessons and self-written skills (`backend/src/api/reflect.js`)
- Deep research harness with quote verification (`backend/src/research/`)
- Unit and end-to-end tests for both
- README updates

## Challenges

- Keeping voice calls natural while a Mate still has its own memory and personality.
- Stopping the model from making up numbers in research reports. The fix is that the program, not the model, checks every quote against the page it came from.
- Keeping a Mate's self-written lessons from turning into unsafe instructions. They are filtered, and new skills wait for the owner's OK.

## What's next

Live testing with real accounts, Discord for employees in Company mode, and dashboard screens for lessons and research reports.
