"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import MateImg from "@/components/MateImg";
import { ALL_MATES } from "@/lib/mates";

const ON = ALL_MATES.filter((m) => m.on);
const OFF = ALL_MATES.filter((m) => !m.on);

/** All 19 Mates, with what each one is for. */
export default function Team() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.utils.toArray<HTMLElement>(".tm-group").forEach((group) => {
        const cards = group.querySelectorAll(".mate");
        gsap.fromTo(
          cards,
          { y: 70, autoAlpha: 0, rotate: (i: number) => (i % 2 ? 4 : -4) },
          { y: 0, autoAlpha: 1, rotate: 0, duration: 1, ease: "power4.out", stagger: { each: 0.05, from: "start" }, scrollTrigger: { trigger: group, start: "top 85%" } }
        );
      });
      const offs = gsap.utils.toArray<HTMLElement>(".mate").map((card) => {
        const img = card.querySelector("img");
        const poke = () => {
          if (!img) return;
          gsap.timeline()
            .to(img, { rotate: 12, scale: 1.12, duration: 0.18, ease: "power2.out" })
            .to(img, { rotate: 0, scale: 1, duration: 1, ease: "elastic.out(1,0.35)" });
        };
        card.addEventListener("pointerenter", poke);
        return () => card.removeEventListener("pointerenter", poke);
      });
      return () => offs.forEach((off) => off());
    },
    { scope: root }
  );

  const card = (m: (typeof ALL_MATES)[number]) => (
    <li key={m.key} className="mate">
      <MateImg k={m.key} size={96} />
      <div>
        <h3>{m.name}</h3>
        <p>{m.role}</p>
      </div>
    </li>
  );

  return (
    <section ref={root} id="mates" className="team">
      <div className="sec-head" data-rise>
        <h2>Meet all 19 Mates.</h2>
        <p>Each one has a name, a voice and one job. Switch any of them on or off, change how they sound, or make your own.</p>
      </div>
      <div className="tm-group">
        <h3 className="tm-h">Working from day one</h3>
        <ul className="mates">{ON.map(card)}</ul>
      </div>
      <div className="tm-group">
        <h3 className="tm-h">Switch on when you want them</h3>
        <ul className="mates">
          {OFF.map(card)}
          <li className="mate mate-own">
            <span className="mate-plus" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <div>
              <h3>Your own Mate</h3>
              <p>Give it a name, a job and a voice. It joins the team like any other.</p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
