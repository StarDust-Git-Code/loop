"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import { TINTS } from "@/lib/dots";

const ITEMS = [
  { title: "Approval before risky actions", text: "File writes outside the workspace and outgoing messages wait for your OK.", tint: TINTS.violet },
  { title: "Only the chats you choose", text: "Agents read WhatsApp chats you tick, read-only, through an opt-in local bridge.", tint: TINTS.mint },
  { title: "Everything is logged", text: "Each tool call appears in the run log with a time and the Dot that made it.", tint: TINTS.yellow },
  { title: "Stop any time", text: "Pause or cancel a run from the dashboard or from Telegram.", tint: TINTS.pink },
];

export default function Safety() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const halo = root.current!.querySelector(".halo-big");
      gsap.from(halo, { scale: 0, rotate: -25, duration: 1.1, ease: "elastic.out(1,0.55)", scrollTrigger: { trigger: halo, start: "top 88%", once: true } });
      if (!prefersReducedMotion()) {
        gsap.to(halo, { y: -14, duration: 2.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
      }
      ScrollTrigger.batch(".safe-card", {
        start: "top 90%",
        once: true,
        onEnter: (b) => gsap.fromTo(b, { rotate: (i: number) => (i % 2 ? 4 : -4) }, { opacity: 1, y: 0, rotate: 0, duration: 0.8, stagger: 0.12, ease: "back.out(1.5)" }),
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="safety" className="sec center">
      <div className="container">
        <Image className="halo-big" src="/dots/halo.png" alt="Halo, the approvals Dot" width={256} height={256} />
        <SectionHead tag="Safety" sub="Agents are powerful, so Loop makes their actions visible and puts you in charge of the risky ones.">
          You stay in the <span className="v">driver’s seat</span>.
        </SectionHead>
        <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: 16 }}>
          {ITEMS.map((s) => (
            <div key={s.title} className="tile safe-card" data-reveal style={{ background: s.tint }}>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em" }}>{s.title}</div>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--body)", marginTop: 10 }}>{s.text}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
