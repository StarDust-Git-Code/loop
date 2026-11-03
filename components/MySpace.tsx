"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";

const BULLETS = [
  "Memories you can search by meaning, not just keywords",
  "A schedule your Mates can help you manage",
  "Talk to Mimo by text or voice, any time",
  "Private by default. Other Mates see only what you share",
];

export default function MySpace() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root.current);
      gsap.from(q(".checks li"), {
        x: -30, opacity: 0, duration: 0.6, stagger: 0.12, ease: "power3.out",
        scrollTrigger: { trigger: ".checks", start: "top 85%", once: true },
      });
      gsap.to(q(".chat-shell"), {
        opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: ".chat-shell", start: "top 85%", once: true },
      });

      // conversation plays out once, with a typing indicator before each reply
      const items = q(".chat-body > *") as HTMLElement[];
      const typing = q(".typing")[0] as HTMLElement;
      if (prefersReducedMotion()) return;
      gsap.set(items, { opacity: 0, y: 18, scale: 0.94, transformOrigin: "0 100%" });
      gsap.set(typing, { opacity: 0 });
      gsap.to(q(".typing i"), { y: -4, duration: 0.35, repeat: -1, yoyo: true, stagger: 0.12, ease: "sine.inOut" });

      const tl = gsap.timeline({ scrollTrigger: { trigger: ".chat-shell", start: "top 65%", once: true } });
      items.forEach((el) => {
        if (el === typing) return;
        const isAi = el.classList.contains("ai") || el.classList.contains("event");
        if (isAi) {
          tl.set(typing, { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }, ">+0.1");
          tl.set(typing, { opacity: 0 }, ">+0.8");
        }
        tl.to(el, { opacity: 1, y: 0, filter: "blur(0px)", scale: 1, duration: 0.5, ease: "back.out(1.6)" }, isAi ? ">" : ">+0.5");
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="myspace" className="sec">
      <div className="container split">
        <div>
          <SectionHead tag="My Space" align="left" sub="Keep memories, notes and your schedule in one private place. Talk to Mimo by text or voice, and ask for anything back later.">
            Your second brain, with a friend named <span className="v">Mimo</span>.
          </SectionHead>
          <ul className="checks">
            {BULLETS.map((b) => (
              <li key={b}><i aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg></i><span>{b}</span></li>
            ))}
          </ul>
        </div>
        <div className="chat-shell" data-reveal>
          <div className="chat">
            <div className="chat-head">
              <Image src="/dots/mimo.png" alt="" width={56} height={56} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Mimo</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Private. Only you and Mimo.</div>
              </div>
            </div>
            <div className="chat-body">
              <div className="msg me">Remind me to review the design tomorrow evening.</div>
              <div className="msg ai">Done. I added it and set a Telegram ping.</div>
              <div className="event">
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0B4B6F", background: "#DDF0FB", borderRadius: 6, padding: "3px 8px" }}>Event</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Review design</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Tomorrow, 18:00 · ping 15 min before</div>
                </div>
              </div>
              <div className="msg me">What ideas did I note last week?</div>
              <div className="msg ai">Two notes found. <span className="mono" style={{ fontSize: 12, background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "3px 8px", marginLeft: 4 }}>Idea · Mon</span></div>
              <div className="typing" aria-hidden="true"><i /><i /><i /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
