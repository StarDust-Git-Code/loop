"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { gsap, useGSAP, Flip, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import { DOTS, type Category } from "@/lib/dots";
import { DOT_INFO } from "@/lib/dotInfo";

const FILTERS: ("All" | Category)[] = ["All", "Core", "Personal", "Creative", "Dev"];

export default function DotsGrid() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState<(typeof FILTERS)[number]>("All");
  const [open, setOpen] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<string | null>(null);
  const closeFn = useRef<() => void>(() => {});
  const openFn = useRef<(key: string) => void>(() => {});
  const resets = useRef<Record<string, () => void>>({});
  const HOLD_MS = 2000;

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

  /** Reactive cards: 3D tilt toward the cursor, Mate parallax, cursor spotlight, neighbours dim + soften, click = bounce. */
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const grid = root.current!.querySelector<HTMLElement>(".dotgrid")!;
      const cleanups: (() => void)[] = [];
      const hold = { t: 0 };
      cleanups.push(() => window.clearTimeout(hold.t));
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
        const key = card.dataset.key!;
        const enter = (e: PointerEvent) => {
          if (e.pointerType !== "mouse") return;
          window.clearTimeout(hold.t);
          hold.t = window.setTimeout(() => openFn.current(key), HOLD_MS);
          grid.classList.add("has-hover");
          gsap.to(gsap.utils.toArray<HTMLElement>(".dotcard", grid).filter((c) => c !== card), { opacity: 0.55, filter: "blur(1.5px)", duration: 0.35, overwrite: "auto" });
          card.classList.add("is-hot");
          gsap.to(card, { scale: 1.06, y: -6, duration: 0.45, ease: "back.out(2)", overwrite: "auto" });
          gsap.to(pic, { scale: 1.14, rotation: gsap.utils.random(-5, 5), duration: 0.5, ease: "back.out(2.2)" });
          gsap.fromTo(name, { letterSpacing: "0.02em" }, { letterSpacing: "-0.03em", duration: 0.5, ease: "power3.out" });
        };
        const leave = () => {
          window.clearTimeout(hold.t);
          if (openRef.current === key) return; // the open panel takes over
          resetAll();
        };
        resets.current[key] = () => resetAll();
        const resetAll = () => {
          card.classList.remove("is-hot");
          grid.classList.remove("has-hover");
          gsap.to(gsap.utils.toArray<HTMLElement>(".dotcard", grid).filter((c) => c !== card), { opacity: 1, filter: "blur(0px)", duration: 0.4, overwrite: "auto" });
          rx(0); ry(0); px(0); py(0);
          gsap.to(card, { scale: 1, y: 0, duration: 0.6, ease: "elastic.out(1,0.6)", overwrite: "auto" });
          gsap.to(pic, { scale: 1, rotation: 0, duration: 0.6, ease: "elastic.out(1,0.6)" });
        };
        const click = (e: MouseEvent) => {
          if ((e as PointerEvent).pointerType && (e as PointerEvent).pointerType !== "mouse") { openFn.current(key); return; }
          gsap.timeline()
            .to(pic, { scaleX: 1.2, scaleY: 0.82, y: 6, duration: 0.12, ease: "power2.out" })
            .to(pic, { scaleX: 0.92, scaleY: 1.2, y: -28, duration: 0.22, ease: "power2.out" })
            .to(pic, { scaleX: 1, scaleY: 1, y: 0, rotation: 0, duration: 0.7, ease: "elastic.out(1,0.45)" });
        };
        card.addEventListener("pointermove", move);
        card.addEventListener("pointerenter", enter);
        card.addEventListener("pointerleave", leave);
        card.addEventListener("click", click);
        const keydown = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFn.current(key); } };
        card.addEventListener("keydown", keydown);
        cleanups.push(() => card.removeEventListener("keydown", keydown));
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


  /** Hold-to-expand: after ~2s of hovering (or tap / Enter) the card grows into an info panel. */
  useGSAP(
    () => {
      const grid = root.current!.querySelector<HTMLElement>(".dotgrid")!;
      const reduce = prefersReducedMotion();
      openFn.current = (key) => {
        if (openRef.current === key) return;
        openRef.current = key;
        setOpen(key);
      };
      closeFn.current = () => {
        const key = openRef.current;
        const pop = popRef.current;
        if (!key || !pop) return;
        openRef.current = null;
        const card = grid.querySelector<HTMLElement>(`.dotcard[data-key="${key}"]`);
        const done = () => { setOpen(null); resets.current[key]?.(); };
        if (!card || reduce) return done();
        gsap.to(pop.querySelectorAll(".pop-in"), { opacity: 0, y: 8, filter: "blur(6px)", duration: 0.18, overwrite: true });
        gsap.to(pop, {
          left: card.offsetLeft, top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight,
          duration: 0.45, ease: "expo.inOut", onComplete: done,
        });
      };
      const outside = (e: PointerEvent) => {
        const t = e.target as Node;
        if (popRef.current && !popRef.current.contains(t)) closeFn.current();
      };
      const esc = (e: KeyboardEvent) => { if (e.key === "Escape") closeFn.current(); };
      document.addEventListener("pointerdown", outside);
      document.addEventListener("keydown", esc);
      return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
    },
    { scope: root }
  );

  /** Animate the panel from the card's box to its expanded box. */
  useGSAP(
    () => {
      const pop = popRef.current;
      if (!open || !pop) return;
      const grid = root.current!.querySelector<HTMLElement>(".dotgrid")!;
      const card = grid.querySelector<HTMLElement>(`.dotcard[data-key="${open}"]`);
      if (!card) return;
      const W = Math.min(400, grid.clientWidth);
      gsap.set(pop, { width: W, height: "auto" });
      const H = pop.offsetHeight;
      const cx = card.offsetLeft + card.offsetWidth / 2;
      const cy = card.offsetTop + card.offsetHeight / 2;
      const left = Math.max(0, Math.min(grid.clientWidth - W, cx - W / 2));
      const top = Math.max(0, cy - H / 2);
      grid.classList.add("has-hover");
      card.classList.add("is-hot");
      gsap.to(gsap.utils.toArray<HTMLElement>(".dotcard", grid).filter((c) => c !== card), { opacity: 0.4, filter: "blur(2px)", duration: 0.35, overwrite: "auto" });
      const ins = pop.querySelectorAll(".pop-in");
      if (prefersReducedMotion()) { gsap.set(pop, { left, top, height: "auto" }); return; }
      gsap.fromTo(pop,
        { left: card.offsetLeft, top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight, opacity: 1 },
        { left, top, width: W, height: H, duration: 0.7, ease: "expo.out", onComplete: () => { gsap.set(pop, { height: "auto" }); } });
      gsap.fromTo(ins, { opacity: 0, y: 14, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, stagger: 0.07, delay: 0.18, ease: "power3.out" });
      gsap.to(pop.querySelector(".pop-img"), { y: -8, rotation: 2, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
    },
    { scope: root, dependencies: [open] }
  );

  /** Flip: cards glide to their new positions when the filter changes. */
  const filter = (f: (typeof FILTERS)[number]) => {
    closeFn.current();
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
        <SectionHead tag="Meet the Mates" sub="Each Mate has its own instructions, model, tools and permissions. Mix them into a workflow, or talk to one directly.">
          Eighteen specialists. Or <span className="v">build your own</span>.
        </SectionHead>
        <div className="filters" role="group" aria-label="Filter Mates" data-reveal>
          {FILTERS.map((f) => (
            <button key={f} className="filter" aria-pressed={active === f} onClick={() => filter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="dotgrid">
          {DOTS.map((d) => (
            <article key={d.key} className="dotcard" data-key={d.key} data-cat={d.category} tabIndex={0} data-reveal style={{ background: d.tint }}>
              <div className="pic"><Image src={`/dots/${d.key}.png`} alt={`${d.name} Mate`} width={256} height={256} /></div>
              <b>{d.name}</b>
              <span className="r">{d.role}</span>
              <em>{d.category}</em>
            </article>
          ))}
          {open && (() => {
            const d = DOTS.find((x) => x.key === open)!;
            const info = DOT_INFO[d.key];
            return (
              <div ref={popRef} className="dotpop" onPointerLeave={(e) => { if (e.pointerType === "mouse") closeFn.current(); }} role="dialog" aria-label={`About ${d.name}`} style={{ background: d.tint }}>
                <button className="pop-x pop-in" onClick={() => closeFn.current()} aria-label="Close">×</button>
                <div className="pop-top">
                  <div className="pop-img pop-in"><Image src={`/dots/${d.key}.png`} alt="" width={256} height={256} /></div>
                  <div>
                    <span className="pop-tag pop-in">@{d.key}</span>
                    <h3 className="pop-in">{d.name}</h3>
                    <p className="pop-role pop-in">{d.role}</p>
                  </div>
                </div>
                <p className="pop-about pop-in">{info?.about}</p>
                <div className="pop-tools pop-in">{info?.tools.map((t) => <span key={t}>{t}</span>)}</div>
                <div className="pop-ask pop-in"><small>Try asking</small>“{info?.ask}”</div>
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
