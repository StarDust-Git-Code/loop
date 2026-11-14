"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion, canHover } from "@/lib/gsap";
import Magnetic from "./Magnetic";
import MateImg from "./MateImg";
import type { MateKey } from "@/lib/mates";

/** Mates around the headline. `depth` scales how far each one moves with the pointer and the scroll. */
const MATES: { k: MateKey; size: number; depth: number; side: "l" | "r"; pos: React.CSSProperties }[] = [
  { k: "research", size: 112, depth: 0.5, side: "l", pos: { left: "2.5%", top: "10%", width: "clamp(72px, 7.2vw, 112px)" } },
  { k: "luna", size: 116, depth: 0.45, side: "r", pos: { right: "3%", top: "9.5%", width: "clamp(72px, 7.5vw, 116px)" } },
  { k: "mimo", size: 220, depth: 1, side: "l", pos: { left: "4.5%", top: "49%", width: "clamp(120px, 13.6vw, 220px)" } },
  { k: "spark", size: 208, depth: 0.95, side: "r", pos: { right: "5%", top: "48%", width: "clamp(116px, 13vw, 208px)" } },
  { k: "code", size: 136, depth: 0.7, side: "l", pos: { left: "17%", top: "68%", width: "clamp(84px, 8.8vw, 136px)" } },
  { k: "byte", size: 144, depth: 0.75, side: "r", pos: { right: "17%", top: "69%", width: "clamp(88px, 9.3vw, 144px)" } },
  { k: "planner", size: 96, depth: 0.35, side: "l", pos: { left: "8%", top: "82%", width: "clamp(60px, 6.1vw, 96px)" } },
  { k: "zen", size: 104, depth: 0.4, side: "r", pos: { right: "7%", top: "83%", width: "clamp(64px, 6.6vw, 104px)" } },
];

const ROW: MateKey[] = ["mimo", "research", "code", "spark", "luna"];

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;

      const h1 = el.querySelector<HTMLElement>(".hero-h1");
      const nav = document.querySelector<HTMLElement>(".nav-inner");
      const wraps = gsap.utils.toArray<HTMLElement>(".hm", el);
      const imgs = gsap.utils.toArray<HTMLElement>(".hm img", el);
      let introDone = false;

      // intro: nav drops, headline rises out of its masks, Mates spring in
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, onComplete: () => { introDone = true; } });
      if (nav) tl.fromTo(nav, { y: -60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0);
      tl.set(h1, { visibility: "visible" }, 0.2)
        .from(".hero-h1 .ln > span", { yPercent: 118, rotation: 4, transformOrigin: "0% 100%", duration: 1.3, stagger: 0.13 }, 0.2)
        .to(".hero-fade", { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.1 }, 0.9)
        .fromTo(
          imgs,
          { scale: 0, autoAlpha: 0, rotation: (i: number) => (i % 2 ? 50 : -50) },
          { scale: 1, autoAlpha: 1, rotation: 0, duration: 1.4, ease: "elastic.out(1,0.55)", stagger: { each: 0.09, from: "random" } },
          0.75
        );

      // idle float, desynchronised
      gsap.utils.toArray<HTMLElement>(".hm-f", el).forEach((f, i) => {
        gsap.to(f, {
          y: i % 2 ? 14 : -14,
          rotation: i % 2 ? -4 : 4,
          duration: 2.4 + (i % 4) * 0.45,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: i * 0.17,
        });
      });

      // scroll: Mates drift apart, the copy sinks back
      const st = { trigger: el, start: "top top", end: "bottom top", scrub: true };
      gsap.utils.toArray<HTMLElement>(".hm-s", el).forEach((s, i) => {
        const m = MATES[i];
        gsap.to(s, { x: (m.side === "r" ? 1 : -1) * 280 * m.depth, y: -320 * m.depth, ease: "none", scrollTrigger: st });
      });
      gsap.to(".hero-copy", { y: 70, scale: 0.94, ease: "none", scrollTrigger: st });
      gsap.to(".hero-copy", { autoAlpha: 0, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "45% top", scrub: true } });

      if (!canHover()) return;

      // pointer parallax by depth, plus a wobble when a Mate is poked
      const movers = wraps.map((w, i) => ({
        d: MATES[i].depth,
        x: gsap.quickTo(w, "x", { duration: 0.9, ease: "power3.out" }),
        y: gsap.quickTo(w, "y", { duration: 0.9, ease: "power3.out" }),
      }));
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        if (e.clientY > r.bottom) return;
        const px = gsap.utils.clamp(-0.5, 0.5, (e.clientX - r.left) / r.width - 0.5);
        const py = gsap.utils.clamp(-0.5, 0.5, (e.clientY - r.top) / r.height - 0.5);
        movers.forEach((m) => { m.x(px * -50 * m.d); m.y(py * -36 * m.d); });
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const pokes = wraps.map((w, i) => {
        const poke = () => {
          if (!introDone) return;
          gsap.timeline()
            .to(imgs[i], { rotation: 16, scale: 1.14, duration: 0.18, ease: "power2.out" })
            .to(imgs[i], { rotation: 0, scale: 1, duration: 1.1, ease: "elastic.out(1,0.3)" });
        };
        w.addEventListener("pointerenter", poke);
        return () => w.removeEventListener("pointerenter", poke);
      });

      return () => {
        window.removeEventListener("pointermove", onMove);
        pokes.forEach((off) => off());
      };
    },
    { scope: root }
  );

  return (
    <section ref={root} id="top" className="hero">
      <div className="hero-copy">
        <h1 className="hero-h1">
          <span className="ln"><span>A whole AI team,</span></span>
          <span className="ln"><span>living on your</span></span>
          <span className="ln"><span className="acc">computer.</span></span>
        </h1>
        <p className="hero-sub hero-fade">
          Each Mate has a name, a voice and a job. They plan, research, code and keep watch, and they ring you when
          something matters. Your keys and files stay home.
        </p>
        <div className="hero-cta">
          <span className="hero-fade">
            <Magnetic strength={0.28}>
              <a href="#install" className="btn btn-acc">
                Run your own
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
            </Magnetic>
          </span>
          <span className="hero-fade">
            <Magnetic strength={0.2}>
              <a href="#mates" className="btn btn-ghost">Meet the Mates</a>
            </Magnetic>
          </span>
        </div>
        <div className="hero-row hero-fade" aria-hidden="true">
          {ROW.map((k) => <MateImg key={k} k={k} size={60} />)}
        </div>
      </div>

      <div className="hero-mates" aria-hidden="true">
        {MATES.map((m) => (
          <div className="hm" key={m.k} style={m.pos}>
            <div className="hm-s">
              <div className="hm-f">
                <MateImg k={m.k} size={m.size} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="hero-foot hero-fade">Runs on Windows and Linux, on the free tiers of Gemini, NVIDIA NIM, Groq, Cerebras or OpenRouter.</p>
    </section>
  );
}
