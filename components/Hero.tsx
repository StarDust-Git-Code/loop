"use client";

import { useRef } from "react";
import { gsap, useGSAP, SplitText, prefersReducedMotion } from "@/lib/gsap";
import Magnetic from "./Magnetic";
import DotRail from "./DotRail";

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const h1 = root.current!.querySelector<HTMLElement>(".hero-h1")!;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // nav drops in
      tl.from(document.querySelector(".nav-inner"), { y: -60, opacity: 0, duration: 0.8 }, 0);

      SplitText.create(h1, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) => {
          gsap.set(h1, { visibility: "visible" });
          return tl.from(self.lines, { yPercent: 115, filter: "blur(16px)", duration: 1.2, stagger: 0.14, ease: "power4.out" }, 0.25);
        },
      });

      tl.to(".hero-sub", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8 }, 0.9);
      tl.to(".hero-cta > *", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, stagger: 0.1 }, 1.05);

      // soft floating background blobs + scroll parallax
      gsap.utils.toArray<HTMLElement>(".hero-blob").forEach((b, i) => {
        gsap.to(b, { x: i % 2 ? -40 : 40, y: i % 2 ? 30 : -30, duration: 6 + i * 1.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
      });
      gsap.to(".hero-h1", {
        yPercent: -14,
        opacity: 0.2,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="top" className="hero">
      <div className="hero-blob" aria-hidden="true" style={{ width: 520, height: 520, right: "-8%", top: "4%", background: "rgba(106,77,244,.16)" }} />
      <div className="hero-blob" aria-hidden="true" style={{ width: 460, height: 460, left: "-6%", top: "14%", background: "rgba(255,170,200,.35)" }} />
      <div className="hero-blob" aria-hidden="true" style={{ width: 760, height: 300, left: "calc(50% - 380px)", top: "52%", background: "rgba(255,226,150,.38)" }} />

      <h1 className="hero-h1">
        A workspace for your <span className="v">fluffy</span> agents.
      </h1>

      <DotRail />

      <p className="hero-sub" data-reveal>
        Specialist agents plan, research, browse and build together — while you stay in control.
      </p>
      <div className="hero-cta">
        <span data-reveal>
          <Magnetic>
            <a href="#features" className="btn-dark">
              Explore Loop
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </Magnetic>
        </span>
        <span data-reveal>
          <Magnetic strength={0.2}>
            <a href="#demo" className="btn-watch">
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#15121A" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
              </span>
              Watch demo
            </a>
          </Magnetic>
        </span>
      </div>
    </section>
  );
}
