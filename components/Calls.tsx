"use client";

import { useRef } from "react";
import { gsap, useGSAP, playInView, prefersReducedMotion } from "@/lib/gsap";
import { SplitHeading } from "./SectionHead";
import MateImg from "./MateImg";

const FACTS = [
  { title: "“Call me at 6.”", text: "A Mate can set a call timer. It saves what it knows at that moment and brings it into the call." },
  { title: "Nothing gets lost.", text: "What was said goes back into the Mate's chat, and its follow-ups become tasks." },
  { title: "Quiet hours hold.", text: "Calls are capped per day and respect your quiet hours." },
];

const SAYS = [
  "“Quick one: do we demo the phone app first, or the dashboard?”",
  "“Got it. Dashboard first, phone app as the closer.”",
  "“I'll put the plan in the chat and add two tasks.”",
];

/** Resting heights of the waveform bars, so it reads as a waveform before (or without) motion. */
const BARS = [0.25, 0.5, 0.8, 0.45, 0.3, 0.65, 1, 0.7, 0.4, 0.55, 0.9, 0.6, 0.35, 0.75, 0.95, 0.5, 0.3, 0.6, 0.85, 0.45, 0.7, 0.4, 0.55, 0.25];

export default function Calls() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;
      const loops: gsap.core.Animation[] = [];

      gsap.utils.toArray<HTMLElement>(".halo", el).forEach((h, i) => {
        loops.push(gsap.fromTo(h, { scale: 0.75, opacity: 0.6 }, { scale: 1.75, opacity: 0, duration: 2.7, ease: "power1.out", repeat: -1, delay: i * 0.9 }));
      });
      gsap.utils.toArray<HTMLElement>(".bar", el).forEach((b, i) => {
        loops.push(gsap.to(b, { scaleY: () => 0.18 + Math.random() * 0.82, duration: 0.2 + (i % 5) * 0.045, ease: "sine.inOut", yoyo: true, repeat: -1, repeatRefresh: true, delay: i * 0.03 }));
      });
      loops.push(gsap.to(".ring img", { y: -8, rotation: 3, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1 }));
      loops.push(gsap.to(".call-yes", { scale: 1.1, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: -1 }));

      const says = gsap.utils.toArray<HTMLElement>(".say", el);
      const talk = gsap.timeline({ repeat: -1 });
      says.forEach((s) => {
        talk
          .fromTo(s, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" })
          .to(s, { autoAlpha: 0, y: -10, duration: 0.4, ease: "power2.in" }, "+=2.6");
      });
      loops.push(talk);

      playInView(".call-card", loops);
    },
    { scope: root }
  );

  return (
    <section ref={root} id="calls" className="sec">
      <div className="wrap calls">
        <div className="calls-copy">
          <div className="lbl" data-reveal>Voice calls</div>
          <SplitHeading>Sometimes they<br />just call.</SplitHeading>
          <p className="lede" data-reveal>
            Call a Mate, or let any Mate ring you when it needs your opinion. Each one speaks in its own voice.
          </p>
          <ul className="facts">
            {FACTS.map((f) => (
              <li className="fact" key={f.title} data-reveal>
                <b>{f.title}</b>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="call-card"
          data-reveal
          role="img"
          aria-label="An incoming voice call from Mimo about tomorrow's demo, with a live waveform and a transcript of the conversation."
        >
          <div className="call-top lbl" aria-hidden="true"><span>Incoming call</span><span>Gemini Live voice</span></div>
          <div className="ring" aria-hidden="true">
            <span className="halo" /><span className="halo" /><span className="halo" />
            <MateImg k="mimo" size={172} />
          </div>
          <div aria-hidden="true">
            <h3>Mimo is calling</h3>
            <p className="call-why">About tomorrow&apos;s demo. Two things need your opinion.</p>
          </div>
          <div className="wave" aria-hidden="true">
            {BARS.map((h, i) => <i key={i} className="bar" style={{ transform: `scaleY(${h})` }} />)}
          </div>
          <div className="says" aria-hidden="true">
            {SAYS.map((s) => <p className="say" key={s}>{s}</p>)}
          </div>
          <div className="call-btns" aria-hidden="true">
            <span className="btn btn-ghost btn-round">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </span>
            <span className="btn btn-acc btn-round call-yes">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
