"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
const AUTOPLAY_SECONDS = 6.5;

export default function Demo() {
  const root = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const timer = useRef<gsap.core.Tween | null>(null);
  const hover = useRef(false);
  const inView = useRef(false);
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const switching = useRef(false);

  /** Smooth switch: blur/fade the current panel out, swap, then the new one de-blurs in. */
  const goStep = useCallback((i: number) => {
    if (i === stepRef.current || switching.current) return;
    switching.current = true;
    timer.current?.kill();
    const commit = () => { stepRef.current = i; setStep(i); switching.current = false; };
    if (prefersReducedMotion() || !body.current) { commit(); return; }
    gsap.to(body.current, { opacity: 0, y: -14, filter: "blur(10px)", duration: 0.28, ease: "power2.in", onComplete: commit });
    gsap.to(".demo-desc", { opacity: 0, y: -6, filter: "blur(6px)", duration: 0.2, ease: "power2.in" });
  }, []);

  // sliding pill indicator
  useGSAP(
    () => {
      const tab = tabsRef.current?.querySelectorAll<HTMLElement>("[role=tab]")[step];
      if (!tab || !indicator.current) return;
      gsap.to(indicator.current, { x: tab.offsetLeft, width: tab.offsetWidth, duration: prefersReducedMotion() ? 0 : 0.55, ease: "expo.inOut" });
    },
    { dependencies: [step], scope: tabsRef }
  );

  // per-step content animation
  useGSAP(
    () => {
      const q = gsap.utils.selector(body.current);
      const reduce = prefersReducedMotion();
      const d = reduce ? 0 : 1;
      gsap.from(body.current, { opacity: reduce ? 1 : 0, y: 18 * d, filter: reduce ? "none" : "blur(12px)", duration: 0.7 * d, ease: "power3.out", clearProps: "filter" });
      gsap.fromTo(root.current!.querySelector(".demo-desc"), { opacity: reduce ? 1 : 0, y: 8 * d, filter: reduce ? "none" : "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5 * d, ease: "power2.out", overwrite: true });
      if (step === 0) {
        gsap.fromTo(q(".prompt-text .t"), { text: "" }, { text: PROMPT, duration: reduce ? 0 : 2.4, ease: "none", delay: 0.25 });
        gsap.from(q(".d-dot"), { scale: 0, rotate: -20, duration: 0.7 * d, stagger: 0.08, ease: "back.out(2)", delay: 0.2 });
      }
      if (step === 1) {
        gsap.from(q(".plan-row"), { x: -30 * d, opacity: reduce ? 1 : 0, duration: 0.5 * d, stagger: 0.12, ease: "power3.out", delay: 0.15 });
        gsap.from(q(".plan-row img"), { scale: 0, duration: 0.5 * d, stagger: 0.12, ease: "back.out(2.4)", delay: 0.25 });
      }
      if (step === 2) {
        gsap.fromTo(q(".seg-i"), { scaleX: 0 }, { scaleX: (i: number) => (i < 2 ? 1 : i === 2 ? 0.6 : 0), duration: 1.2 * d, stagger: 0.25 * d, ease: "power2.out" });
        gsap.from(q(".log-row"), { opacity: reduce ? 1 : 0, x: -12 * d, duration: 0.4 * d, stagger: 0.28 * d, delay: 0.3, ease: "power2.out" });
        gsap.from(q(".approve"), { y: 24 * d, opacity: reduce ? 1 : 0, duration: 0.6 * d, delay: 1.7 * d, ease: "back.out(1.6)" });
      }
      if (step === 3) {
        gsap.from(q("tbody tr"), { opacity: reduce ? 1 : 0, y: 14 * d, duration: 0.5 * d, stagger: 0.14, delay: 0.2 });
        gsap.from(q(".file"), { opacity: reduce ? 1 : 0, x: 20 * d, duration: 0.45 * d, stagger: 0.1, delay: 0.3 });
        gsap.from(q(".tg"), { scale: reduce ? 1 : 0.85, opacity: reduce ? 1 : 0, duration: 0.6 * d, delay: 0.9 * d, ease: "back.out(1.8)" });
      }
    },
    { dependencies: [step], scope: body }
  );

  // autoplay: a progress bar fills the active tab, then advances
  const startTimer = useCallback(() => {
    timer.current?.kill();
    const bars = tabsRef.current?.querySelectorAll<HTMLElement>(".bar");
    if (!bars) return;
    gsap.set(bars, { scaleX: 0 });
    if (prefersReducedMotion()) return;
    timer.current = gsap.to(bars[step], {
      scaleX: 1,
      duration: AUTOPLAY_SECONDS,
      ease: "none",
      onComplete: () => goStep((stepRef.current + 1) % STEPS.length),
    });
    timer.current.paused(!inView.current || hover.current);
  }, [step, goStep]);

  useEffect(() => {
    startTimer();
    return () => { timer.current?.kill(); };
  }, [startTimer]);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: root.current,
        start: "top 70%",
        end: "bottom 20%",
        onToggle: (self) => {
          inView.current = self.isActive;
          timer.current?.paused(!self.isActive || hover.current);
        },
      });
      gsap.to(".demo-shell", {
        opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: ".demo-shell", start: "top 85%", once: true },
      });
      gsap.to(".demo-tabs", {
        opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: ".demo-tabs", start: "top 90%", once: true },
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="demo" className="sec center">
      <div className="container">
        <SectionHead tag="Live demo" sub="Click through the four steps, or just watch. It is the same flow you get in the dashboard.">
          See one task run, <span className="v">start to finish</span>.
        </SectionHead>

        <div ref={tabsRef} className="demo-tabs" role="tablist" aria-label="Demo steps" data-reveal>
          <span ref={indicator} className="pill-indicator" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <button key={s.title} role="tab" aria-selected={step === i} className="pill-tab" onClick={() => goStep(i)}>
              <span className="n">{i + 1}</span>
              {s.title}
              <span className="bar" aria-hidden="true" />
            </button>
          ))}
        </div>
        <p className="demo-desc" aria-live="polite">{STEPS[step].desc}</p>

        <div
          className="demo-shell"
          data-reveal
          onPointerEnter={() => { hover.current = true; timer.current?.pause(); }}
          onPointerLeave={() => { hover.current = false; if (inView.current) timer.current?.resume(); }}
        >
          <div className="demo-window">
            <div className="win-bar">
              <i style={{ background: "#ff5f57" }} /><i style={{ background: "#febc2e" }} /><i style={{ background: "#28c840" }} />
              <span className="win-url mono">{STEPS[step].url}</span>
            </div>
            <div className="demo-body" ref={body} key={step}>
              {step === 0 && (
                <div>
                  <div className="d-title">What should Loop get done today?</div>
                  <div className="prompt-box">
                    <div className="prompt-text"><span className="t" /><span className="caret" /></div>
                    <div className="row-wrap">
                      <span className="soft-chip">Planner Dot routes the work</span>
                      <span className="soft-chip">Ask before risky actions</span>
                      <span style={{ flex: 1 }} />
                      <span className="go">Run in Loop</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 22, flexWrap: "wrap" }}>
                    {(["planner", "research", "browser", "code", "writer"] as DotKey[]).map((k) => (
                      <Image key={k} className="d-dot" src={`/dots/${k}.png`} alt="" width={68} height={68} />
                    ))}
                  </div>
                </div>
              )}
              {step === 1 && (
                <div>
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
                    <span className="go">Looks good, start</span>
                    <span className="ghost">Edit plan</span>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div>
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
                    <span className="go">Approve</span>
                  </div>
                </div>
              )}
              {step === 3 && (
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
                      {FILES.map((f) => <div className="file mono" key={f} style={{ fontSize: 12.5, padding: "7px 0", borderTop: "1px solid rgba(21,18,26,.07)" }}>{f}</div>)}
                    </div>
                    <div className="tg"><b>TG</b><span>Your report is ready. Open it in Loop or approve the sources from here.</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
