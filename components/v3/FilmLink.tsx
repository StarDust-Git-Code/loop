"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import { FILM_URL } from "@/lib/site";

/** A link to the film on YouTube. The card opens up as it scrolls in. */
export default function FilmLink() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(
        ".fl-card",
        { scale: 0.82, borderRadius: 64, y: 60 },
        { scale: 1, borderRadius: 32, y: 0, ease: "none", scrollTrigger: { trigger: ".fl-card", start: "top bottom", end: "center 55%", scrub: 0.8 } }
      );
      gsap.fromTo(".fl-card img", { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".fl-card", start: "top bottom", end: "bottom top", scrub: true } });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="film" className="fl">
      <div className="sec-head" data-rise>
        <h2>See it in four minutes.</h2>
        <p>The film walks through the real app, one Mate at a time. It opens on YouTube.</p>
      </div>
      <a className="fl-card" href={FILM_URL} target="_blank" rel="noopener noreferrer">
        <Image src="/film/poster.jpg" alt="Still from the film: Mimo calls about the open garage door" fill sizes="(max-width: 1280px) 100vw, 1280px" />
        <span className="fl-shade" aria-hidden="true" />
        <span className="fl-btn">
          <span className="fl-play" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
          </span>
          Watch on YouTube
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
        </span>
      </a>
    </section>
  );
}
