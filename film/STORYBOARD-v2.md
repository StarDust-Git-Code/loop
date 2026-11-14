# Loopmates film v2: storyboard

Voice: the user's own take, `audio/v2/vo.mp3` (3:55). Script: `script/vo-v2-tagged.txt`. Word timings: `audio/v2/words.json`, made locally by `tools/align.py` (no ElevenLabs).
Page: `v2.html` + `v2.js` (night) + `v2-nb*.js` (the white world, one file per group of scenes) + `v2-end.js` (cuts).

## PAGE
- Problem: personal AI agents live in someone else's cloud, hold your passwords and cost a monthly fee.
- Audience: people who'd run their own tools and want a second brain, not another chat tab.
- Goal: understand what Loopmates actually does, feature by feature, in about four minutes.
- Emotion: "that's mine, and it just handles things."

## The idea
The film is a tour of one person's real day with their Mates, shown inside the product. Every feature is performed in the UI (typing, clicks, cards moving, the Mates reacting) rather than captioned over mascots. The night world opens and closes it: it starts at 2 a.m. with an agent in a cloud, and ends at sunrise with the work done on my own laptop.

## One system
- Night world (scene 1 and the start of scene 2): stars, cloud, desk, clock, cool blue light. My laptop wakes with a **white** screen, and the camera dives into it.
- The white world (scene 2 on, the user's call on 2026-11-13): **neobrutalism with 3D**. Warm white paper `#FFFDF5` with a dot grid that tilts with the camera (perspective rotateX/Y), thick ink `#14121A` outlines, every object a slab extruded 45 degrees, flat vibrant colour. Slabs stand up off the table (rotateX hinge), stickers are slapped on (arrive oversize, settle), and buttons are pressed into their own extrusion.
- Colour logic: each Mate has its own tile colour (who); lime `#D4FF4F` with an ink tick means done / a Mate is on it; red means something is wrong. The Loopmates mark is the official light version (purple `#6A4DF4` + ink), extruded as a real 3D solid.
- The garage (scene 10) is the same system at night: navy ground, the same outlines and slabs.
- Real Mate images from `assets/m/`, never redrawn. Product UI is drawn from the dashboard's own page names and copy (Agents, New agent, Studio, Tools, Connections, Skills, Pair your dashboard).
- Cuts land on words. Each shot starts already moving (a whip that lands); the camera travels across one table per scene.

## Scenes (times from the take)

| # | Scene | Time | What happens on screen | Buys |
|---|---|---|---|---|
| 1 | The problem | 0:00–0:18 | 2:00 flips; my laptop asleep; tilt up to an agent typing inside a cloud; my passwords fly into it; I click its locked model picker twice; a bill prints one month per word | the viewer feels the cloud setup is someone else's, and expensive |
| 2 | The reveal | 0:18–0:40 | The bill is yanked away; my laptop wakes with the mark; dive in: logo; 19 Mates land; cursor builds a 20th in the New agent form; the team folds back into my laptop | Loopmates is a team of brains that lives on my machine |
| 3 | Setup | 0:40–0:52 | Terminal runs the installer; setup page: key pasted, pairing code; dashboard connects; a provider goes down mid-reply and the next one takes over | it is easy and free to run |
| 4 | Team chat | 0:52–1:08 | Chat: "Hey Research…" reply with sources; Mimo hands cards to Writer and Data; three Mates post opposing takes; Data's Python run draws a chart | they work like a team, with real tools |
| 5 | The run | 1:08–1:32 | "Add dark mode. Run the tests." Run board fills step by step; code step inside a sandbox; a step retries then passes; Halo's approval card, tap; tests green, PR | it does real multi-step work without me |
| 6 | Tools, browser, pipelines | 1:32–2:00 | Tool chips stack to 86; Browser fills a form and stops at the password; Flow draws a pipeline from one sentence; drag, swap, save; Monday 9:00 schedule; MCP server adds new chips | it can act, and I can shape how |
| 7 | Memory and learning | 2:00–2:16 | Knowledge graph lights a past decision; "shorter, please" lands in Writer's journal; at night a failed step becomes a lesson; a new skill file is written | it gets better on its own |
| 8 | Everyday Mates | 2:16–2:30 | Chef's grocery list, Tune's playlist, Luna's journal, Zen moves a calendar block after bad sleep | it's a life, not only work |
| 9 | Keeping watch | 2:30–2:45 | Watch cards (deadlines, repos, news, house) sort into briefing / message / call; "Call me at six" timer, the call comes | it decides when to reach me |
| 10 | The garage | 2:45–3:08 | Night world again: 11 p.m., me in bed, the garage door open; Home Assistant tile turns red; Mimo calls; door closes, lights off | the single most human proof |
| 11 | Stand-up and everywhere | 3:08–3:25 | Friday stand-up lines; the same Mate on Telegram, Slack, WhatsApp, phone; Connections toggles; team view where each person sees only their tasks | it fits the way I already work |
| 12 | Safety and close | 3:25–3:55 | Keys sealed on my laptop; a buy and a password field bounce off; a web page's hidden order is labelled and ignored; sunrise summary; logo; the $200 bill becomes $0 | it's mine, it's safe, and it's free |

## Hero moments
- Scene 1: the bill printing one month per spoken word.
- Scene 6: Flow drawing the pipeline from one sentence (the densest UI shot).
- Scene 10: the garage, door closing on the call.

## Not real / illustrative
The UI is rebuilt from the dashboard's layout, not screen-recorded. Run contents, names and numbers in the demo are sample data. Idle-time learning and self-written skills (scene 7) are not in the `loop` code as of 2026-11-13; the user has been told.
