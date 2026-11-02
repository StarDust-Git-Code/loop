"use client";

import { useRef } from "react";
import { gsap, useGSAP, SplitText, prefersReducedMotion } from "@/lib/gsap";

/** Headline (word mask reveal) + subtitle, triggered on scroll. */
export default function SectionHead({
  children,
  sub,
  align = "center",
}: {
  tag?: string;
  children: React.ReactNode;
  sub?: string;
  align?: "center" | "left";
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !root.current) return;
      const h = root.current.querySelector<HTMLElement>("h2");
      const sub = root.current.querySelector<HTMLElement>(".sub");
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: "top 82%", once: true },
      });
      if (h) {
        SplitText.create(h, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) => {
            gsap.set(h, { opacity: 1, y: 0, filter: "blur(0px)" });
            return tl.from(self.lines, { yPercent: 115, filter: "blur(14px)", duration: 1.1, stagger: 0.12, ease: "power4.out" }, 0.1);
          },
        });
      }
      if (sub) tl.to(sub, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out" }, 0.45);
    },
    { scope: root }
  );

  return (
    <div ref={root} style={{ textAlign: align }}>
      <h2 className="h2" data-reveal style={{ marginTop: 0, ...(align === "left" ? { marginLeft: 0 } : null) }}>
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
