"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import MateImg from "@/components/MateImg";
import JoinForm from "@/components/site/JoinForm";
import { LogoMark } from "@/components/Logo";
import { REPO_URL } from "@/lib/site";
import type { MateKey } from "@/lib/mates";

const HORIZON: { k: MateKey; size: number }[] = [
  { k: "research", size: 130 },
  { k: "mimo", size: 180 },
  { k: "luna", size: 130 },
];

/** The moon rises, three Mates settle on the horizon, and the page goes quiet. */
export default function JoinSection() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const st = { trigger: root.current, start: "top bottom", end: "top 15%", scrub: 1 };
      gsap.from(".jn-moon", { y: 260, scale: 0.6, ease: "none", scrollTrigger: st });
      gsap.from(".jn-planet", { yPercent: 30, ease: "none", scrollTrigger: st });
      gsap.from(".jn-mates > div", {
        y: 160,
        rotate: (i: number) => (i - 1) * 20,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { ...st, start: "top 70%", end: "top 10%" },
      });
      gsap.from(".jn-h .ln > span", {
        yPercent: 110,
        stagger: 0.12,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: { trigger: ".jn-h", start: "top 80%" },
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="join" className="jn">
      <div className="jn-moon" aria-hidden="true" />
      <div className="jn-copy">
        <h2 className="jn-h">
          <span className="ln"><span>Get your Mates</span></span>
          <span className="ln"><span>before everyone else.</span></span>
        </h2>
        <p data-rise>Leave your email. We&rsquo;ll send an invite as soon as there&rsquo;s room.</p>
        <div data-rise><JoinForm id="email-bottom" /></div>
      </div>
      <div className="jn-horizon" aria-hidden="true">
        <div className="jn-planet" />
        <div className="jn-mates">
          {HORIZON.map((m) => <div key={m.k}><MateImg k={m.k} size={m.size} /></div>)}
        </div>
      </div>
      <footer className="foot">
        <span className="foot-logo"><LogoMark size={22} /> loopmates</span>
        <nav aria-label="Footer">
          <a href={REPO_URL}>Source on GitHub</a>
          <a href="#film">Film</a>
          <a href="#home">Privacy</a>
        </nav>
        <span>© 2026 Loopmates</span>
      </footer>
    </section>
  );
}
