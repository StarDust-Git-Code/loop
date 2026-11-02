"use client";

import { gsap, useGSAP, ScrollSmoother, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/**
 * Must be rendered BEFORE any component that creates ScrollTriggers (sibling order),
 * so ScrollSmoother exists first. Also drives the top progress bar and the nav state.
 */
export default function SmoothSetup() {
  useGSAP(() => {
    if (prefersReducedMotion()) {
      document.documentElement.classList.add("rm");
    }
    const smoother = prefersReducedMotion()
      ? null
      : ScrollSmoother.create({
          wrapper: "#smooth-wrapper",
          content: "#smooth-content",
          smooth: 1.1,
          effects: true,
        });

    // anchor links -> smooth scroll
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"], [data-scroll]');
      if (!a) return;
      const sel = a.getAttribute("href") ?? a.getAttribute("data-scroll");
      if (!sel || sel === "#") return;
      const target = document.querySelector(sel);
      if (!target) return;
      e.preventDefault();
      if (smoother) smoother.scrollTo(target, true, "top 90px");
      else target.scrollIntoView({ behavior: "auto", block: "start" });
    };
    document.addEventListener("click", onClick);

    // progress bar
    gsap.to(".progress", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.3 },
    });

    // nav: glass pill after scrolling, hide on scroll down, show on scroll up
    const nav = document.querySelector<HTMLElement>(".nav");
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        if (!nav) return;
        nav.classList.toggle("scrolled", self.scroll() > 40);
        if (self.scroll() > 400) {
          gsap.to(nav, { yPercent: self.direction === 1 ? -120 : 0, duration: 0.35, ease: "power3.out", overwrite: "auto" });
        } else {
          gsap.to(nav, { yPercent: 0, duration: 0.35, overwrite: "auto" });
        }
      },
    });

    return () => document.removeEventListener("click", onClick);
  });
  return null;
}
