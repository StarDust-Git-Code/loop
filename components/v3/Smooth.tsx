"use client";

import { gsap, useGSAP, ScrollSmoother, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/**
 * Rendered before every section that makes ScrollTriggers, so the smoother exists first.
 * Also: anchor links, the scroll progress bar, the nav hiding on the way down,
 * and the page-wide [data-rise] entrances.
 */
export default function Smooth() {
  useGSAP(() => {
    const reduced = prefersReducedMotion();
    if (reduced) document.documentElement.classList.add("rm");

    const smoother = reduced
      ? null
      : ScrollSmoother.create({ wrapper: "#smooth-wrapper", content: "#smooth-content", smooth: 1.2, effects: true, smoothTouch: 0.1 });

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      const sel = a?.getAttribute("href");
      if (!a || !sel || sel === "#") return;
      const target = document.querySelector(sel);
      if (!target) return;
      e.preventDefault();
      if (smoother) smoother.scrollTo(target, true, "top top");
      else target.scrollIntoView({ block: "start" });
    };
    document.addEventListener("click", onClick);

    gsap.to(".progress", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
    });

    const nav = document.querySelector<HTMLElement>(".nav");
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        if (!nav) return;
        nav.classList.toggle("scrolled", self.scroll() > 40);
        if (reduced) return;
        const hide = self.scroll() > 500 && self.direction === 1;
        gsap.to(nav, { yPercent: hide ? -140 : 0, duration: 0.4, ease: "power3.out", overwrite: "auto" });
      },
    });

    if (!reduced) {
      ScrollTrigger.batch("[data-rise]", {
        start: "top 88%",
        once: true,
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 1.1, ease: "power4.out", stagger: 0.09 }),
      });
    }

    // fonts and images change heights after first layout
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);

    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("load", refresh);
    };
  });
  return null;
}
