"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import { TINTS, type DotKey } from "@/lib/dots";

const STEPS: { k: DotKey; tint: string; title: string; sub: string }[] = [
  { k: "planner", tint: TINTS.yellow, title: "Idea", sub: "Takes the next topic from your list" },
  { k: "writer", tint: TINTS.yellow, title: "Script", sub: "Hook, beats and call to action" },
  { k: "spark", tint: TINTS.peach, title: "Image prompts", sub: "One prompt per scene" },
  { k: "browser", tint: TINTS.mint, title: "Images", sub: "ChatGPT in your browser" },
  { k: "browser", tint: TINTS.mint, title: "Video", sub: "Google Flow in your browser" },
  { k: "halo", tint: TINTS.violet, title: "Review", sub: "You approve the final cut" },
  { k: "ops", tint: TINTS.blue, title: "Ping", sub: "Telegram tells you it is ready" },
];

export default function Automations() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root.current);
      const steps = q(".step") as HTMLElement[];
      gsap.set(steps, { opacity: 0, y: 40 });
      gsap.to(steps, {
        opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "back.out(1.4)",
        scrollTrigger: { trigger: ".pipe", start: "top 82%", once: true },
      });
      if (prefersReducedMotion()) { steps.forEach((s) => s.classList.add("on")); gsap.set(".pipe-line i", { scaleX: 1 }); return; }

      // the line fills as you scroll, lighting each step it reaches
      gsap.to(".pipe-line i", {
        scaleX: 1, ease: "none",
        scrollTrigger: {
          trigger: ".pipe", start: "top 70%", end: "bottom 45%", scrub: 0.4,
          onUpdate: (self) => steps.forEach((s, i) => s.classList.toggle("on", self.progress >= (i + 0.4) / steps.length)),
        },
      });
      gsap.fromTo(q(".step .top img"), { rotate: -8 }, { rotate: 8, duration: 1.8, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: { each: 0.15, from: "random" } });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="automations" className="sec sec-soft center">
      <div className="container">
        <SectionHead tag="Automations" sub="A content studio is one example: script, image prompts, images and video, with you approving the final cut.">
          Set it up once. <span className="v">Let it run</span> on a schedule.
        </SectionHead>
        <div className="pipe">
          <div className="pipe-line" aria-hidden="true"><i /></div>
          <div className="pipe-grid">
            {STEPS.map((s, i) => (
              <div key={s.title} className="tile step" style={{ background: s.tint }}>
                <div className="top">
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>0{i + 1}</span>
                  <Image src={`/dots/${s.k}.png`} alt="" width={112} height={112} />
                </div>
                <b>{s.title}</b>
                <p>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="fine" style={{ maxWidth: 760, marginTop: 22, fontSize: 14, lineHeight: 1.6 }}>
          Browser steps use your own signed-in accounts in the built-in browser. Loop never stores your passwords, asks before each batch, and pauses and pings you if a login, captcha or usage limit appears.
        </p>
      </div>
    </section>
  );
}
