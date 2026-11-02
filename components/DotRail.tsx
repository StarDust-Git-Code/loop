"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, Draggable, prefersReducedMotion } from "@/lib/gsap";
import { RAIL_ORDER, dot } from "@/lib/dots";

const START_INDEX = 2; // Mimo is centred on load

export default function DotRail() {
  const rail = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const api = useRef<{ go: (dir: number) => void } | null>(null);

  useGSAP(
    () => {
      const railEl = rail.current!;
      const trackEl = track.current!;
      const wraps = Array.from(trackEl.children) as HTMLElement[];
      const cards = wraps.map((w) => w.querySelector<HTMLElement>(".rc")!);
      const reduce = prefersReducedMotion();

      let centers: number[] = [];
      let cw = 0;
      let minX = 0;
      let maxX = 0;

      const measure = () => {
        cw = railEl.clientWidth;
        centers = wraps.map((w) => w.offsetLeft + w.offsetWidth / 2);
        maxX = cw / 2 - centers[0];
        minX = cw / 2 - centers[centers.length - 1];
      };

      const focus = () => {
        const x = Number(gsap.getProperty(trackEl, "x"));
        cards.forEach((card, i) => {
          const d = Math.max(-1.25, Math.min(1.25, (centers[i] + x - cw / 2) / (cw * 0.36)));
          const a = Math.abs(d);
          gsap.set(card, {
            rotation: d * 9,
            scale: 1.08 - Math.min(a, 1) * 0.24,
            y: Math.min(a, 1) * 18,
            zIndex: Math.round(100 - a * 40),
          });
        });
      };

      const nearest = (x: number) => {
        let best = 0;
        let bd = Infinity;
        centers.forEach((c, i) => {
          const dd = Math.abs(c + x - cw / 2);
          if (dd < bd) { bd = dd; best = i; }
        });
        return best;
      };
      const xFor = (i: number) => gsap.utils.clamp(minX, maxX, cw / 2 - centers[i]);

      measure();
      gsap.set(trackEl, { x: xFor(START_INDEX) });
      focus();

      const drag = Draggable.create(trackEl, {
        type: "x",
        inertia: true,
        edgeResistance: 0.85,
        bounds: { minX, maxX },
        allowContextMenu: true,
        cursor: "grab",
        activeCursor: "grabbing",
        onDrag: focus,
        onThrowUpdate: focus,
        snap: { x: (v: number) => xFor(nearest(v)) },
      })[0];

      const go = (dir: number) => {
        const target = Math.max(0, Math.min(cards.length - 1, nearest(Number(gsap.getProperty(trackEl, "x"))) + dir));
        gsap.to(trackEl, { x: xFor(target), duration: 0.8, ease: "power3.out", onUpdate: focus, overwrite: true });
      };
      api.current = { go };

      // keyboard + horizontal trackpad
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      };
      let lock = false;
      const onWheel = (e: WheelEvent) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 8) {
          e.preventDefault();
          if (lock) return;
          lock = true;
          go(e.deltaX > 0 ? 1 : -1);
          gsap.delayedCall(0.45, () => (lock = false));
        }
      };
      railEl.addEventListener("keydown", onKey);
      railEl.addEventListener("wheel", onWheel, { passive: false });

      const ro = new ResizeObserver(() => {
        measure();
        drag.applyBounds({ minX, maxX });
        gsap.set(trackEl, { x: gsap.utils.clamp(minX, maxX, Number(gsap.getProperty(trackEl, "x"))) });
        focus();
      });
      ro.observe(railEl);

      // intro: cards rise in (wrapper level, so it never fights the focus transforms)
      if (!reduce) {
        gsap.from(wraps, {
          y: 220,
          opacity: 0,
          duration: 1.1,
          ease: "back.out(1.4)",
          stagger: { each: 0.07, from: START_INDEX },
          delay: 0.7,
          clearProps: "opacity,transform",
        });
        // friendly idle nudge so people notice it scrolls
        gsap.fromTo(trackEl, { x: xFor(START_INDEX) + 90 }, { x: xFor(START_INDEX), duration: 1.6, ease: "elastic.out(1,0.6)", delay: 1.7, onUpdate: focus });
      }

      return () => {
        ro.disconnect();
        railEl.removeEventListener("keydown", onKey);
        railEl.removeEventListener("wheel", onWheel);
        drag.kill();
      };
    },
    { scope: rail }
  );

  return (
    <div className="rail-wrap">
      <div ref={rail} className="rail" tabIndex={0} role="region" aria-label="Meet the Dots. Drag sideways or use the arrow keys.">
        <div ref={track} className="track">
          {RAIL_ORDER.map((k, i) => {
            const d = dot(k);
            return (
              <div className="rc-wrap" key={k}>
                <article className="rc" style={{ background: d.tint }}>
                  <span className="bubble" style={{ background: d.bubble }}>@{d.name.toLowerCase()}</span>
                  <Image src={`/dots/${k}.png`} alt={`${d.name} Dot: ${d.role}`} width={384} height={384} priority={i < 6} draggable={false} />
                </article>
              </div>
            );
          })}
        </div>
      </div>
      <button className="arr" aria-label="Previous Dot" onClick={() => api.current?.go(-1)} style={{ left: "clamp(8px,2vw,24px)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15121A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button className="arr" aria-label="Next Dot" onClick={() => api.current?.go(1)} style={{ right: "clamp(8px,2vw,24px)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15121A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}
