"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import { DASH } from "@/lib/dashScreens";

const STEPS = [
  { title: "Ask", desc: "Describe the job in plain language. Chat is where you start, not where it ends.", url: "dashboard.loopmates.com/home" },
  { title: "Plan", desc: "Planner Mate breaks it into steps and hands each one to the right Mate.", url: "dashboard.loopmates.com/chat" },
  { title: "Watch it run", desc: "Every tool call is visible, and risky actions wait for your approval.", url: "dashboard.loopmates.com/run" },
  { title: "Collect", desc: "You get files and a report, plus a Telegram ping when it is done.", url: "dashboard.loopmates.com/run" },
];
const PROMPT = "Research SkillCourt and compare it with SmartCourt. Save sources and give me a short report.";
/**
 * Scroll-driven product tour. The section pins and scrolling plays the real dashboard screens
 * (Home → Chat → Run) with a fake cursor and a camera that zooms to where the action is.
 * Screens are generated from the Loop design files (see lib/dashScreens.ts).
 */
const W = 1760;

function Curtain({ cls, style }: { cls: string; style: React.CSSProperties }) {
  return <div className={`curtain ${cls}`} style={style} aria-hidden="true" />;
}

export default function Demo() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const reduce = prefersReducedMotion();
      const body = el.querySelector<HTMLElement>(".demo-body")!;
      const cam = el.querySelector<HTMLElement>(".dash-cam")!;
      const cursor = el.querySelector<HTMLElement>(".fake-cursor")!;
      const ripple = el.querySelector<HTMLElement>(".ripple")!;
      const urlEl = el.querySelector<HTMLElement>(".win-url")!;
      const items = gsap.utils.toArray<HTMLElement>(".step-item", el);
      const desc = el.querySelector<HTMLElement>(".step-desc")!;
      const L = (n: string) => el.querySelector<HTMLElement>(`.dash-layer[data-screen="${n}"]`)!;
      const home = L("home"), chat = L("chat"), run = L("run"), done = L("done");
      const task = el.querySelector<HTMLTextAreaElement>("#task")!;
      const dashRect = () => home.getBoundingClientRect();
      const bw = () => body.clientWidth;

      // fit view (reduced motion: static finished screen)
      const fit = () => bw() / W;
      if (reduce) {
        gsap.set([home, chat, run], { opacity: 0 });
        gsap.set(done, { opacity: 1 });
        gsap.set(cam, { scale: fit, x: 0, y: 0, transformOrigin: "0 0" });
        return;
      }

      // dash-space point inside a target element
      const pt = (sel: string, fx = 0.5, fy = 0.5) => {
        const t = el.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
        const d = dashRect();
        const sc = d.width / W;
        return { x: (t.left + t.width * fx - d.left) / sc, y: (t.top + t.height * fy - d.top) / sc };
      };
      // always the full screen, scaled to fit the window (no cropping)
      const view = () => ({ scale: fit(), x: 0, y: 0 });
      const moveTo = (tl: gsap.core.Timeline, at: number, dur: number, sel: string, fx = 0.5, fy = 0.5) =>
        tl.to(cursor, { x: () => pt(sel, fx, fy).x, y: () => pt(sel, fx, fy).y, duration: dur, ease: "power3.inOut" }, at);
      const click = (tl: gsap.core.Timeline, at: number, press?: string) => {
        tl.to(cursor, { scale: 0.82, duration: 0.5, ease: "power2.out" }, at)
          .fromTo(ripple, { scale: 0.2, opacity: 0.5 }, { scale: 1.7, opacity: 0, duration: 1.4, ease: "power2.out", immediateRender: false }, at)
          .to(cursor, { scale: 1, duration: 0.6, ease: "power2.out" }, at + 0.5);
        if (press) tl.to(press, { scale: 0.95, duration: 0.35, ease: "power2.out" }, at).to(press, { scale: 1, duration: 0.5, ease: "back.out(2.5)" }, at + 0.35);
      };
      const fade = (tl: gsap.core.Timeline, at: number, layer: HTMLElement, dur = 2.4) =>
        tl.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: dur, ease: "power2.inOut", immediateRender: false }, at);
      // wipe a curtain (white/card-coloured overlay) away top→bottom, so content appears to stream in
      const wipe = (tl: gsap.core.Timeline, at: number, dur: number, sel: string, from = 0, to = 100) =>
        tl.fromTo(sel, { "--p": from }, { "--p": to, duration: dur, ease: "none", immediateRender: false }, at);

      gsap.set(cam, { transformOrigin: "0 0", ...view() });
      gsap.set([chat, run, done], { opacity: 0 });
      gsap.set(".curtain", { "--p": 0 });
      gsap.set(cursor, { x: () => pt("#task", 0.9, 1.5).x, y: () => pt("#task", 0.9, 1.5).y, opacity: 0 });
      task.value = "";

      let active = -1;
      const setActive = (t: number) => {
        const i = t < 21 ? 0 : t < 45 ? 1 : t < 69 ? 2 : 3;
        if (i === active) return;
        active = i;
        items.forEach((it, n) => { it.classList.toggle("on", n === i); it.classList.toggle("done", n < i); });
        urlEl.textContent = STEPS[i].url;
        desc.textContent = STEPS[i].desc;
        gsap.fromTo(desc, { opacity: 0, y: 6, filter: "blur(4px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, overwrite: true });
      };
      setActive(0);

      const typed = { n: 0 };
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el.querySelector(".demo-pin"),
          start: "top top",
          end: () => "+=" + Math.round(window.innerHeight * 4.6),
          pin: true,
          scrub: 0.9,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            setActive(self.progress * 100);
          },
        },
      });

      /* 1 · Ask — Home screen (0–21) */
      tl.to(cursor, { opacity: 1, duration: 1 }, 0);
      moveTo(tl, 0.5, 3.4, "#task", 0.3, 0.45);
      click(tl, 4.1);
      tl.to("#task", { boxShadow: "0 0 0 0 transparent", duration: 0.01 }, 4.1);
      tl.to(task.parentElement!, { boxShadow: "0 0 0 3px rgba(106,77,244,.35), 0 20px 50px rgba(106,77,244,.14)", borderColor: "rgba(106,77,244,.7)", duration: 0.8 }, 4.3);
      tl.to(typed, { n: PROMPT.length, duration: 9, ease: "none", onUpdate: () => { task.value = PROMPT.slice(0, Math.round(typed.n)); } }, 5);
      moveTo(tl, 14.4, 3, '[data-demo="run"]', 0.5, 0.5);
      click(tl, 17.6, '[data-demo="run"]');
      fade(tl, 19.2, chat);

      /* 2 · Plan — Chat screen (21–45) */
      wipe(tl, 22.5, 7, ".curtain-chat", 0, 62);
      moveTo(tl, 23, 4, '[data-demo="plan-browse"]', 0.3, 0.5);
      wipe(tl, 30, 6, ".curtain-chat", 62, 100);
      click(tl, 37.2);
      tl.to('[data-demo="plan-browse"]', { color: "#6A4DF4", duration: 0.5 }, 37.3);
      fade(tl, 41, run);

      /* 3 · Watch it run — Run screen (45–69) */
      wipe(tl, 46, 7, ".curtain-run", 0, 100);
      moveTo(tl, 55, 4, '[data-demo="approve"]', 0.5, 0.5);
      click(tl, 60, '[data-demo="approve"]');
      fade(tl, 61, done, 2.6);

      /* 4 · Collect — finished run + Telegram ping (69–100) */
      wipe(tl, 67, 7, ".curtain-report", 0, 100);
      tl.fromTo(".tg-toast", { opacity: 0, y: 30, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 2.6, ease: "back.out(1.6)", immediateRender: false }, 79);
      moveTo(tl, 84, 4, '[data-demo="save2"]', 0.5, 0.5);
      click(tl, 89, '[data-demo="save2"]');
      tl.to({}, { duration: Math.max(0, 100 - tl.duration()) });

      const r = () => ScrollTrigger.refresh();
      if (document.fonts?.ready) document.fonts.ready.then(r);
    },
    { scope: root }
  );

  return (
    <section ref={root} id="demo" className="demo-sec">
      <div className="demo-pin">
        <div className="demo-grid">
          <div className="demo-top">
            <div className="demo-left">
              <SectionHead align="left">
                See one task run, <span className="v">start to finish</span>.
              </SectionHead>
            </div>
            <div className="demo-steps">
              <ol className="steps-rail">
                {STEPS.map((s, i) => (
                  <li key={s.title} className={`step-item${i === 0 ? " on" : ""}`}>
                    <span className="n">{i + 1}</span>
                    <div><b>{s.title}</b></div>
                  </li>
                ))}
              </ol>
              <p className="step-desc" aria-live="polite">{STEPS[0].desc}</p>
            </div>
          </div>

          <div className="demo-shell">
            <div className="demo-window">
              <div className="win-bar">
                <span className="win-url mono">{STEPS[0].url}</span>
              </div>
              <div className="demo-body">
                <div className="dash-cam">
                  <div className="dash-layer dash" data-screen="home" dangerouslySetInnerHTML={{ __html: DASH.home }} />
                  <div className="dash-layer dash" data-screen="chat">
                    <div dangerouslySetInnerHTML={{ __html: DASH.chat }} />
                    <Curtain cls="curtain-chat" style={{ left: 240, top: 172, width: 1150, height: 690, background: "#fff" }} />
                  </div>
                  <div className="dash-layer dash" data-screen="run">
                    <div dangerouslySetInnerHTML={{ __html: DASH.run }} />
                    <Curtain cls="curtain-run" style={{ left: 283, top: 369, width: 852, height: 134, background: "#F4F0FF" }} />
                  </div>
                  <div className="dash-layer dash" data-screen="done">
                    <div dangerouslySetInnerHTML={{ __html: DASH.done }} />
                    <Curtain cls="curtain-report" style={{ left: 1176, top: 340, width: 552, height: 390, background: "#fff" }} />
                  </div>
                  <div className="fake-cursor" aria-hidden="true">
                    <span className="ripple" />
                    <svg width="40" height="46" viewBox="0 0 26 30" fill="none"><path d="M3 2l18 13.5-8 1.2 4.6 9.3-3.9 1.9-4.6-9.4L3 24.5z" fill="#15121a" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /></svg>
                  </div>
                </div>
                <div className="tg-toast tg" aria-hidden="true"><b>TG</b><span>Your report is ready. Open it in Loop or approve the sources from here.</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
