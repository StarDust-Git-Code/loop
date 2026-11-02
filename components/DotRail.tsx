"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, Draggable, prefersReducedMotion } from "@/lib/gsap";
import { RAIL_ORDER, dot } from "@/lib/dots";

const START_INDEX = 2; // Mimo is centred on load
const N = RAIL_ORDER.length;
const COPIES = 3; // the list is rendered 3x; position wraps so the rail never ends

export default function DotRail() {
  const rail = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const proxy = useRef<HTMLDivElement>(null);
  const api = useRef<{ go: (dir: number) => void } | null>(null);

  useGSAP(
    () => {
      const railEl = rail.current!;
      const trackEl = track.current!;
      const proxyEl = proxy.current!;
      const wraps = Array.from(trackEl.children) as HTMLElement[];
      const cards = wraps.map((w) => w.querySelector<HTMLElement>(".rc")!);
      const reduce = prefersReducedMotion();

      let cw = 0;
      let step = 0; // distance between neighbouring card centres
      let setW = 0; // width of one full copy of the list
      let baseX = 0; // track x that centres card 0 of the middle copy
      let centers: number[] = [];

      const measure = () => {
        cw = railEl.clientWidth;
        centers = wraps.map((w) => w.offsetLeft + w.offsetWidth / 2);
        step = centers[1] - centers[0];
        setW = centers[N] - centers[0];
        baseX = cw / 2 - centers[N];
      };

      // keep the track inside one cycle so there is always content on both sides
      const wrapX = (x: number) => baseX - gsap.utils.wrap(0, setW, baseX - x);

      // per-card tilt / scale / depth-of-field blur, driven by distance from the centre
      const focus = () => {
        const x = Number(gsap.getProperty(trackEl, "x"));
        for (let i = 0; i < cards.length; i++) {
          const raw = (centers[i] + x - cw / 2) / (cw * 0.36);
          if (raw > 2.2 || raw < -2.2) continue; // off-screen, skip work
          const d = Math.max(-1.25, Math.min(1.25, raw));
          const a = Math.abs(d);
          gsap.set(cards[i], {
            rotation: d * 9,
            scale: 1.08 - Math.min(a, 1) * 0.24,
            y: Math.min(a, 1) * 18,
            zIndex: Math.round(100 - a * 40),
            filter: reduce || a < 0.12 ? "none" : `blur(${(Math.min(a, 1.25) * 2.4).toFixed(2)}px)`,
          });
        }
      };

      const apply = () => {
        gsap.set(trackEl, { x: wrapX(Number(gsap.getProperty(proxyEl, "x"))) });
        focus();
      };

      measure();
      gsap.set(proxyEl, { x: baseX - START_INDEX * step });
      apply();

      const drag = Draggable.create(proxyEl, {
        type: "x",
        trigger: railEl,
        inertia: true,
        minimumMovement: 4,
        allowContextMenu: true,
        onDrag: apply,
        onThrowUpdate: apply,
        snap: { x: (v: number) => baseX - Math.round((baseX - v) / step) * step },
      })[0];

      const go = (dir: number) => {
        const x = Number(gsap.getProperty(proxyEl, "x"));
        const k = Math.round((baseX - x) / step);
        gsap.to(proxyEl, { x: baseX - (k + dir) * step, duration: 1.15, ease: "expo.out", onUpdate: apply, overwrite: true });
      };
      api.current = { go };

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
          gsap.delayedCall(0.4, () => (lock = false));
        }
      };
      railEl.addEventListener("keydown", onKey);
      railEl.addEventListener("wheel", onWheel, { passive: false });

      const ro = new ResizeObserver(() => {
        const frac = (baseX - Number(gsap.getProperty(proxyEl, "x"))) / step;
        measure();
        gsap.set(proxyEl, { x: baseX - frac * step });
        apply();
      });
      ro.observe(railEl);

      // intro: cards rise in and de-blur (wrapper level, so it never fights the focus transforms)
      if (!reduce) {
        gsap.from(wraps, {
          y: 220,
          opacity: 0,
          filter: "blur(16px)",
          duration: 1.2,
          ease: "back.out(1.3)",
          stagger: { each: 0.06, from: N + START_INDEX },
          delay: 0.6,
          clearProps: "opacity,transform,filter",
        });
        gsap.from(proxyEl, { x: `+=${90}`, duration: 1.8, ease: "elastic.out(1,0.6)", delay: 1.6, onUpdate: apply });
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
      <div ref={rail} className="rail" tabIndex={0} role="region" aria-label="Meet the Dots. Drag sideways or use the arrow keys. It loops forever.">
        <div ref={proxy} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, visibility: "hidden" }} />
        <div ref={track} className="track">
          {Array.from({ length: COPIES }).flatMap((_, c) =>
            RAIL_ORDER.map((k, i) => {
              const d = dot(k);
              const main = c === 1;
              return (
                <div className="rc-wrap" key={`${c}-${k}`} aria-hidden={main ? undefined : true}>
                  <article className="rc" style={{ background: d.tint }}>
                    <span className="bubble" style={{ background: d.bubble }}>@{d.name.toLowerCase()}</span>
                    <Image src={`/dots/${k}.png`} alt={main ? `${d.name} Dot: ${d.role}` : ""} width={384} height={384} priority={main && i < 6} draggable={false} />
                  </article>
                </div>
              );
            })
          )}
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
