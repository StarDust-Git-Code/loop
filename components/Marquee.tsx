"use client";

import { Fragment, useRef } from "react";
import { gsap, useGSAP, ScrollSmoother, prefersReducedMotion } from "@/lib/gsap";
import MateImg from "./MateImg";
import type { MateKey } from "@/lib/mates";

const VERBS: [string, MateKey][] = [
  ["Plan", "planner"], ["Research", "research"], ["Code", "code"], ["Write", "writer"],
  ["Browse", "browser"], ["Watch", "mimo"], ["Remember", "recall"], ["Call", "tune"],
];
const PLACES = ["Dashboard", "Phone", "Telegram", "Discord", "Slack", "WhatsApp", "Voice"];

const Star = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill="currentColor" />
  </svg>
);

function Verbs({ hidden }: { hidden?: boolean }) {
  return (
    <div className="mq-half" aria-hidden={hidden}>
      {VERBS.map(([word, k]) => (
        <Fragment key={word}>
          <span className="mq-w">{word}</span>
          <MateImg k={k} size={72} />
        </Fragment>
      ))}
    </div>
  );
}

function Places({ hidden }: { hidden?: boolean }) {
  return (
    <div className="mq-half" aria-hidden={hidden}>
      {PLACES.map((word) => (
        <Fragment key={word}>
          <span className="mq-w stroke">{word}</span>
          <Star />
        </Fragment>
      ))}
    </div>
  );
}

/** Two rows running in opposite directions. They speed up and lean with the scroll. */
export default function Marquee() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;

      const rows = gsap.utils.toArray<HTMLElement>(".mq", el);
      const loops = rows.map((row, i) =>
        gsap.fromTo(row, { xPercent: i % 2 ? -50 : 0 }, { xPercent: i % 2 ? 0 : -50, duration: i % 2 ? 46 : 38, ease: "none", repeat: -1 })
      );
      const skew = gsap.quickTo(el.querySelector(".mq-wrap"), "skewX", { duration: 0.5, ease: "power3.out" });

      const scrollY = () => ScrollSmoother.get()?.scrollTop() ?? window.scrollY;
      let last = scrollY();
      let vel = 0;
      let lean = 0;
      const tick = () => {
        const y = scrollY();
        vel += (y - last - vel) * 0.18;
        last = y;
        if (Math.abs(vel) < 0.02) vel = 0;
        const boost = 1 + Math.min(7, Math.abs(vel) / 5);
        loops.forEach((t) => t.timeScale(boost));
        const next = gsap.utils.clamp(-7, 7, vel * -0.12);
        if (Math.abs(next - lean) > 0.01) { lean = next; skew(next); }
      };
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    },
    { scope: root }
  );

  return (
    <section ref={root} className="mq-sec" aria-label="What the Mates do, and where they reach you">
      <div className="mq-wrap">
        <div className="mq"><Verbs /><Verbs hidden /></div>
        <div className="mq"><Places /><Places hidden /></div>
      </div>
    </section>
  );
}
