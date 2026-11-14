"use client";

import { gsap, useGSAP, ScrollSmoother, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/**
 * Must be rendered BEFORE any component that creates ScrollTriggers (sibling order),
 * so ScrollSmoother exists first. Also drives the top progress bar, the nav state
 * and the page-wide [data-reveal] entrance.
 */
export default function SmoothSetup() {
  useGSAP(() => {
    const reduced = prefersReducedMotion();
    if (reduced) document.documentElement.classList.add("rm");

    const smoother = reduced
      ? null
      : ScrollSmoother.create({
          wrapper: "#smooth-wrapper",
          content: "#smooth-content",
          smooth: 1.1,
          effects: true,
        });

    // anchor links -> smooth scroll
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const sel = a.getAttribute("href");
      if (!sel || sel === "#") return;
      const target = document.querySelector(sel);
      if (!target) return;
      e.preventDefault();
      if (smoother) smoother.scrollTo(target, true, sel === "#top" ? "top top" : "top 40px");
      else target.scrollIntoView({ behavior: "auto", block: "start" });
    };
    document.addEventListener("click", onClick);

    // progress bar
    gsap.to(".progress", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.3 },
    });

    // nav: stronger glass after scrolling, hide on scroll down, show on scroll up
    const nav = document.querySelector<HTMLElement>(".nav");
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        if (!nav) return;
        nav.classList.toggle("scrolled", self.scroll() > 40);
        if (reduced) return;
        const hide = self.scroll() > 400 && self.direction === 1;
        gsap.to(nav, { yPercent: hide ? -130 : 0, duration: 0.35, ease: "power3.out", overwrite: "auto" });
      },
    });

    // every [data-reveal] rises in as it enters; neighbours entering together are staggered
    if (!reduced) {
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 92%",
        once: true,
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 1.05, ease: "power3.out", stagger: 0.07 }),
      });
    }

    return () => document.removeEventListener("click", onClick);
  });
  return null;
}
