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
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, stagger: 0.05, ease: "back.out(1.5)" }),
      });
    },
    { scope: root }
  );

  /** Reactive cards: 3D tilt toward the cursor, Dot parallax, cursor spotlight, neighbours dim + soften, click = bounce. */
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const grid = root.current!.querySelector<HTMLElement>(".dotgrid")!;
      const cleanups: (() => void)[] = [];
      gsap.utils.toArray<HTMLElement>(".dotcard", grid).forEach((card) => {
        const pic = card.querySelector<HTMLElement>(".pic")!;
        const name = card.querySelector<HTMLElement>("b")!;
        const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
        const ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
        const px = gsap.quickTo(pic, "x", { duration: 0.6, ease: "power3.out" });
        const py = gsap.quickTo(pic, "y", { duration: 0.6, ease: "power3.out" });
        gsap.set(card, { transformPerspective: 700, transformOrigin: "50% 50%" });
        const move = (e: PointerEvent) => {
          if (e.pointerType !== "mouse") return;
          const r = card.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / r.height - 0.5;
          ry(nx * 16); rx(-ny * 16);
          px(nx * 16); py(ny * 12);
          card.style.setProperty("--mx", `${(nx + 0.5) * 100}%`);
          card.style.setProperty("--my", `${(ny + 0.5) * 100}%`);
        };
        const enter = (e: PointerEvent) => {
          if (e.pointerType !== "mouse") return;
          grid.classList.add("has-hover");
          gsap.to(gsap.utils.toArray<HTMLElement>(".dotcard", grid).filter((c) => c !== card), { opacity: 0.55, filter: "blur(1.5px)", duration: 0.35, overwrite: "auto" });
          card.classList.add("is-hot");
          gsap.to(card, { scale: 1.06, y: -6, duration: 0.45, ease: "back.out(2)", overwrite: "auto" });
          gsap.to(pic, { scale: 1.14, rotation: gsap.utils.random(-5, 5), duration: 0.5, ease: "back.out(2.2)" });
          gsap.fromTo(name, { letterSpacing: "0.02em" }, { letterSpacing: "-0.03em", duration: 0.5, ease: "power3.out" });
        };
        const leave = () => {
          grid.classList.remove("has-hover");
          gsap.to(gsap.utils.toArray<HTMLElement>(".dotcard", grid).filter((c) => c !== card), { opacity: 1, filter: "blur(0px)", duration: 0.4, overwrite: "auto" });
          card.classList.remove("is-hot");
          rx(0); ry(0); px(0); py(0);
          gsap.to(card, { scale: 1, y: 0, duration: 0.6, ease: "elastic.out(1,0.6)", overwrite: "auto" });
          gsap.to(pic, { scale: 1, rotation: 0, duration: 0.6, ease: "elastic.out(1,0.6)" });
        };
        const click = () => {
          gsap.timeline()
            .to(pic, { scaleX: 1.2, scaleY: 0.82, y: 6, duration: 0.12, ease: "power2.out" })
            .to(pic, { scaleX: 0.92, scaleY: 1.2, y: -28, duration: 0.22, ease: "power2.out" })
            .to(pic, { scaleX: 1, scaleY: 1, y: 0, rotation: 0, duration: 0.7, ease: "elastic.out(1,0.45)" });
        };
        card.addEventListener("pointermove", move);
        card.addEventListener("pointerenter", enter);
        card.addEventListener("pointerleave", leave);
        card.addEventListener("click", click);
        cleanups.push(() => {
          card.removeEventListener("pointermove", move);
          card.removeEventListener("pointerenter", enter);
          card.removeEventListener("pointerleave", leave);
          card.removeEventListener("click", click);
        });
      });
      return () => cleanups.forEach((fn) => fn());
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
