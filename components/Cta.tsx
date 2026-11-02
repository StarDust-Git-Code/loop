"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { gsap, useGSAP, SplitText, prefersReducedMotion } from "@/lib/gsap";
import Magnetic from "./Magnetic";
import type { DotKey } from "@/lib/dots";

const FLOATERS: { k: DotKey; left: string; top: string }[] = [
  { k: "mimo", left: "4%", top: "8%" },
  { k: "spark", left: "86%", top: "6%" },
  { k: "byte", left: "6%", top: "62%" },
  { k: "halo", left: "87%", top: "58%" },
  { k: "research", left: "20%", top: "80%" },
  { k: "browser", left: "74%", top: "82%" },
];

export default function Cta() {
  const root = useRef<HTMLElement>(null);
  const [state, setState] = useState<"idle" | "done">("idle");

  useGSAP(
    () => {
      const el = root.current!;
      gsap.to(el.querySelector(".cta"), {
        opacity: 1, y: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
      if (prefersReducedMotion()) return;

      // each Dot drifts along its own curved motion path
      gsap.utils.toArray<HTMLElement>(".cta-dot").forEach((d, i) => {
        const r = 26 + (i % 3) * 14;
        gsap.to(d, {
          duration: 7 + i * 1.3,
          repeat: -1,
          ease: "none",
          motionPath: {
            path: [{ x: 0, y: 0 }, { x: r, y: -r }, { x: 0, y: -r * 1.6 }, { x: -r, y: -r }, { x: 0, y: 0 }],
            curviness: 1.6,
          },
        });
        gsap.to(d, { rotate: i % 2 ? 10 : -10, duration: 2.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
      });
      gsap.from(".cta-dot", {
        scale: 0, duration: 0.9, stagger: 0.1, ease: "back.out(2)",
        scrollTrigger: { trigger: el, start: "top 70%", once: true },
      });

      const h = el.querySelector<HTMLElement>(".h2")!;
      SplitText.create(h, {
        type: "words,chars", autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.chars, { yPercent: 80, opacity: 0, duration: 0.6, stagger: 0.02, ease: "back.out(2)", scrollTrigger: { trigger: h, start: "top 85%", once: true } }),
      });
    },
    { scope: root }
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: connect to your waitlist backend (e.g. POST to an API route). Nothing is stored yet.
    setState("done");
    gsap.fromTo(".cta-note", { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(2)" });
  };

  return (
    <section ref={root} id="join" style={{ padding: "0 clamp(16px,4vw,48px) clamp(48px,7vw,96px)" }}>
      <div className="container">
        <div className="cta center" data-reveal>
          {FLOATERS.map((f) => (
            <Image key={f.k} className="cta-dot" src={`/dots/${f.k}.png`} alt="" width={128} height={128} style={{ left: f.left, top: f.top }} />
          ))}
          <h2 className="h2">Ready to put the Dots to work?</h2>
          <p className="sub">Loop is in early access. Leave your email and we will let you in as spots open.</p>
          <form onSubmit={onSubmit}>
            <label htmlFor="em" className="sr">Email address</label>
            <input id="em" type="email" required placeholder="you@example.com" />
            <Magnetic><button type="submit" className="btn-dark">Get early access</button></Magnetic>
          </form>
          <p className="cta-note" aria-live="polite">
            {state === "done" ? "Thanks! You’re on the list." : "No spam. Screens on this page are mockups of the product in development."}
          </p>
        </div>
      </div>
    </section>
  );
}
