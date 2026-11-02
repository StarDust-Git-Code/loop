# Loop — landing page (loopmates.com)

Next.js (App Router, TypeScript) + GSAP. The app itself lives at `dashboard.loopmates.com`.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## What GSAP does here

| Where | Plugins / technique |
|---|---|
| Whole page | **ScrollSmoother** (smooth scroll, created before any trigger in `SmoothSetup`), **ScrollTrigger** scroll progress bar, nav that turns into a glass pill and hides on scroll-down |
| Hero | Timeline intro; **SplitText** line-mask headline reveal; floating blobs; headline parallax fade |
| Mate rail | **Draggable + InertiaPlugin** (drag, throw, snap to card), arrow buttons and keys, horizontal-wheel, per-card tilt/scale driven by distance from centre |
| Section headings | **SplitText** line reveal + **ScrambleTextPlugin** tag, triggered on scroll |
| Marquee | Infinite loop whose speed and direction follow scroll velocity |
| Demo | Sliding pill indicator, autoplay with progress bar (pauses on hover / off-screen), **TextPlugin** typing, staggered logs/rows |
| Features | `ScrollTrigger.batch` stagger, idle bob, pointer 3D tilt (`quickTo`) |
| Mates grid | **Flip** — cards glide when you filter by category |
| My Space | Scripted chat with typing indicator |
| Automations | Scroll-scrubbed pipeline line lights each step |
| Safety | Elastic Halo, batched cards |
| CTA | **MotionPathPlugin** floating Mates, **SplitText** chars, magnetic buttons (`Magnetic.tsx`) |

`prefers-reduced-motion` disables the animations and shows everything in its final state.

## Structure

```
app/            layout, globals.css, page
components/     one file per section (+ Magnetic, SmoothSetup, SectionHead)
lib/gsap.ts     registers every plugin once (client only)
lib/dots.ts     the 18 Mates (names, roles, categories, tints)
public/dots/    Mate images (transparent PNG cut-outs, 384px)
```

## Placeholders to replace

- The email form in `components/Cta.tsx` does **not** save anything yet (`TODO` in `onSubmit`).
- Demo content (SkillCourt vs SmartCourt, file names, log lines) is sample copy.
- Mate cards use plain cut-outs on pastel tiles; swap `public/dots/*.png` for prop-per-agent art when you have it.
- The Mate cut-outs from black-fur mascots (Byte, Data) can show slight edge fringing on light backgrounds.

## Note on GSAP

As of GSAP 3.13 all plugins (including SplitText, ScrollSmoother, InertiaPlugin, Flip) are free for use, per GSAP's current licence. Check https://gsap.com/standard-license for terms that apply to your use.
