"use client";

import { useRef } from "react";
import { gsap, useGSAP, playInView, prefersReducedMotion } from "@/lib/gsap";
import { SplitHeading } from "./SectionHead";
import MateImg from "./MateImg";

const RULES = [
  { title: "Sealed on your disk", text: "Model keys, bot tokens and OAuth refresh tokens are sealed on your computer with AES-256-GCM. The dashboard and the phone only hold a sign-in token." },
  { title: "Allow-list only", text: "Only the email addresses you list can use your server. The setup page answers only on that computer." },
  { title: "Approvals by default", text: "Deleting, messaging other people, pushing code, spending money, and anything touching locks or alarms waits for you." },
  { title: "Hard guards", text: "Mates never buy anything or type passwords, card numbers or one-time codes. Gmail can only save drafts." },
  { title: "Data is not instructions", text: "Text from web pages, email, chats and notes is labelled as outside content. Mates are told never to follow instructions found in it." },
];

export default function Safety() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      playInView(".seal", [
        gsap.to(".seal svg", { rotation: 360, transformOrigin: "50% 50%", duration: 44, ease: "none", repeat: -1 }),
        gsap.to(".seal img", { y: -12, rotation: 4, duration: 2.2, ease: "sine.inOut", yoyo: true, repeat: -1 }),
      ]);
    },
    { scope: root }
  );

  return (
    <section ref={root} id="safety" className="sec">
      <div className="wrap safe" data-reveal>
        <div className="safe-left">
          <div className="lbl">Safety</div>
          <SplitHeading>Your keys<br />stay home.</SplitHeading>
          <div className="seal" aria-hidden="true">
            <svg viewBox="0 0 260 260">
              <circle cx="130" cy="130" r="124" fill="none" stroke="rgba(244,241,234,0.3)" strokeWidth="1.5" strokeDasharray="2 10" strokeLinecap="round" />
            </svg>
            <MateImg k="halo" size={200} />
          </div>
        </div>
        <ol className="rules">
          {RULES.map((r, i) => (
            <li className="rule" key={r.title}>
              <i aria-hidden="true">{i + 1}</i>
              <div>
                <b>{r.title}</b>
                <span>{r.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
