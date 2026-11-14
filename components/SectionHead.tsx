"use client";

import { useRef } from "react";
import { gsap, useGSAP, SplitText, prefersReducedMotion } from "@/lib/gsap";

/** An h2 whose lines rise out of a mask the first time it scrolls into view. */
export function SplitHeading({ children, className = "h2" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const h = ref.current;
      if (!h || prefersReducedMotion()) return;
      SplitText.create(h, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) => {
          gsap.set(h, { visibility: "visible" });
          return gsap.from(self.lines, {
            yPercent: 118,
            duration: 1.25,
            ease: "power4.out",
            stagger: 0.11,
            scrollTrigger: { trigger: h, start: "top 90%", once: true },
          });
        },
      });
    },
    { scope: ref }
  );

  return (
    <h2 ref={ref} className={`${className} split`}>
      {children}
    </h2>
  );
}

/** Section header: a numbered label and headline on the left, a short lede on the right. */
export default function SectionHead({
  label,
  lede,
  children,
}: {
  label: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="head">
      <div className="head-main">
        <div className="lbl" data-reveal>{label}</div>
        <SplitHeading>{children}</SplitHeading>
      </div>
      {lede && <p className="lede" data-reveal>{lede}</p>}
    </div>
  );
}
