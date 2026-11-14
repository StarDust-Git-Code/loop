"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import MateImg from "./MateImg";
import { ROSTER, TOTAL_MATES } from "@/lib/mates";

const pad = (n: number) => String(n).padStart(2, "0");

/** Pick a Mate on the left, meet it on the right. Cycles by itself until you touch it. */
export default function Roster() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const shown = useRef(0);
  const touched = useRef(false);
  const inView = useRef(false);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      ScrollTrigger.create({
        trigger: ".roster-body",
        start: "top 80%",
        end: "bottom 20%",
        onToggle: (self) => { inView.current = self.isActive; },
      });
      gsap.to(".stage-glow", { scale: 1.15, duration: 3, ease: "sine.inOut", yoyo: true, repeat: -1 });
      const id = window.setInterval(() => {
        if (!touched.current && inView.current) setActive((a) => (a + 1) % ROSTER.length);
      }, 3600);
      return () => window.clearInterval(id);
    },
    { scope: root }
  );

  // the newly picked Mate pops onto the stage
  useGSAP(
    () => {
      if (shown.current === active) return;
      shown.current = active;
      const panel = gsap.utils.toArray<HTMLElement>(".panel", root.current)[active];
      if (!panel) return;
      if (prefersReducedMotion()) {
        gsap.set(".stage-glow", { backgroundColor: ROSTER[active].color });
        return;
      }
      gsap.to(".stage-glow", { backgroundColor: ROSTER[active].color, duration: 0.6, ease: "power2.out" });
      gsap.fromTo(
        panel.querySelector(".panel-img"),
        { scale: 0.35, rotation: -20, y: 50 },
        { scale: 1, rotation: 0, y: 0, duration: 0.95, ease: "elastic.out(1,0.6)", overwrite: true }
      );
      gsap.fromTo(
        panel.querySelectorAll(".panel-t"),
        { y: 22, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.55, ease: "power3.out", stagger: 0.05, overwrite: true }
      );
    },
    { scope: root, dependencies: [active] }
  );

  const pick = (i: number) => {
    touched.current = true;
    setActive(i);
  };

  return (
    <section ref={root} id="mates" className="sec">
      <div className="wrap stack">
        <SectionHead
          label="The team"
          lede="Every Mate has its own role card: how it works, how it sounds, how it signs off and which colleagues it leans on. Type @research to pull one into a chat. Mimo, the leader, hands the work out."
        >
          Meet the Mates.
        </SectionHead>

        <div className="roster-body">
          <div className="mate-list">
            {ROSTER.map((m, i) => (
              <button
                key={m.key}
                type="button"
                className="mrow"
                data-reveal
                aria-pressed={i === active}
                onPointerEnter={(e) => { if (e.pointerType === "mouse") pick(i); }}
                onFocus={() => pick(i)}
                onClick={() => pick(i)}
              >
                <span className="mnum">{pad(i + 1)}</span>
                <span className="mname">{m.name}</span>
                <span className="mrole">{m.role}</span>
              </button>
            ))}
            <p className="mate-more" data-reveal>
              Plus Ops, Chef, Zen, Tune, Data, Byte and five more, and any custom agent you create.
            </p>
          </div>

          <div className="stage-wrap" data-reveal>
            <div className="stage">
              <div className="stage-glow" aria-hidden="true" style={{ backgroundColor: ROSTER[0].color }} />
              {ROSTER.map((m, i) => (
                <div key={m.key} className={i === active ? "panel on" : "panel"} aria-hidden={i !== active}>
                  <div className="panel-top lbl panel-t">
                    <span>Mate {i + 1} of {TOTAL_MATES}</span>
                    <span>{m.tag}</span>
                  </div>
                  <MateImg k={m.key} size={260} className="panel-img" />
                  <div className="panel-name panel-t">
                    <h3>{m.name}</h3>
                    <span>{m.role}</span>
                  </div>
                  <p className="panel-about panel-t">{m.about}</p>
                  <div className="panel-ask panel-t">
                    <span className="lbl">Ask it</span>
                    <span>“{m.ask}”</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
