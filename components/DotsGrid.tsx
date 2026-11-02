"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { gsap, useGSAP, Flip, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import { DOTS, type Category } from "@/lib/dots";

const FILTERS: ("All" | Category)[] = ["All", "Core", "Personal", "Creative", "Dev"];

export default function DotsGrid() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState<(typeof FILTERS)[number]>("All");

  useGSAP(
    () => {
      ScrollTrigger.batch(".dotcard", {
        start: "top 92%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, ease: "back.out(1.5)" }),
      });
    },
    { scope: root }
  );

  /** Flip: cards glide to their new positions when the filter changes. */
  const filter = (f: (typeof FILTERS)[number]) => {
    setActive(f);
    const cards = gsap.utils.toArray<HTMLElement>(".dotcard", root.current!);
    const reduce = prefersReducedMotion();
    const state = Flip.getState(cards);
    cards.forEach((c) => c.classList.toggle("is-hidden", f !== "All" && c.dataset.cat !== f));
    if (reduce) { ScrollTrigger.refresh(); return; }
    Flip.from(state, {
      duration: 0.7,
      ease: "power3.inOut",
      absolute: true,
      stagger: 0.025,
      scale: true,
      onComplete: () => ScrollTrigger.refresh(),
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.25, ease: "back.out(1.6)" }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.6, duration: 0.3 }),
    });
  };

  return (
    <section ref={root} id="dots" className="sec sec-soft center">
      <div className="container">
        <SectionHead tag="Meet the Dots" sub="Each Dot has its own instructions, model, tools and permissions. Mix them into a workflow, or talk to one directly.">
          Eighteen specialists. Or <span className="v">build your own</span>.
        </SectionHead>
        <div className="filters" role="group" aria-label="Filter Dots" data-reveal>
          {FILTERS.map((f) => (
            <button key={f} className="filter" aria-pressed={active === f} onClick={() => filter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="dotgrid">
          {DOTS.map((d) => (
            <article key={d.key} className="dotcard" data-cat={d.category} data-reveal style={{ background: d.tint }}>
              <div className="pic"><Image src={`/dots/${d.key}.png`} alt={`${d.name} Dot`} width={256} height={256} /></div>
              <b>{d.name}</b>
              <span className="r">{d.role}</span>
              <em>{d.category}</em>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
