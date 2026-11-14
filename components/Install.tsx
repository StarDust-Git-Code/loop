"use client";

import { useRef } from "react";
import { gsap, useGSAP, playInView, prefersReducedMotion } from "@/lib/gsap";
import { SplitHeading } from "./SectionHead";
import Magnetic from "./Magnetic";
import MateImg from "./MateImg";
import { REPO_URL } from "@/lib/site";

export default function Install() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;

      // the commands type themselves the first time the terminal is seen
      const typed = gsap.utils.toArray<HTMLElement>(".type", el);
      gsap.set(typed, { clipPath: "inset(0% 100% 0% 0%)" });
      gsap.set(".caret", { visibility: "hidden" });
      const tl = gsap.timeline({ delay: 0.5, scrollTrigger: { trigger: ".term", start: "top 80%", once: true } });
      typed.forEach((t) => {
        const n = Math.max(4, (t.textContent ?? "").length);
        tl.to(t, { clipPath: "inset(0% 0% 0% 0%)", duration: n * 0.032, ease: `steps(${n})` }, "+=0.35");
      });
      tl.set(".caret", { visibility: "visible" });

      playInView(
        ".term-wrap",
        gsap.utils.toArray<HTMLElement>(".term-mate", el).map((m, i) =>
          gsap.to(m, { y: -12, rotation: i % 2 ? -4 : 4, duration: 2.2 + i * 0.35, ease: "sine.inOut", yoyo: true, repeat: -1 })
        )
      );
    },
    { scope: root }
  );

  return (
    <section ref={root} id="install" className="sec install">
      <div className="wrap install-in">
        <div className="lbl" data-reveal>Run your own</div>
        <SplitHeading>Bring them <span className="acc">home</span>.</SplitHeading>
        <p className="lede" data-reveal>
          You need a Windows or Linux computer that stays on, a free Firebase project and a free Gemini API key. The
          installer adds Node 22 for you.
        </p>

        <div className="term-wrap">
          <MateImg k="scout" size={140} className="term-mate l" />
          <MateImg k="byte" size={140} className="term-mate r" />
          <div className="term" data-reveal>
            <div className="term-bar" aria-hidden="true">Install</div>
            <div className="term-body">
              <div className="c"># Windows</div>
              <div><span className="acc" aria-hidden="true">&gt; </span><span className="type">cd backend</span></div>
              <div><span className="acc" aria-hidden="true">&gt; </span><span className="type">powershell -ExecutionPolicy Bypass -File .\install.ps1</span></div>
              <div className="c"># Linux</div>
              <div><span className="acc" aria-hidden="true">$ </span><span className="type">cd backend &amp;&amp; ./install.sh</span><i className="caret" aria-hidden="true" /></div>
            </div>
          </div>
        </div>

        <p className="install-note" data-reveal>
          It registers a service that restarts itself, adds the loopmates command and opens the setup page. Pair the
          dashboard with a code and you are in.
        </p>
        <span data-reveal>
          <Magnetic strength={0.28}>
            <a href={REPO_URL} className="btn btn-acc btn-lg">
              Get the code on GitHub
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg>
            </a>
          </Magnetic>
        </span>
      </div>
    </section>
  );
}
