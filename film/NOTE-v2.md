# Loopmates film v2: note

**File:** `renders/loopmates-v2-final.mp4` (1920x1080, 30 fps, 3:56, your voice plus a sound bed and effects).
**Editable:** `v2.html` plus `v2.js` (scene 1 and the night start of scene 2), `v2-nb.js`, `v2-nb-s34.js`, `v2-nb-s5.js`, `v2-nb-s6.js`, `v2-nb-s7.js` (scenes 7–9), `v2-nb-s10.js` (10–11), `v2-nb-s12.js` and `v2-end.js` (the cuts).

## The idea
This is one person's real day with their Mates, shown inside the product. Every claim in the voice-over is performed in the UI: typing, clicks, slabs standing up, stickers slapping on, buttons pressed into their own extrusion. Nothing is just captioned over mascots.

The film opens in the night world (2 a.m., an agent in someone else's cloud, a bill printing one month per word). My laptop then wakes with a **white** screen, and the camera dives through it into the Loopmates world. From that point it is white paper, vibrant colour and neobrutalism with 3D (your direction). It ends at sunrise with the $200 bill counting down to $0.00.

## System (from the reveal on)
- **Ground:** warm white paper `#FFFDF5` with a dot grid. It is a real plane, and the camera tilts it in 3D (perspective rotateX/Y) on every move, so each scene reads as a table seen at an angle.
- **Objects:** thick ink outlines (`#14121A`), each one a slab extruded 45° (stacked hard shadows), in flat vibrant fills.
- **Motion:**
  - Slabs stand up off the table on a bottom hinge, landing decelerated.
  - Stickers arrive oversize and settle.
  - Buttons sink into their extrusion when pressed.
  - Each shot starts already moving, as a whip that lands.
- **Colour:**
  - Each Mate has its own tile colour (who).
  - Lime with an ink tick means done.
  - Red means something is wrong.
  - The mark is the official light version (purple + ink), built as a real extruded 3D solid that turns to show its sides.
- **The garage:** the same system at night (navy ground).
- **Mates:** the real images from `assets/m/`, never redrawn.

## Beats and what each one buys
| # | Time | Beat | Buys |
|---|---|---|---|
| 1 | 0:00–0:18 | 2:00 flips, the agent in a cloud takes my passwords, the model picker is locked, the bill prints one month per word | the cloud setup is someone else's, and expensive |
| 2 | 0:18–0:38 | The bill is thrown out, my laptop wakes white, a 3D logo, 19 Mates drop onto the table, the Research card fills name / voice / job, I make "Hira" in the New agent form, a match cut to my laptop, "Mine." | a team of named brains that lives on my machine |
| 3 | 0:38–0:48 | Terminal installer, Gemini key pasted, pairing code read by my phone, "Done.", Gemini drops mid-sentence and Groq finishes the sentence, five providers each stamped free | easy, resilient, free to run |
| 4 | 0:48–1:06 | @Research question with sources, Mimo as Leader hands three task cards out, Friday-vs-Monday argument splits into sides, Data's pandas code and chart | they work like a team, with real tools |
| 5 | 1:06–1:31 | "Add dark mode. Run the tests." Four run rows stand up on each Mate's name, sandbox vs my files, a second Mate stamps every step, Halo asks first, I approve, tests green, PR waiting, the loop turns while my cursor sleeps | real multi-step work without me |
| 6 | 1:31–2:04 | Wall of 86 tools, four used by name, Browser fills a court booking and stops at the password ("Your turn."), I type it; Flow draws a pipeline from one sentence; drag a step in, swap Writer for Luna, save, Monday 9:00, it runs, an MCP server plugs in and new tools land | it can act, and I shape how (hero beat) |
| 7 | 2:04–2:19 | Mimo recalls "Launch moves to Monday" (callback to beat 4), the report shrinks on "shorter, please", every later report is short, Writer's journal; after hours a failed build turns over into a lesson; no skill, so they write one | it gets better on its own |
| 8 | 2:19–2:32 | Chef's dinner and grocery ticks, Tune's playlist, Luna's journal, Zen sees 5 h 12 min of sleep and moves Deep work, swaps the gym for a walk | it is a life, not only work |
| 9 | 2:32–2:51 | Mimo's watch pulse, four found things sorted into briefing / message / call; "Call me at six." 5:59 → 6:00, the phone rings, caught up | it decides when to reach me |
| 10 | 2:51–3:16 | Night: 10:59 → 11:00, me in bed, the garage open and lit, Home Assistant in Mimo's view, the call, the door rolls down, the lights go out, zz | the most human proof |
| 11 | 3:16–3:35 | Friday stand-up lines (callbacks), one message in Telegram / Slack / WhatsApp / phone, Connections toggles, a team where each person sees only their own | it fits how I already work |
| 12 | 3:35–3:57 | The model picker opens and I choose (callback to the locked one), keys lock on this laptop, "Mine.", a Mate's cursor stops at Buy and at Password, a page's hidden order is struck out as Ignored, sunrise summary, logo, the bill counts to $0.00 | it is mine, it is safe, it is free |

## Real vs illustrative
- **Real** (from the `loop` code and landing page):
  - Mate names, images and roles.
  - The 19 Mates.
  - Page names: Agents, New agent, Studio, Tools, Connections, Skills, Pair your dashboard.
  - The New agent fields (Name, Job in one line, Picture, Create agent).
  - The install command `cd backend && ./install.sh`.
  - The pairing code flow and its "Valid for 10 minutes" note.
  - Tool groups, including Browser filling forms and Home Assistant garage doors asking first.
  - Provider names.
  - The 86-tool count is from your script.
- **Illustrative** (sample data):
  - Every chat, run, chart number, source domain, playlist, journal text, person (Alex, Asha, Sam, Jon), web page and price.
  - The 86 chip labels are plain-word tool names, not the exact function list.
  - "Scan a code": the product asks you to enter the code, and the film shows a phone reading it.
- **Not in the code as of 2026-11-13:** idle-time review of mistakes and self-written skills (beat 7). You know this.
- **Audio:**
  - Your take, untouched apart from loudness.
  - The bed is the existing `audio/film/bed.wav`, looped with crossfades from the reveal.
  - The effects are the existing files in `sfx/`, placed on the film's own event marks.
  - No ElevenLabs was used for this version.

## Gates (numbers from the scripts)
- G0 PASS: 236.40 s, audio present (look.py).
- G2 PASS: no run of more than 3 flat frames.
- G3 PASS: end hold 1.23 s; final shot 18.57 s = 8 % of the film. The first render held 1.83 s, so the tail was trimmed.
- G5 PASS: lint.mjs v2.html (an earlier run flagged a window title strip and a left headline; both were reframed or centred).
- G1 and G4 were judged by eye on about 90 stills; they have no script number.
- Seek self-test: ok, 24 jumps, 2411 elements, 0 mismatches.
- Audio: −14.2 LUFS, LRA 5.3, true peak −0.8 dBFS (slightly over −1).
- Motion: mean luma change 3.4/255, below the human band (6.8). The white ground changes little per frame, so this film is calmer than most.

## What I checked
Contact sheets of every scene were reviewed, and each problem found was fixed: cropped grid, empty openings, cards hidden behind lanes, an overlapping journal, the skill file starting in its slot, the bill text overlapping, and the end framing.

## What I would still improve
- The dialogue bubbles in the garage call are small in the wide shot (about 0.036 H). A closer framing would read faster, but the door closing needs the wide shot.
- Lime is doing more than "done" (some buttons and stickers). A stricter film would keep it only for ticks.
- The bed is one 64 s loop under a 4-minute film. A track that builds to the garage and drops for the ending would be stronger. If you want, send me a track and I'll cut to it.
