# Loopmates film v2: script (draft 3, waiting for approval)

Voice-over: first person, short lines. No rival named. No ElevenLabs: the user records each line as an MP3 and the picture is cut to those files.

Recording: one MP3 per line, named by its ID (`L01.mp3` …). Leave about half a second of silence at each end. Times are targets; the cut follows the real takes.

Every feature is shown happening in the real product UI (dashboard, chat, run board, workflow canvas, browser, phone call, Telegram, Connections): cursor clicks, typing, cards moving, Mates reacting.

Draft 2 added custom Mates, failover, brainstorms, Python, the sandbox, everyday Mates, the stand-up, company mode and "data is not instructions" (★). Draft 3 adds section 6: tool calling, the Browser Mate, custom pipelines (Flow and the workflow canvas), schedules and MCP (◆).

## 1 · The problem (0:00–0:14)

| ID | Line | On screen |
|---|---|---|
| L01 | It's 2 a.m. | Dark room, laptop closed, clock ticks to 2:00 |
| L02 | My AI agent is working. Somewhere in the cloud. | A faceless cloud icon pulls files out of the laptop |
| L03 | With my passwords. On a model I don't control. | Password and key cards drift up into the cloud |
| L04 | And the bill? Two hundred dollars. Every month. | Invoice slides in, counter runs to $200 |

## 2 · The reveal (0:14–0:32)

| ID | Line | On screen |
|---|---|---|
| L05 | I didn't want another assistant. I wanted a second brain. | Cloud collapses into one glowing point on the laptop |
| L06 | So, we built Loopmates. | Logo mark, then the 19 real Mate images pop in a grid |
| L07 | Nineteen Mates. Each one a brain, with a name, a voice and a skill. | Cursor hovers Mates; each card flips to show its job |
| L08 ★ | Need one more? I make my own. | "New agent" form: name, job, voice picked; a custom card joins the grid |
| L09 | And they all live on one computer. Mine. | Grid folds into the laptop; server panel lights up |

## 3 · Setup (0:32–0:46)

| ID | Line | On screen |
|---|---|---|
| L10 | Setting it up takes one command. | Terminal types the install command, service starts |
| L11 | Add a free model key. Scan a code. That's it. | Setup page: key pasted, pairing code, dashboard connects |
| L12 ★ | If one model goes down, the next one takes over. All on free tiers. | Provider list; the top one greys out, the next lights up mid-reply |

## 4 · Chat and team (0:46–1:02)

| ID | Line | On screen |
|---|---|---|
| L13 | I talk to them like a team. | Dashboard chat opens |
| L14 | "@research, what's new in solar batteries?" | Typed message; Research answers with sources |
| L15 | Mimo leads. It hands the work to whoever fits. | Mimo passes task cards to Writer and Data |
| L16 ★ | Stuck on an idea? They brainstorm. Each one takes a side. | Three Mates post opposing takes; Mimo sums up |
| L17 ★ | Data runs the numbers in real Python. Exact, not guessed. | Approval tap, script runs, a chart draws |

## 5 · Runs (1:02–1:26)

| ID | Line | On screen |
|---|---|---|
| L18 | I say it once. "Add dark mode. Run the tests." | Typed request |
| L19 | Planner breaks it down. Research finds the way. Code makes the changes. Ops checks the build. | Run board: steps fill one by one, each Mate's face on its step |
| L20 ★ | The code runs in a sandbox, not on my files. | Code step opens in a sealed box; files change inside it |
| L21 | A second Mate checks every step. | A step flashes "retry", then passes |
| L22 | Something risky? Halo asks first. | Approval card on phone; thumb taps Approve |
| L23 | Tests green. A pull request, waiting. Nice. I wasn't even in the loop. | Green checks, PR card, final report |

## 6 · Tools, browser and pipelines (1:26–1:54) ◆

| ID | Line | On screen |
|---|---|---|
| L24 ◆ | They don't just talk. They use tools. Eighty-six of them. | A chat reply; tool chips stack up under it and the count runs to 86 |
| L25 ◆ | Search the web. Read my files. Set a reminder. Start a run. | Each chip lights as it's said: web search, files, reminder, run |
| L26 ◆ | Browser opens a real browser. Reads the page. Fills in the form. | Browser Mate's window: page scrolls, fields fill one by one |
| L27 ◆ | It stops at the password field. That one's mine. | Cursor reaches the password box; field locks, hands back to me |
| L28 ◆ | Same job every week? Flow builds the pipeline from one sentence. | Typed goal; workflow canvas draws itself, node by node, a Mate on each |
| L29 ◆ | I drag a step. Swap a Mate. Save. | Cursor drags a node, swaps Writer for Scout, clicks Save |
| L30 ◆ | Now it runs on a schedule. Every Monday, nine sharp. | Automation set to Mon 09:00; the canvas lights up and runs |
| L31 ◆ | Need a tool they don't have? Plug in an MCP server. Same Mates, new hands. | MCP server added; new tool chips appear on two Mates' cards |

## 7 · Memory and self-learning (1:54–2:16)

▲ Added in draft 4. Not found in the `loop` code yet (it has learning after each turn and `skill_load`, but no idle reflection or self-written skills). Confirm before final cut.

| ID | Line | On screen |
|---|---|---|
| L32 | What did I decide last week? Mimo remembers. | Knowledge graph grows; a past note lights up |
| L33 | "Shorter, please." Said once. Remembered. | Writer's journal gets the note; next reply is short |
| L33a ▲ | And when they're idle, they look back at their mistakes. | Night, dashboard quiet; a Mate replays a failed step and writes a lesson card |
| L33b ▲ | Next time, they don't make them. | Same task again; the step passes first try |
| L33c ▲ | Missing a skill? They write their own. | A new skill file is drafted, saved to Skills, and the Mate uses it on the next run |

## 8 · Everyday Mates (2:06–2:22) ★

| ID | Line | On screen |
|---|---|---|
| L34 ★ | It's not just work. | Dashboard switches from the run board to the home view |
| L35 ★ | Chef plans dinner and fills my grocery list. | Recipe card; items drop into a to-do list |
| L36 ★ | Tune makes a playlist from what I actually play. | Playlist builds track by track |
| L37 ★ | Luna writes my journal. Zen sees I slept badly and eases my day. | Daily note fills; sleep total low, calendar block moves |

## 9 · Calls and Jarvis mode (2:22–2:48)

| ID | Line | On screen |
|---|---|---|
| L38 | When it matters, a Mate calls me. | Phone rings with Mimo's face |
| L39 | "Call me at six." It shows up knowing what it knew. | Call timer set, call starts at 6:00 |
| L40 | It watches my deadlines, my repos, my news. | Watch cards: calendar, GitHub, RSS, Home Assistant |
| L41 | Then decides: a morning briefing, a message, or a call. | Events sort into three lanes |
| L42 | It's 11 p.m. The garage is still open. | Home Assistant garage tile turns red |
| L43 | Mimo calls. "Close it?" Yes. Lights off, too. | Call, "yes", garage closes, lights dim |
| L44 ★ | Every Friday, the team stand-up. One line each, in their own voice. | Stand-up card, Mates' lines appear one by one |

## 10 · Everywhere (2:48–3:08)

| ID | Line | On screen |
|---|---|---|
| L45 | They reach me anywhere. Telegram. Slack. WhatsApp. My phone. | Same Mate replying across four screens |
| L46 | And they work with what I already use. | Connections page: Obsidian, Notion, Gmail, GitHub, Spotify, Home Assistant toggle on |
| L47 ★ | Running a small team? Give everyone the bot. They only see their own work. | People directory; two employees on Telegram, each sees only their own tasks |

## 11 · Safety and close (3:08–3:30)

| ID | Line | On screen |
|---|---|---|
| L48 | My models. My keys. My machine. | Sealed key vault on the laptop |
| L49 | They never buy anything. Never type my passwords. | Blocked actions bounce off a shield |
| L50 ★ | A web page tells them what to do? They don't listen. | Hidden instruction in a page gets labelled "outside content" and ignored |
| L51 | By morning, the work is done. The summary's waiting. | Sunrise; briefing card on the phone |
| L52 | Loopmates. Working while I don't. | Logo and Mates lineup |
| L53 | Oh, and the subscription? There isn't one. | Beat of silence, then end card |

About 540 words, so the film now runs about 3:30. To bring it toward 2:30, drop section 8 (Everyday Mates) and L44, L47, L50, which gets it to about 3:05.
