# Loopmates — Project Handoff

Last updated: 2026-11-02 · Owner: Star (Irshad Ahamed S.) · Repo: https://github.com/StarDust-Git-Code/loop (`main`)
Status: landing page built and pushed; dashboard exists only as design (Claude Design artifact). No backend or product code yet.

---

## 1. What it is
An agentic AI workspace. You describe a job in plain language; specialist agents plan, research, browse, code and write, while you watch every step and approve risky actions. You get real files back (reports, sources, tables, scripts, media).

- **Brand:** Loopmates (logo: two linked loops + "loopmates" wordmark). The agents are called **Mates** (renamed from "Dots"). In-app copy still says "Loop" in places; decide whether the product is "Loop" or "Loopmates".
- **Domains (placeholders, not registered):** `loopmates.com` (landing), `dashboard.loopmates.com` (app). Search showed a company called "Loopmates"; run a domain/trademark check before committing.
- **Tagline in use:** "A workspace for your fluffy agents." / "Build agents. Connect intelligence. Get work done."
- **18 Mates:** Core: Planner, Research, Code, Writer, Browser, Ops. Personal: Mimo, Orbit, Recall, Zen, Luna, Chef. Creative: Spark, Tune, Scout. Dev: Byte, Data, Halo. (Keys/roles/categories in `lib/dots.ts`.)

**Product pillars (design only):** Agent Studio (node canvas), integrated workspace (browser/terminal/files), knowledge + memory (graph, RAG, citations), skills/MCP/harness (permissions, approvals), chat modes (Chat, Plan, Ultracode, `/btw`), connections (selected WhatsApp chats read-only, Telegram pings), tasks, automations (content studio), My Space (private second brain with Mimo).

---

## 2. Landing page (this repo)
Next.js 16 (App Router, TypeScript), plain global CSS, GSAP 3.15 (all plugins), `@gsap/react`, fontsource fonts (Plus Jakarta Sans, Inter, JetBrains Mono).

**Run:** `npm install && npm run dev` (build: `npm run build && npm start`).

**Sections (in order):** Nav (glass pill) → Hero (headline with two swinging Mates, infinite Mate rail) → Marquee → Demo → Features → Mates grid → My Space → Automations → Safety → CTA → Footer.

| Piece | How it works |
|---|---|
| Smooth scroll | ScrollSmoother, created first in `SmoothSetup`. Also drives progress bar and nav hide/show. |
| Hero headline | SplitText line-mask reveal with blur→sharp. Two Mates hang on strings under line one and swing (pendulum + poke kick). Hidden on phones. |
| Mate rail | `DotRail.tsx`: list rendered 3x, hidden Draggable proxy + InertiaPlugin, wrapped position = infinite loop; arrows, keys, drag/throw. |
| Demo | `Demo.tsx`: section pins; scroll scrubs a timeline. Real dashboard screens (Home → Chat → Run → finished Run) with a fake cursor that clicks, types and approves; whole screen shown scaled to fit (no crop). Step bar + description above. |
| Dashboard screens | `lib/dashScreens.ts` is **generated** from the design files (`White-Home/Chat/Run.dc.html`) by converting the `.dc.html` templates to static HTML (generator lived in scratchpad, not committed). The "finished" Run screen is my edit of the running one. Regenerate if the design changes. |
| Mates grid | Flip filter by category; hover tilt, spotlight, neighbour dim; **hold 2s (or tap / Enter)** to expand a panel with details from `lib/dotInfo.ts`. |
| Automations | Pinned scroll conveyor: a token moves along 7 stages (Idea → Script → Image prompts → Images → Video → Review → Ping) with a preview card per stage. |
| De-blur | Reveals start blurred and sharpen; rail side cards slightly soft. |
| Reduced motion | `html.rm` class: no pinning/cursor, content shown static. |

**Key files:** `app/page.tsx`, `app/globals.css` (all styling), `components/*`, `lib/gsap.ts` (plugin registration), `lib/dots.ts`, `lib/dotInfo.ts`, `public/dots/*.png` (18 Mate cut-outs, 1200px, feathered edge + soft glow), `public/logo-mark.svg` + `app/icon.svg`.

**Design decisions:** white background, violet accent `#6A4DF4`, ink `#15121A`; no pill tags or arrow-icon eyebrows (Option C: headline only) to avoid a template look; centred hero modelled on the user's reference image.

---

## 3. Dashboard design (Claude Design artifact)
Artifact: https://claude.ai/artifact/39VavcTDyKL4ZaUkHnyeio (private). Page 1: 13 sand-theme screens. Page 2: Landing (old Claude Design version, superseded by this repo) + 13 white copies. **Sand vs white still undecided.** Screens: Agent Studio, Home, Chat, Run, Agents, Workflows, Knowledge, Skills/MCP/harness, Connections, Tasks, Automations, My Space, Schedule. Dashboard still says "Dot" in the artifact itself; only the landing copy was renamed.

---

## 4. Placeholders and open items
- Email signup in `Cta.tsx` does nothing (TODO). "Get started" / "Open dashboard" point at the placeholder domain.
- All demo content is sample: SkillCourt vs SmartCourt run, sources, stats, automation previews, Mate descriptions and example prompts. Features named (Ultracode, citations, MCP) describe planned product, not built software.
- Mate art is cut from the user's sheets with props; a few tiny floating bits (stars, notes, bubbles) were trimmed. Sheet-to-name mapping was matched by role; confirm (pink heart = Mimo, teal magnifier = Recall, red spiky = Research).
- Falling-Mates transparent video not made (prompt: solid #00FF00 background, 8–10s loop, 16:9, chroma-key to WebM alpha).
- Images total ~21 MB in `public/dots` (next/image resizes on delivery; compress if repo size matters).
- Tested in Chromium (desktop and 390px width) only; not Safari/Firefox. No automated tests.
- Rename the in-app/landing copy "Loop" → "Loopmates" if the product name changes; update the dashboard design too.
- Build phase not started: stack, backend, agent runtime, auth, billing all undecided.

## 5. Honest caveats
- **WhatsApp:** no official API for personal chats; any bridge is unofficial and risks account restrictions. Keep it read-only, opt-in per chat, clearly labelled.
- **ChatGPT / Google Flow browser automation** uses the user's own sessions; it can break with UI changes, hit limits/captchas and may conflict with those services' terms. Design pauses and pings the user; never stores passwords.
- **Privacy:** My Space is private by default; other Mates see only what the user shares.
- No pricing, customer logos, testimonials or real metrics have been invented. Keep it that way until they're real.

## 6. Working notes
- Dev/test happened in a scratchpad copy; the repo is the source of truth now. Commits end with the Claude co-author trailer.
- Sandbox lacks Google Fonts access (hence fontsource). Use `fuser -k 3111/tcp` to stop the local server, not `pkill -f`.
- After editing `Demo.tsx` timings, check scroll length (`end: +=4.6 × viewport`) and the cursor targets (`data-demo` attributes in `lib/dashScreens.ts`).
