"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import type { DotKey } from "@/lib/dots";

const STEPS: { k: DotKey; title: string; sub: string; token: string }[] = [
  { k: "planner", title: "Idea", sub: "Takes the next topic from your list.", token: "Topic" },
  { k: "writer", title: "Script", sub: "Hook, beats and a call to action.", token: "Script" },
  { k: "spark", title: "Image prompts", sub: "One prompt per scene.", token: "Prompts" },
  { k: "browser", title: "Images", sub: "ChatGPT, in your own browser.", token: "Images" },
  { k: "code", title: "Video", sub: "Google Flow, in your own browser.", token: "Video" },
  { k: "halo", title: "Review", sub: "You approve the final cut.", token: "Final cut" },
  { k: "ops", title: "Ping", sub: "Telegram tells you it is ready.", token: "Done" },
];

/** Sample previews of what each stage hands to the next one (placeholder content). */
function Preview({ i }: { i: number }) {
  if (i === 0)
    return (
      <div className="pv-list">
        {["5 habits that save an hour a day", "How tides work, in 60 seconds", "A tiny history of the paperclip"].map((t, n) => (
          <div key={t} className={`pv-row${n === 0 ? " hot" : ""}`}>
            <span>{t}</span>
            <em>{n === 0 ? "Next up" : "Queued"}</em>
          </div>
        ))}
      </div>
    );
  if (i === 1)
    return (
      <div className="pv-script mono">
        <p><b>HOOK</b> You lose an hour a day to the same five things.</p>
        <p><b>BEAT 1</b> Batch your messages. Check twice, not all day.</p>
        <p><b>BEAT 2</b> Write the next step before you stop.</p>
        <p><b>CTA</b> Try one habit tomorrow.</p>
      </div>
    );
  if (i === 2)
    return (
      <div className="pv-list">
        {["Scene 1 · a clock melting into a calendar, soft light", "Scene 2 · hands closing a laptop at golden hour", "Scene 3 · a tidy desk with one glowing note"].map((t) => (
          <div key={t} className="pv-row"><span className="mono">{t}</span></div>
        ))}
      </div>
    );
  if (i === 3)
    return (
      <div className="pv-tiles">
        {[1, 2, 3, 4].map((n) => <div key={n} className="pv-tile" style={{ ["--h" as string]: `${n * 38 + 200}` }}><span>Scene {n}</span></div>)}
      </div>
    );
  if (i === 4)
    return (
      <div className="pv-video">
        <div className="pv-frame"><svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg></div>
        <div className="pv-bar"><i /></div>
        <div className="pv-meta mono"><span>final-cut-v1.mp4</span><span>0:58</span></div>
      </div>
    );
  if (i === 5)
    return (
      <div className="pv-review">
        <div className="pv-frame small"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg></div>
        <div>
          <b>Final cut is ready</b>
          <p>Nothing is published until you say so.</p>
          <div className="pv-btns"><span className="go">Approve</span><span className="ghost">Ask for changes</span></div>
        </div>
      </div>
    );
  return (
    <div className="pv-ping">
      <div className="tg"><b>TG</b><span>Your video is ready to review. Open it in Loop, or reply here to approve.</span></div>
      <span className="pv-chip">Runs every Monday · 9:00</span>
    </div>
  );
}

export default function Automations() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const nodes = gsap.utils.toArray<HTMLElement>(".station", el);
      const outs = gsap.utils.toArray<HTMLElement>(".out", el);
      const runner = el.querySelector<HTMLElement>(".runner")!;
      const token = el.querySelector<HTMLElement>(".runner span")!;
      const fill = el.querySelector<HTMLElement>(".track-line i")!;
      const n = STEPS.length;

      if (prefersReducedMotion()) { nodes.forEach((s) => s.classList.add("done")); gsap.set(fill, { scaleX: 1 }); return; }

      const cx = (i: number) => {
        const t = el.querySelector<HTMLElement>(".track")!;
        const node = nodes[i].querySelector<HTMLElement>(".node")!.getBoundingClientRect();
        return node.left - t.getBoundingClientRect().left + node.width / 2;
      };
      gsap.set(outs.slice(1), { opacity: 0 });
      gsap.set(runner, { x: () => cx(0) });

      let active = -1;
      const setActive = (i: number) => {
        if (i === active) return;
        active = i;
        nodes.forEach((s, k) => { s.classList.toggle("on", k === i); s.classList.toggle("done", k < i); });
        token.textContent = STEPS[i].token;
      };
      setActive(0);

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el.querySelector(".auto-pin"),
          start: "top top",
          end: () => "+=" + Math.round(window.innerHeight * 3.4),
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => setActive(Math.min(n - 1, Math.floor(self.progress * n + 0.0001))),
        },
      });

      for (let i = 0; i < n; i++) {
        if (i > 0) {
          tl.to(runner, { x: () => cx(i), duration: 0.55, ease: "power2.inOut" }, i - 0.05);
          tl.to(outs[i - 1], { opacity: 0, y: -16, filter: "blur(8px)", duration: 0.3, ease: "power2.in" }, i - 0.05);
          tl.fromTo(outs[i], { opacity: 0, y: 18, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.45, ease: "power3.out", immediateRender: false }, i + 0.15);
        }
      }
      tl.to(fill, { scaleX: 1, duration: n - 1, ease: "none" }, 0);
      tl.to({}, { duration: 1 }, n - 1); // hold on the last stage
      gsap.to(runner.querySelector("span"), { y: -4, duration: 0.9, repeat: -1, yoyo: true, ease: "sine.inOut" });

      const r = () => ScrollTrigger.refresh();
      if (document.fonts?.ready) document.fonts.ready.then(r);
    },
    { scope: root }
  );

  return (
    <section ref={root} id="automations" className="auto-sec">
      <div className="auto-pin">
        <div className="auto-wrap">
          <SectionHead sub="A content studio is one example: script, image prompts, images and video, with you approving the final cut.">
            Set it up once. <span className="v">Let it run</span> on a schedule.
          </SectionHead>

          <div className="track">
            <div className="track-line" aria-hidden="true"><i /></div>
            <div className="runner" aria-hidden="true"><span className="mono">Topic</span></div>
            <ol className="stations">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`station${i === 0 ? " on" : ""}`}>
                  <span className="node">
                    <Image src={`/dots/${s.k}.png`} alt="" width={64} height={64} />
                    <i className="check" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg></i>
                  </span>
                  <b>{s.title}</b>
                </li>
              ))}
            </ol>
          </div>

          <div className="out-card">
            {STEPS.map((s, i) => (
              <div className="out" key={s.title}>
                <div className="out-head">
                  <span className="mono">0{i + 1}</span>
                  <div><b>{s.title}</b><p>{s.sub}</p></div>
                </div>
                <div className="out-body"><Preview i={i} /></div>
              </div>
            ))}
          </div>

          <p className="fine" style={{ maxWidth: 720, marginTop: 14 }}>
            Browser steps use your own signed-in accounts in the built-in browser. Loopmates never stores your passwords, asks before each batch, and pauses and pings you if a login, captcha or usage limit appears. Sample previews shown.
          </p>
        </div>
      </div>
    </section>
  );
}
