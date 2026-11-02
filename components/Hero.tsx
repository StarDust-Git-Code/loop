"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, SplitText, prefersReducedMotion } from "@/lib/gsap";
import Magnetic from "./Magnetic";
import DotRail from "./DotRail";

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const h1 = root.current!.querySelector<HTMLElement>(".hero-h1")!;
      const hangs = gsap.utils.toArray<HTMLElement>(".hang", root.current!);

      /** Pin each hanging Mate to the underside of the headline's first line, in the empty space beside line two. */
      const place = (line: DOMRect) => {
        const hr = root.current!.getBoundingClientRect();
        const w = line.width;
        const xs = [0.07, 0.925];
        hangs.forEach((h, i) => {
          h.style.left = `${line.left - hr.left + w * xs[i]}px`;
          h.style.top = `${line.bottom - hr.top - 14}px`;
        });
      };

      if (prefersReducedMotion()) {
        const r = h1.getBoundingClientRect();
        place(new DOMRect(r.left + Math.max(0, (r.width - 900) / 2), r.top, Math.min(900, r.width), r.height / 2));
        gsap.set(hangs, { opacity: 1 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // nav drops in
      tl.from(document.querySelector(".nav-inner"), { y: -60, opacity: 0, duration: 0.8 }, 0);

      SplitText.create(h1, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) => {
          gsap.set(h1, { visibility: "visible" });
          place(self.lines[0].getBoundingClientRect());
          return tl.from(self.lines, { yPercent: 115, filter: "blur(16px)", duration: 1.2, stagger: 0.14, ease: "power4.out" }, 0.25);
        },
      });

      tl.to(".hero-sub", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8 }, 0.9);
      tl.to(".hero-cta > *", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, stagger: 0.1 }, 1.05);

      // hanging Mates: drop in on a string, then swing like a pendulum; poke them for a bigger swing
      hangs.forEach((h, i) => {
        const dir = i === 0 ? 1 : -1;
        const swing = h.querySelector<HTMLElement>(".hang-swing")!;
        const kick = h.querySelector<HTMLElement>(".hang-kick")!;
        gsap.set(h, { opacity: 0 });
        tl.to(h, { opacity: 1, duration: 0.2 }, 1.5 + i * 0.25);
        tl.from(h, { y: -170, duration: 1.3, ease: "bounce.out" }, 1.5 + i * 0.25);
        gsap.fromTo(swing, { rotation: -9 * dir }, { rotation: 9 * dir, duration: 2.1 + i * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.6 });
        // tiny secondary wobble on the Mate itself so it feels soft, not rigid
        gsap.to(h.querySelector(".hang-mate"), { rotation: 5 * dir, duration: 1.3 + i * 0.3, ease: "sine.inOut", yoyo: true, repeat: -1, transformOrigin: "50% 0%" });
        h.addEventListener("pointerenter", () => {
          gsap.timeline().to(kick, { rotation: 22 * dir, duration: 0.28, ease: "power2.out" }).to(kick, { rotation: 0, duration: 1.4, ease: "elastic.out(1,0.3)" });
        });
      });

      // soft floating background blobs + scroll parallax
      gsap.utils.toArray<HTMLElement>(".hero-blob").forEach((b, i) => {
        gsap.to(b, { x: i % 2 ? -40 : 40, y: i % 2 ? 30 : -30, duration: 6 + i * 1.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
      });
      gsap.to(".hero-h1, .hero-hangers", {
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

      <div className="hero-hangers" aria-hidden="true">
        {(["spark", "mimo"] as const).map((k) => (
          <div className="hang" key={k}>
            <div className="hang-swing">
              <div className="hang-kick">
                <span className="hang-string" />
                <Image className="hang-mate" src={`/dots/${k}.png`} alt="" width={256} height={256} />
              </div>
            </div>
          </div>
        ))}
      </div>

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
