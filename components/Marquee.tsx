"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

const TOOLS = [
  "Telegram", "WhatsApp (read-only)", "ChatGPT in your browser", "Google Flow in your browser",
  "GitHub", "Google Drive", "Notion", "Playwright", "MCP servers",
];

/** Infinite marquee whose speed and direction react to scroll velocity. */
export default function Marquee() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const track = root.current!.querySelector<HTMLElement>(".marquee-track")!;
      gsap.to(root.current!.querySelector(".marquee-label"), {
        opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, scrollTrigger: { trigger: root.current, start: "top 90%", once: true },
      });
      if (prefersReducedMotion()) return;
      const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
      ScrollTrigger.create({
        onUpdate: (self) => {
          const v = gsap.utils.clamp(-8, 8, self.getVelocity() / 300);
          gsap.to(loop, { timeScale: (self.direction === 1 ? 1 : -1) * (1 + Math.abs(v)), duration: 0.2, overwrite: true });
          gsap.to(loop, { timeScale: 1, delay: 0.25, duration: 1.2, overwrite: false });
        },
      });
      const el = root.current!.querySelector(".marquee")!;
      const slow = () => gsap.to(loop, { timeScale: 0.2, duration: 0.5 });
      const fast = () => gsap.to(loop, { timeScale: 1, duration: 0.5 });
      el.addEventListener("pointerenter", slow);
      el.addEventListener("pointerleave", fast);
      return () => { el.removeEventListener("pointerenter", slow); el.removeEventListener("pointerleave", fast); };
    },
    { scope: root }
  );

  const row = [...TOOLS, ...TOOLS];
  return (
    <section ref={root} className="marquee-sec" aria-label="Connects to">
      <div className="marquee-label" data-reveal>CONNECTS TO THE TOOLS YOU ALREADY USE</div>
      <div className="marquee">
        <div className="marquee-track">
          {[...row, ...row].map((t, i) => (
            <span className="chip" key={i} aria-hidden={i >= TOOLS.length ? true : undefined}>{t}</span>
          ))}
        </div>
      </div>
      <p className="fine">Product names belong to their owners. Integrations rely on third-party services and follow their terms.</p>
    </section>
  );
}
