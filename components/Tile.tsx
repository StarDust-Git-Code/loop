"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion, canHover } from "@/lib/gsap";

/** A card that tilts gently toward the pointer. */
export default function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion() || !canHover()) return;
      gsap.set(el, { transformPerspective: 900 });
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3.out" });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3.out" });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        ry((x - 0.5) * 5);
        rx((0.5 - y) * 5);
      };
      const leave = () => { rx(0); ry(0); };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: ref }
  );

  return (
    <article ref={ref} className={`tile ${className}`.trim()}>
      {children}
    </article>
  );
}
