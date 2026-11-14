"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP, SplitText, prefersReducedMotion } from "@/lib/gsap";
import Loops3D, { type LoopsApi } from "./Loops3D";
import MateImg from "@/components/MateImg";
import JoinForm from "@/components/site/JoinForm";
import { FILM_URL } from "@/lib/site";
import type { MateKey } from "@/lib/mates";

/** Mates riding the loops. Positions are % of the stage; `dx` is which way they leave on scroll. */
const RIDERS: { k: MateKey; size: number; cls: string; dx: number }[] = [
  { k: "mimo", size: 220, cls: "r-mimo", dx: -0.3 },
  { k: "luna", size: 150, cls: "r-luna", dx: 1 },
  { k: "research", size: 150, cls: "r-research", dx: -1 },
  { k: "code", size: 140, cls: "r-code", dx: 1 },
  { k: "orbit", size: 100, cls: "r-orbit", dx: -1 },
  { k: "halo", size: 110, cls: "r-halo", dx: 0.4 },
];

const FACES: MateKey[] = ["research", "code", "planner", "writer", "mimo", "browser", "orbit", "halo", "luna"];

/** Share of the pinned scroll spent flying through the loop; the rest explains what Loopmates is. */
const FLY = 0.42;
const PIN = 260;

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const [api, setApi] = useState<LoopsApi | null>(null);

  // DOM: intro, idle float, then the pinned scroll: fly through the loop, and the answer to "what is it?"
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const intro = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.15 });
      intro
        .set(".hero-h1", { visibility: "visible" })
        .from(".hero-h1 .ln > span", { yPercent: 120, rotate: 3, transformOrigin: "0 100%", duration: 1.4, stagger: 0.14 }, 0)
        .fromTo(".hero-gl", { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 2, ease: "expo.out" }, 0)
        .to(".hero-in", { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08 }, 0.6)
        .fromTo(
          ".rider img",
          { scale: 0, rotate: (i: number) => (i % 2 ? 40 : -40) },
          { scale: 1, rotate: 0, duration: 1.5, ease: "elastic.out(1,0.55)", stagger: { each: 0.1, from: "random" } },
          0.5
        );

      gsap.utils.toArray<HTMLElement>(".rider-f").forEach((el, i) => {
        gsap.to(el, { y: i % 2 ? 16 : -16, rotate: i % 2 ? -5 : 5, duration: 2.6 + (i % 3) * 0.5, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.2 });
      });

      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        const split = SplitText.create(".what-big", { type: "words", wordsClass: "what-w" });
        gsap.set(split.words, { opacity: 0.14 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: root.current, start: "top top", end: `+=${PIN}%`, scrub: 0.8, pin: ".hero-stage", anticipatePin: 1 },
        });
        tl.to(".hero-h1", { yPercent: -60, autoAlpha: 0, duration: FLY * 0.45 }, 0)
          .to(".hero-side", { y: -80, autoAlpha: 0, duration: FLY * 0.35 }, 0)
          .to(".hero-glow", { scale: 2.6, duration: FLY }, 0);
        gsap.utils.toArray<HTMLElement>(".rider").forEach((el, i) => {
          tl.to(el, { xPercent: RIDERS[i].dx * 260, yPercent: -140 - i * 20, scale: 1.6, autoAlpha: 0, duration: FLY * 0.7, ease: "power2.in" }, FLY * 0.05);
        });
        // the answer opens out of the loop's hole as the camera passes through
        tl.fromTo(".what", { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.12, ease: "power2.out" }, FLY - 0.04)
          .to(".hero-glow", { scale: 1.6, autoAlpha: 0.6, duration: 0.2 }, FLY)
          .to(split.words, { opacity: 1, duration: 0.02, stagger: 0.36 / split.words.length }, FLY + 0.1)
          .fromTo(".what-faces img", { y: 40, autoAlpha: 0, scale: 0.6 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.06, stagger: 0.01, ease: "back.out(2)" }, FLY + 0.34)
          .to(".hero-glow", { autoAlpha: 0, duration: 0.08 }, 0.92);
        return () => split.revert();
      });
    },
    { scope: root }
  );

  // 3D: the camera flies through the violet loop, then the loops are gone
  useGSAP(
    () => {
      if (!api || prefersReducedMotion()) return;
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: root.current, start: "top top", end: `+=${PIN * FLY}%`, scrub: 0.8 },
        });
        tl.to(api.state, { wobble: 0, follow: 0, duration: 0.3 }, 0)
          .to(api.tilt.rotation, { x: 0, y: 0, z: 0, duration: 0.45, ease: "power2.inOut" }, 0)
          .to(api.camera.position, { x: -0.5, y: 0.48, duration: 0.45, ease: "power2.inOut" }, 0.05)
          .to(api.camera.position, { z: 0.6, duration: 0.55, ease: "power2.in" }, 0.25)
          .to(api.camera.position, { z: -2.5, duration: 0.2, ease: "none" }, 0.8);
      });
    },
    { scope: root, dependencies: [api] }
  );

  return (
    <section ref={root} id="top" className="hero">
      <div className="hero-stage">
        <div className="hero-glow" aria-hidden="true" />
        <Loops3D className="hero-gl" distance={9} onReady={setApi} />
        <div className="riders" aria-hidden="true">
          {RIDERS.map((r) => (
            <div key={r.k} className={`rider ${r.cls}`}>
              <div className="rider-f"><MateImg k={r.k} size={r.size} /></div>
            </div>
          ))}
        </div>

        <h1 className="hero-h1">
          <span className="ln"><span>Working while</span></span>
          <span className="ln"><span>you don&rsquo;t.</span></span>
        </h1>

        <div className="hero-side">
          <p className="hero-in">
            Loopmates is a team of 19 AI Mates that lives on your computer. Tell them what you need. They plan it, do
            it, check it, and only come to you when something needs a yes.
          </p>
          <div className="hero-in"><JoinForm id="email-top" stacked /></div>
          <a className="hero-in film-link" href={FILM_URL} target="_blank" rel="noopener noreferrer">
            <span className="film-link-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>
            </span>
            Watch the film on YouTube
          </a>
        </div>

        <div className="what">
          <p className="what-q">So, what is Loopmates?</p>
          <p className="what-big">
            A second brain made of AI Mates, living on your own computer. Each Mate is good at one thing. You ask once,
            and they split the work between them, get it done, and call you when it matters.
          </p>
          <div className="what-faces" aria-hidden="true">
            {FACES.map((k) => <MateImg key={k} k={k} size={72} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
