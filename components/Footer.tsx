"use client";

import { useRef } from "react";
import { gsap, useGSAP, playInView, prefersReducedMotion } from "@/lib/gsap";
import MateImg from "./MateImg";
import { REPO_URL, DASHBOARD_URL } from "@/lib/site";
import type { MateKey } from "@/lib/mates";

const SITTERS: MateKey[] = ["mimo", "ops", "chef", "recall", "writer", "browser", "zen", "data", "tune", "spark"];

export default function Footer() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;

      // the wordmark rises letter by letter, then the Mates drop onto it
      const letters = gsap.utils.toArray<HTMLElement>(".wordmark span", el);
      const mates = gsap.utils.toArray<HTMLElement>(".foot-mate", el);
      gsap.set(letters, { yPercent: 110 });
      gsap.set(mates, { autoAlpha: 0, y: -160 });
      gsap.timeline({ scrollTrigger: { trigger: ".wordmark", start: "top 92%", once: true } })
        .to(letters, { yPercent: 0, duration: 1.2, ease: "power4.out", stagger: 0.05 }, 0)
        .to(mates, { autoAlpha: 1, duration: 0.2, stagger: 0.07 }, 0.5)
        .to(mates, { y: 0, duration: 1.15, ease: "bounce.out", stagger: 0.07 }, 0.5);

      playInView(
        el,
        gsap.utils.toArray<HTMLElement>(".foot-mate img", el).map((img, i) =>
          gsap.to(img, { rotation: i % 2 ? 7 : -7, duration: 1.5 + (i % 3) * 0.3, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.12 })
        )
      );
    },
    { scope: root }
  );

  return (
    <footer ref={root} className="footer">
      <div className="wrap">
        <div className="foot-mates" aria-hidden="true">
          {SITTERS.map((k) => (
            <span className="foot-mate" key={k}><MateImg k={k} size={76} /></span>
          ))}
        </div>
        <div className="wordmark" aria-hidden="true">
          {"loop".split("").map((c, i) => <span key={`l${i}`}>{c}</span>)}
          {"mates".split("").map((c, i) => <span key={`m${i}`} className="acc">{c}</span>)}
        </div>
        <div className="foot-bar">
          <p>
            Loopmates is an active personal project. The backend test suite passes end to end. Live voice calls, Slack,
            WhatsApp, Spotify and Home Assistant have not been verified with real accounts yet. No license has been
            chosen, so the code is all rights reserved for now.
          </p>
          <nav className="foot-links" aria-label="Footer">
            <a className="navlink" href={REPO_URL}>GitHub</a>
            <a className="navlink" href={DASHBOARD_URL}>Open dashboard</a>
            <a className="navlink" href="#mates">Mates</a>
            <a className="navlink" href="#safety">Safety</a>
            <a className="navlink" href="#top">Back to top</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
