"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import Loops3D, { type LoopsApi } from "./Loops3D";
import MateImg from "@/components/MateImg";

const ROW_A = ["Home Assistant", "Notion", "Obsidian", "GitHub", "Google", "Spotify"];
const ROW_B = ["Telegram", "WhatsApp", "Slack", "Discord", "MCP servers"];

const POINTS = [
  { h: "Your machine is the server", p: "One process on Windows or Linux. The dashboard and your phone find it by themselves." },
  { h: "Your keys stay home", p: "Model keys and files never leave your computer. Start free on Gemini, Groq, Cerebras, NVIDIA NIM or OpenRouter." },
  { h: "Halo asks first", p: "Nothing is sent, deleted, spent or posted until you say yes, and you see exactly what will happen." },
];

/** The loops settle into a laptop; promises and the apps it works with. */
export default function HomeSection() {
  const root = useRef<HTMLElement>(null);
  const [api, setApi] = useState<LoopsApi | null>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".hm-laptop", {
        y: 120,
        rotateX: 28,
        autoAlpha: 0,
        ease: "power3.out",
        scrollTrigger: { trigger: ".hm-laptop", start: "top 95%", end: "top 45%", scrub: 0.8 },
      });
      gsap.utils.toArray<HTMLElement>(".hm-row").forEach((row, i) => {
        const inner = row.querySelector(".hm-row-in");
        gsap.fromTo(inner, { xPercent: i ? -50 : 0 }, { xPercent: i ? 0 : -50, duration: 40, ease: "none", repeat: -1 });
        gsap.fromTo(row, { x: i ? -120 : 120 }, { x: i ? 120 : -120, ease: "none", scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: true } });
      });
    },
    { scope: root }
  );

  // the loops arrive big and settle onto the screen
  useGSAP(
    () => {
      if (!api || prefersReducedMotion()) return;
      gsap.fromTo(api.camera.position, { z: 3.2 }, {
        z: 6.4,
        ease: "power2.out",
        scrollTrigger: { trigger: ".hm-laptop", start: "top 90%", end: "center 55%", scrub: 1 },
      });
    },
    { scope: root, dependencies: [api] }
  );

  return (
    <section ref={root} id="home" className="hm">
      <h2 className="hm-h" data-rise>It lives on your computer,<br />not in someone&rsquo;s cloud.</h2>
      <div className="hm-grid">
        <div className="hm-laptop" aria-hidden="true">
          <div className="hm-screen">
            <div className="hm-glow" />
            <Loops3D className="hm-gl" follow={false} distance={6.4} tilt={[0.35, -0.5, 0.12]} onReady={setApi} />
            <div className="hm-mate hm-mate-l"><MateImg k="mimo" size={90} /></div>
            <div className="hm-mate hm-mate-r"><MateImg k="research" size={80} /></div>
          </div>
          <div className="hm-base" />
        </div>
        <div className="hm-points">
          {POINTS.map((x) => (
            <div key={x.h} data-rise>
              <h3>{x.h}</h3>
              <p>{x.p}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="hm-works">
        <p className="sr">Works with {[...ROW_A, ...ROW_B].join(", ")}.</p>
        {[ROW_A, ROW_B].map((row, i) => (
          <div key={i} className="hm-row" aria-hidden="true">
            <div className="hm-row-in">
              {[...row, ...row, ...row, ...row].map((n, j) => (
                <span key={j} className={n === "Home Assistant" ? "hi" : undefined}>{n}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
