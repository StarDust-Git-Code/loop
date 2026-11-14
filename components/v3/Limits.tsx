"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

const LIMITS = [
  { h: "It can’t work while your computer is off.", p: "Loopmates runs on your own computer. When it is off or asleep, so are your Mates." },
  { h: "It won’t do anything risky on its own.", p: "Sending, deleting, spending and posting all wait for your yes." },
  { h: "It won’t type your passwords.", p: "The browser refuses password fields. You sign in to sites yourself." },
  { h: "It can’t use apps you haven’t connected.", p: "Google, Telegram, Discord, GitHub and the rest each need a one-time setup." },
  { h: "It needs a Windows or Linux computer.", p: "The server runs on Windows 10 or 11, or Linux. Your phone and browser connect to it." },
  { h: "Calls have limits.", p: "A call lasts up to 10 minutes, with at most three at the same time." },
];

/** The honest list. */
export default function Limits() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.utils.toArray<HTMLElement>(".lm-item").forEach((el, i) => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 88%" } });
        tl.from(el, { y: 50, autoAlpha: 0, duration: 0.9, ease: "power4.out", delay: (i % 2) * 0.08 })
          .from(el.querySelector(".lm-x"), { scale: 0, rotate: -90, duration: 0.6, ease: "back.out(2.5)" }, 0.2);
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="limits" className="lm">
      <div className="sec-head" data-rise>
        <h2>What it can&rsquo;t do.</h2>
        <p>Worth knowing before you join.</p>
      </div>
      <ul className="lm-grid">
        {LIMITS.map((l) => (
          <li key={l.h} className="lm-item">
            <span className="lm-x" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </span>
            <div>
              <h3>{l.h}</h3>
              <p>{l.p}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
