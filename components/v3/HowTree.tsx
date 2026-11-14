"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import MateImg from "@/components/MateImg";
import type { MateKey } from "@/lib/mates";

/* Layout in a 1280 × 900 box; the SVG and the HTML nodes share these coordinates. */
const W = 1280;
const H = 900;
const SPINE = 640;

const ASK = "“I launch my app on Friday. Get everything ready.”";

const SPINE_NODES: { k: MateKey; y: number; name: string; text: string; step: string }[] = [
  { k: "mimo", y: 176, name: "Mimo", text: "takes the job. It already knows your app and what you decided last week.", step: "Your lead Mate listens" },
  { k: "planner", y: 300, name: "Planner", text: "splits it into six jobs and picks the right Mate for each.", step: "The work is split up" },
];

const LEAVES: { k: MateKey; name: string; text: string }[] = [
  { k: "research", name: "Research", text: "compares three similar apps, every source linked." },
  { k: "writer", name: "Writer", text: "drafts the launch post in your voice." },
  { k: "code", name: "Code", text: "fixes the sign-up bug and runs the tests." },
  { k: "browser", name: "Browser", text: "fills in the launch-site form for you." },
  { k: "orbit", name: "Orbit", text: "clears Friday morning in your calendar." },
  { k: "data", name: "Data", text: "builds a chart of this week’s sign-ups." },
];
const LEAF_Y = 470;
const leafX = (i: number) => 125 + i * 206;

const HALO = { y: 724, text: "holds the post. Nothing goes out until you say yes." };
const CALL = "Friday, 9:00. Mimo calls you: “Everything’s ready. One post needs your yes.”";

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** One request becomes many jobs, done in parallel by different Mates, then joins back up. */
export default function HowTree() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const mm = gsap.matchMedia();

      mm.add("(min-width: 900px)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: ".tree-stage", start: "top top", end: "+=190%", scrub: 0.7, pin: ".tree-pin", anticipatePin: 1 },
        });
        const show = (sel: string, at: number) =>
          tl.fromTo(sel, { autoAlpha: 0, scale: 0.7, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.05, ease: "back.out(2)" }, at);
        const draw = (sel: string, at: number, d = 0.07) => tl.to(sel, { strokeDashoffset: 0, duration: d }, at);

        show(".t-ask", 0);
        draw(".p-ask", 0.05);
        show(".t-mimo", 0.11);
        draw(".p-mimo", 0.17);
        show(".t-planner", 0.23);
        draw(".p-out", 0.3, 0.12);
        tl.fromTo(".t-leaf", { autoAlpha: 0, scale: 0.6, y: 30 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.06, stagger: 0.015, ease: "back.out(2)" }, 0.38);
        draw(".p-in", 0.55, 0.12);
        show(".t-halo", 0.66);
        draw(".p-halo", 0.72);
        show(".t-call", 0.79);
        tl.to(".p-flow", { opacity: 0.9, duration: 0.06 }, 0.84);
        tl.to(".tree-steps li", { color: "#f4f1ff", duration: 0.02, stagger: 0.17 }, 0.02);
        tl.to({}, { duration: 0.12 });

        // once drawn, light keeps running down the branches
        const flow = gsap.to(".p-flow", { strokeDashoffset: -1, duration: 2.4, ease: "none", repeat: -1 });
        return () => flow.kill();
      });

      mm.add("(max-width: 899px)", () => {
        gsap.utils.toArray<HTMLElement>(".tm-item").forEach((el) => {
          gsap.from(el, { x: -30, autoAlpha: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } });
        });
      });
    },
    { scope: root }
  );

  const outPaths = LEAVES.map((_, i) => `M${SPINE},340 C${SPINE},400 ${leafX(i)},380 ${leafX(i)},${LEAF_Y - 44}`);
  const inPaths = LEAVES.map((_, i) => `M${leafX(i)},${LEAF_Y + 150} C${leafX(i)},${LEAF_Y + 210} ${SPINE},640 ${SPINE},${HALO.y - 42}`);
  const spine = [
    { cls: "p-ask", d: `M${SPINE},90 L${SPINE},${SPINE_NODES[0].y - 40}` },
    { cls: "p-mimo", d: `M${SPINE},${SPINE_NODES[0].y + 40} L${SPINE},${SPINE_NODES[1].y - 40}` },
    { cls: "p-halo", d: `M${SPINE},${HALO.y + 40} L${SPINE},826` },
  ];
  const all = [...spine.map((s) => s.d), ...outPaths, ...inPaths];

  return (
    <section ref={root} id="how" className="how">
      <div className="how-head" data-rise>
        <h2>You ask once.<br />The team takes it from there.</h2>
        <p>Here is one real-sized job. Watch it branch out to six Mates working at the same time, then come back together before anything reaches the outside world.</p>
      </div>

      {/* desktop: the tree */}
      <div className="tree-stage">
        <div className="tree-pin">
          <ol className="tree-steps" aria-label="The steps">
            <li>You ask</li>
            <li>Mimo plans</li>
            <li>Mates work in parallel</li>
            <li>Halo checks</li>
            <li>You get the result</li>
          </ol>
          <div className="tree" aria-hidden="true">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="branch" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#c9bcff" />
                  <stop offset="0.5" stopColor="#7c5cff" />
                  <stop offset="1" stopColor="#ffd27a" />
                </linearGradient>
              </defs>
              {spine.map((s) => <path key={s.cls} className={`tp ${s.cls}`} d={s.d} pathLength={1} />)}
              {outPaths.map((d, i) => <path key={`o${i}`} className="tp p-out" d={d} pathLength={1} />)}
              {inPaths.map((d, i) => <path key={`i${i}`} className="tp p-in" d={d} pathLength={1} />)}
              {all.map((d, i) => <path key={`f${i}`} className="p-flow" d={d} pathLength={1} />)}
            </svg>

            <div className="t-node t-ask" style={{ left: pct(SPINE, W), top: pct(52, H) }}>
              <span className="t-you">You</span>
              <p>{ASK}</p>
            </div>

            {SPINE_NODES.map((n) => (
              <div key={n.k} className={`t-node t-spine t-${n.k}`} style={{ left: pct(SPINE, W), top: pct(n.y, H) }}>
                <MateImg k={n.k} size={84} />
                <p><b>{n.name}</b> {n.text}</p>
              </div>
            ))}

            {LEAVES.map((l, i) => (
              <div key={l.k} className="t-node t-leaf" style={{ left: pct(leafX(i), W), top: pct(LEAF_Y, H) }}>
                <MateImg k={l.k} size={84} />
                <p><b>{l.name}</b> {l.text}</p>
              </div>
            ))}

            <div className="t-node t-spine t-halo" style={{ left: pct(SPINE, W), top: pct(HALO.y, H) }}>
              <MateImg k="halo" size={84} />
              <p><b>Halo</b> {HALO.text}</p>
            </div>

            <div className="t-node t-call" style={{ left: pct(SPINE, W), top: pct(860, H) }}>
              <p>{CALL}</p>
            </div>
          </div>
        </div>
      </div>

      {/* phones and screen readers: the same story as a list */}
      <ol className="tm">
        <li className="tm-item tm-ask"><span className="t-you">You</span><p>{ASK}</p></li>
        {SPINE_NODES.map((n) => (
          <li key={n.k} className="tm-item"><MateImg k={n.k} size={64} /><p><b>{n.name}</b> {n.text}</p></li>
        ))}
        <li className="tm-item tm-branch">
          <p className="tm-label">At the same time:</p>
          <ul>
            {LEAVES.map((l) => (
              <li key={l.k}><MateImg k={l.k} size={52} /><p><b>{l.name}</b> {l.text}</p></li>
            ))}
          </ul>
        </li>
        <li className="tm-item"><MateImg k="halo" size={64} /><p><b>Halo</b> {HALO.text}</p></li>
        <li className="tm-item tm-call"><p>{CALL}</p></li>
      </ol>
    </section>
  );
}
