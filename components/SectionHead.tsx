"use client";

import { useRef } from "react";
import { gsap, useGSAP, SplitText, prefersReducedMotion } from "@/lib/gsap";

/** Tag pill (scramble-in) + headline (word mask reveal) + subtitle, triggered on scroll. */
export default function SectionHead({
  tag,
  children,
  sub,
  align = "center",
}: {
  tag: string;
  children: React.ReactNode;
  sub?: string;
  align?: "center" | "left";
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !root.current) return;
      const tagEl = root.current.querySelector<HTMLElement>(".tag-text");
      const h = root.current.querySelector<HTMLElement>("h2");
      const sub = root.current.querySelector<HTMLElement>(".sub");
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: "top 82%", once: true },
      });
      if (tagEl) {
        tl.to(root.current.querySelector(".tag"), { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0);
        tl.to(tagEl, { duration: 0.9, scrambleText: { text: tag, chars: "upperCase", speed: 0.6 } }, 0);
      }
      if (h) {
        SplitText.create(h, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) => {
            gsap.set(h, { opacity: 1, y: 0 });
            return tl.from(self.lines, { yPercent: 115, duration: 1, stagger: 0.12, ease: "power4.out" }, 0.1);
          },
        });
      }
      if (sub) tl.to(sub, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.45);
    },
    { scope: root }
  );

  return (
    <div ref={root} style={{ textAlign: align }}>
      <span className="tag" data-reveal>
        <i>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6A4DF4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17L17 7M8 7h9v9" />
          </svg>
        </i>
        <span className="tag-text">{tag}</span>
      </span>
      <h2 className="h2" data-reveal style={align === "left" ? { marginLeft: 0 } : undefined}>
        {children}
      </h2>
      {sub && (
        <p className="sub" data-reveal style={align === "left" ? { marginLeft: 0 } : undefined}>
          {sub}
        </p>
      )}
    </div>
  );
}
