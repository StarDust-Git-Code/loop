"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import { TINTS, type DotKey } from "@/lib/dots";

const FEATURES: { k: DotKey; tint: string; title: string; text: string }[] = [
  { k: "planner", tint: TINTS.yellow, title: "Agent Studio", text: "Connect triggers, knowledge, Dots and actions on a visual canvas. Test it, save it, run it again." },
  { k: "browser", tint: TINTS.mint, title: "A workspace you can watch", text: "Browser, terminal, files and notes sit beside the canvas, so you can see what every agent is doing." },
  { k: "recall", tint: TINTS.cyan, title: "Knowledge and memory", text: "A knowledge graph and retrieval with citations. Choose what is private to one Dot and what is shared." },
  { k: "byte", tint: TINTS.violet, title: "Skills, MCP and Ultracode", text: "Teach Dots reusable skills, plug in MCP servers, and hand big coding jobs to long checkpointed runs." },
  { k: "halo", tint: TINTS.blue, title: "Harness and approvals", text: "Permission modes, hooks, retries and guardrails. Anything risky waits for your OK." },
  { k: "mimo", tint: TINTS.pink, title: "Automations", text: "Run on a schedule or a trigger: scripts, images, videos and digests, with a Telegram ping when you are needed." },
];

export default function Features() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const tiles = gsap.utils.toArray<HTMLElement>(".feature");
      ScrollTrigger.batch(tiles, {
        start: "top 88%",
        once: true,
        onEnter: (batch) =>
          gsap.fromTo(batch, { rotate: (i: number) => (i % 2 ? 3 : -3) }, { opacity: 1, y: 0, rotate: 0, duration: 0.9, stagger: 0.12, ease: "back.out(1.3)" }),
      });
      if (prefersReducedMotion()) return;

      // gentle idle bob, desynchronised
      gsap.utils.toArray<HTMLElement>(".feature .art img").forEach((img, i) => {
        gsap.to(img, { y: -10, duration: 2 + (i % 3) * 0.4, repeat: -1, yoyo: true, ease: "sine.inOut", delay: i * 0.2 });
      });

      // 3D pointer tilt
      if (window.matchMedia("(hover: hover)").matches) {
        tiles.forEach((tile) => {
          const rx = gsap.quickTo(tile, "rotationX", { duration: 0.5, ease: "power3.out" });
          const ry = gsap.quickTo(tile, "rotationY", { duration: 0.5, ease: "power3.out" });
          const img = tile.querySelector(".art img");
          const ix = gsap.quickTo(img, "x", { duration: 0.6, ease: "power3.out" });
          tile.addEventListener("pointermove", (e) => {
            const r = tile.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width - 0.5;
            const py = (e.clientY - r.top) / r.height - 0.5;
            ry(px * 10); rx(-py * 10); ix(px * 24);
          });
          tile.addEventListener("pointerleave", () => { rx(0); ry(0); ix(0); });
        });
      }
    },
    { scope: root }
  );

  return (
    <section ref={root} id="features" className="sec center">
      <div className="container">
        <SectionHead tag="Platform">
          Not another chatbot. A place where <span className="v">work gets done</span>.
        </SectionHead>
        <div className="grid-auto" style={{ perspective: 1200 }}>
          {FEATURES.map((f) => (
            <article key={f.title} className="tile feature" data-reveal style={{ background: f.tint }}>
              <div className="art">
                <Image src={`/dots/${f.k}.png`} alt="" width={256} height={256} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
