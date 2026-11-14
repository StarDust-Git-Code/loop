"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { SplitText } from "gsap/SplitText";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

let registered = false;

/** Register the GSAP plugins once, on the client only. */
export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollSmoother, SplitText, MotionPathPlugin, DrawSVGPlugin);
  ScrollTrigger.config({ ignoreMobileResize: true });
  registered = true;
}

registerGsap();

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const canHover = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

/** Looping animations only run while their section is on screen. */
export function playInView(trigger: Element | string, anims: gsap.core.Animation[]) {
  anims.forEach((a) => a.pause());
  return ScrollTrigger.create({
    trigger,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => anims.forEach((a) => (self.isActive ? a.resume() : a.pause())),
  });
}

export { gsap, useGSAP, ScrollTrigger, ScrollSmoother, SplitText, MotionPathPlugin, DrawSVGPlugin };
