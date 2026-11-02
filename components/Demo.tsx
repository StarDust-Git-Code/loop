"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import type { DotKey } from "@/lib/dots";

const STEPS = [
  { title: "Ask", desc: "Describe the job in plain language. Chat is where you start, not where it ends.", url: "dashboard.loopdots.com/home" },
  { title: "Plan", desc: "Planner Dot breaks it into steps and hands each one to the right Dot.", url: "dashboard.loopdots.com/chat" },
  { title: "Watch it run", desc: "Every tool call is visible, and risky actions wait for your approval.", url: "dashboard.loopdots.com/run" },
  { title: "Collect", desc: "You get files and a report, plus a Telegram ping when it is done.", url: "dashboard.loopdots.com/run" },
];
const PROMPT = "Research SkillCourt and compare it with SmartCourt. Save every source and give me a short report.";
const PLAN: { k: DotKey; label: string; who: string }[] = [
  { k: "planner", label: "Plan the comparison", who: "Planner" },
  { k: "research", label: "Gather sources", who: "Research" },
  { k: "browser", label: "Browse product pages", who: "Browser" },
  { k: "code", label: "Build comparison table", who: "Code" },
  { k: "writer", label: "Write the report", who: "Writer" },
];
const LOG = [
  { t: "2:12", tool: "browser", text: "Open product page", c: "#B9ABF9" },
  { t: "2:17", tool: "browser", text: "Extract feature list", c: "#B9ABF9" },
  { t: "2:23", tool: "files", text: "Save sources/skillcourt-01.md", c: "#7FE0A3" },
  { t: "2:31", tool: "browser", text: "Open second product page", c: "#B9ABF9" },
  { t: "2:34", tool: "browser", text: "Waiting for page to load…", c: "#FFC987" },
];
const ROWS = [
  ["Core idea", "Cited · source 01", "Cited · source 04"],
  ["Hardware", "Cited · source 02", "Cited · source 05"],
  ["Public pricing", "Cited · source 03", "Cited · source 06"],
];
const FILES = ["summary.md", "comparison.md", "references.bib", "sources/ (12)"];

/**
 * Scroll-driven demo: the section pins, and scrolling plays a fake cursor through the real flow —
 * click the prompt box, type, press Run, approve the plan, approve the write, open the report.
 */
export default function Demo() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const q = gsap.utils.selector(el);
      const reduce = prefersReducedMotion();
      const win = el.querySelector<HTMLElement>(".demo-window")!;
      const cursor = el.querySelector<HTMLElement>(".fake-cursor")!;
      const ripple = el.querySelector<HTMLElement>(".ripple")!;
      const urlEl = el.querySelector<HTMLElement>(".win-url")!;
      const items = gsap.utils.toArray<HTMLElement>(".step-item", el);
      const screens = gsap.utils.toArray<HTMLElement>(".demo-screen", el);
      const fill = el.querySelector<HTMLElement>(".rail-fill")!;
      const hint = el.querySelector<HTMLElement>(".scroll-hint")!;
      const typed = el.querySelector<HTMLElement>(".prompt-text .t")!;

      if (reduce) { typed.textContent = PROMPT; return; }

      // point inside `sel`, relative to the window (used for cursor targets)
      const pt = (sel: string, fx = 0.5, fy = 0.5) => () => {
        const t = el.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
        const w = win.getBoundingClientRect();
        return { x: t.left - w.left + t.width * fx, y: t.top - w.top + t.height * fy };
      };
      const moveTo = (tl: gsap.core.Timeline, at: number, dur: number, sel: string, fx = 0.5, fy = 0.5) => {
        const p = pt(sel, fx, fy);
        tl.to(cursor, { x: () => p().x, y: () => p().y, duration: dur, ease: "power3.inOut" }, at);
      };
      const click = (tl: gsap.core.Timeline, at: number, press?: string) => {
        tl.to(cursor, { scale: 0.82, duration: 0.5, ease: "power2.out" }, at)
          .fromTo(ripple, { scale: 0.2, opacity: 0.55 }, { scale: 1.6, opacity: 0, duration: 1.4, ease: "power2.out", immediateRender: false }, at)
          .to(cursor, { scale: 1, duration: 0.6, ease: "power2.out" }, at + 0.5);
        if (press) tl.to(press, { scale: 0.94, duration: 0.35, ease: "power2.out" }, at).to(press, { scale: 1, duration: 0.5, ease: "back.out(2.5)" }, at + 0.35);
      };
      const swap = (tl: gsap.core.Timeline, at: number, from: number, to: number) => {
        tl.to(screens[from], { opacity: 0, y: -24, filter: "blur(10px)", duration: 1.6, ease: "power2.in" }, at)
          .fromTo(screens[to], { opacity: 0, y: 28, filter: "blur(12px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 2, ease: "power3.out", immediateRender: false }, at + 1.2);
      };

      gsap.set(screens.slice(1), { opacity: 0 });
      gsap.set(cursor, { x: () => win.clientWidth * 0.86, y: () => win.clientHeight * 0.92, opacity: 0 });
      typed.textContent = "";

      let active = -1;
      const setActive = (i: number) => {
        if (i === active) return;
        active = i;
        items.forEach((it, n) => it.classList.toggle("on", n === i));
        items.forEach((it, n) => it.classList.toggle("done", n < i));
        urlEl.textContent = STEPS[i].url;
      };
      setActive(0);

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el.querySelector(".demo-pin"),
          start: "top top",
          end: () => "+=" + Math.round(window.innerHeight * 4.2),
          pin: true,
          scrub: 0.9,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            setActive(Math.min(3, Math.floor(self.progress * 4 + 0.001)));
            gsap.set(fill, { scaleY: self.progress });
            hint.classList.toggle("gone", self.progress > 0.02);
          },
        },
      });

      /* ---- 1 · Ask (0–25) ---- */
      tl.to(cursor, { opacity: 1, duration: 1 }, 0);
      moveTo(tl, 0.5, 3.5, ".prompt-box", 0.3, 0.3);
      click(tl, 4.2);
      tl.to(".prompt-box", { boxShadow: "0 0 0 3px rgba(106,77,244,.35), 0 12px 30px rgba(106,77,244,.14)", borderColor: "rgba(106,77,244,.7)", duration: 0.8 }, 4.4);
      tl.to(typed, { text: { value: PROMPT, delimiter: "" }, duration: 9, ease: "none" }, 5.2);
      tl.from(q(".d-dot"), { scale: 0.7, opacity: 0.4, duration: 3, stagger: 0.4 }, 0.5);
      moveTo(tl, 14.6, 3, ".run-btn", 0.55, 0.5);
      click(tl, 17.8, ".run-btn");
      swap(tl, 19.4, 0, 1);

      /* ---- 2 · Plan (25–50) ---- */
      tl.from(q(".plan-row"), { x: -34, opacity: 0, duration: 2.2, stagger: 1.5, ease: "power3.out" }, 26);
      tl.from(q(".plan-row img"), { scale: 0, duration: 2, stagger: 1.5, ease: "back.out(2.4)" }, 26.3);
      moveTo(tl, 36.4, 3.2, ".start-btn", 0.5, 0.5);
      click(tl, 40.2, ".start-btn");
      swap(tl, 44, 1, 2);

      /* ---- 3 · Watch it run (50–75) ---- */
      tl.fromTo(q(".seg-i"), { scaleX: 0 }, { scaleX: (i: number) => (i < 2 ? 1 : i === 2 ? 0.6 : 0), duration: 5, stagger: 1.2, ease: "power2.out", immediateRender: false }, 51);
      tl.from(q(".log-row"), { opacity: 0, x: -14, duration: 1.6, stagger: 1.4 }, 51.5);
      tl.from(q(".approve"), { y: 26, opacity: 0, duration: 2.2, ease: "back.out(1.6)" }, 60);
      moveTo(tl, 63, 3.2, ".approve-btn", 0.5, 0.5);
      click(tl, 66.8, ".approve-btn");
      tl.to(q(".seg-i"), { scaleX: 1, duration: 3, stagger: 0.3, backgroundColor: "#1E7A46", ease: "power2.out" }, 67.4);
      swap(tl, 69.5, 2, 3);

      /* ---- 4 · Collect (75–100) ---- */
      tl.from(q("tbody tr"), { opacity: 0, y: 16, duration: 2, stagger: 1.2 }, 76);
      tl.from(q(".file"), { opacity: 0, x: 22, duration: 1.8, stagger: 0.9 }, 77);
      tl.from(q(".tg"), { scale: 0.85, opacity: 0, duration: 2.4, ease: "back.out(1.8)" }, 83);
      moveTo(tl, 86, 3.5, ".file-summary", 0.4, 0.5);
      click(tl, 90.2);
      tl.to(".file-summary", { backgroundColor: "rgba(106,77,244,.12)", duration: 1.2 }, 90.3);
      tl.to({}, { duration: 6 }, 94); // hold on the finished state

      // refresh on fonts/images so cursor targets are accurate
      const r = () => ScrollTrigger.refresh();
      if (document.fonts?.ready) document.fonts.ready.then(r);
    },
    { scope: root }
  );

  return (
    <section ref={root} id="demo" className="demo-sec">
      <div className="demo-pin">
        <div className="demo-grid">
          <div className="demo-left">
            <SectionHead align="left" sub="Keep scrolling. Loop does the clicking, so you can see the whole workflow, from the first prompt to the finished report.">
              See one task run, <span className="v">start to finish</span>.
            </SectionHead>
            <ol className="steps-rail">
              <span className="rail-line" aria-hidden="true"><i className="rail-fill" /></span>
              {STEPS.map((s, i) => (
                <li key={s.title} className={`step-item${i === 0 ? " on" : ""}`}>
                  <span className="n">{i + 1}</span>
                  <div>
                    <b>{s.title}</b>
                    <p>{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="scroll-hint" aria-hidden="true"><span /> Scroll to play</div>
          </div>

          <div className="demo-shell">
            <div className="demo-window">
              <div className="win-bar">
                <i style={{ background: "#ff5f57" }} /><i style={{ background: "#febc2e" }} /><i style={{ background: "#28c840" }} />
                <span className="win-url mono">{STEPS[0].url}</span>
              </div>
              <div className="demo-body">
                {/* 1 · Ask */}
                <div className="demo-screen">
                  <div className="d-title">What should Loop get done today?</div>
                  <div className="prompt-box">
                    <div className="prompt-text"><span className="t">{PROMPT}</span><span className="caret" /></div>
                    <div className="row-wrap">
                      <span className="soft-chip">Planner Dot routes the work</span>
                      <span className="soft-chip">Ask before risky actions</span>
                      <span style={{ flex: 1 }} />
                      <span className="go run-btn">Run in Loop</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 22, flexWrap: "wrap" }}>
                    {(["planner", "research", "browser", "code", "writer"] as DotKey[]).map((k) => (
                      <Image key={k} className="d-dot" src={`/dots/${k}.png`} alt="" width={68} height={68} />
                    ))}
                  </div>
                </div>
                {/* 2 · Plan */}
                <div className="demo-screen">
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Image src="/dots/planner.png" alt="" width={56} height={56} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>Planner Dot</div>
                      <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 2 }}>I split this into five steps. Change anything before it starts.</div>
                    </div>
                  </div>
                  <div className="plan-list">
                    {PLAN.map((p) => (
                      <div className="plan-row" key={p.label}>
                        <Image src={`/dots/${p.k}.png`} alt="" width={36} height={36} />
                        <span className="l">{p.label}</span>
                        <span className="who">{p.who}</span>
                      </div>
                    ))}
                  </div>
                  <div className="row-wrap" style={{ marginTop: 16, gap: 10 }}>
                    <span className="go start-btn">Looks good, start</span>
                    <span className="ghost">Edit plan</span>
                  </div>
                </div>
                {/* 3 · Watch it run */}
                <div className="demo-screen">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>Browse product pages</div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--violet-deep)", background: "var(--violet-tint)", borderRadius: 999, padding: "4px 12px" }}>Running · page 3 of 6</span>
                  </div>
                  <div className="progress-segs">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i}><i className="seg-i" style={{ background: i < 2 ? "#1E7A46" : "#6A4DF4" }} /></span>
                    ))}
                  </div>
                  <div className="term mono">
                    {LOG.map((l) => (
                      <div className="log-row" key={l.t}>
                        <span style={{ color: "#B3A99B" }}>{l.t}</span>
                        <span style={{ color: l.c, width: 64 }}>{l.tool}</span>
                        <span>{l.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="approve">
                    <Image src="/dots/halo.png" alt="" width={46} height={46} />
                    <div style={{ flex: "1 1 220px" }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Halo asks first</div>
                      <div style={{ fontSize: 13.5, color: "var(--body)", marginTop: 2 }}>Write 3 files to /workspace/research/skillcourt?</div>
                    </div>
                    <span className="go approve-btn">Approve</span>
                  </div>
                </div>
                {/* 4 · Collect */}
                <div className="demo-screen">
                  <div className="flex-cols">
                    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: "var(--muted)" }}>summary.md</div>
                      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.04em", margin: "6px 0 12px" }}>SkillCourt vs SmartCourt</div>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Criterion</th><th>SkillCourt</th><th>SmartCourt</th></tr></thead>
                          <tbody>{ROWS.map((r) => <tr key={r[0]}>{r.map((c) => <td key={c}>{c}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>Sample layout. Every row cites a saved source.</div>
                    </div>
                    <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ border: "1px solid var(--line)", borderRadius: 16, padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "var(--muted)", marginBottom: 6 }}>FILES SAVED</div>
                        {FILES.map((f, i) => (
                          <div className={`file mono${i === 0 ? " file-summary" : ""}`} key={f} style={{ fontSize: 12.5, padding: "7px 6px", borderTop: "1px solid rgba(21,18,26,.07)", borderRadius: 8 }}>{f}</div>
                        ))}
                      </div>
                      <div className="tg"><b>TG</b><span>Your report is ready. Open it in Loop or approve the sources from here.</span></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* fake cursor */}
              <div className="fake-cursor" aria-hidden="true">
                <span className="ripple" />
                <svg width="26" height="30" viewBox="0 0 26 30" fill="none"><path d="M3 2l18 13.5-8 1.2 4.6 9.3-3.9 1.9-4.6-9.4L3 24.5z" fill="#15121a" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
