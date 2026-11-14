"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import MateImg from "./MateImg";
import type { MateKey } from "@/lib/mates";

const STEPS: { k: MateKey; title: string; text: string }[] = [
  { k: "planner", title: "Split", text: "The Planner breaks the job into steps and picks a Mate for each one." },
  { k: "code", title: "Work", text: "Each step goes to the right Mate. Coding steps can use Claude Code, Codex or OpenCode in a sandbox." },
  { k: "ops", title: "Check", text: "A second opinion reviews every step and sends it back with feedback when it falls short." },
  { k: "halo", title: "Approve", text: "Deleting, messaging other people, pushing code or spending money waits for your yes." },
  { k: "writer", title: "Report", text: "You get a final report. Coding runs end in a pull request." },
];

/** An illustrative run. The first five lines lead to the approval; the last two follow it. */
const LOG: { who: string; color: string; text: string }[] = [
  { who: "planner", color: "#E3D3C1", text: "split the job into 4 steps" },
  { who: "research", color: "#FF7A70", text: "step 1 · compared three theming approaches, sources linked" },
  { who: "ops", color: "#B892FF", text: "second opinion on step 1: passed" },
  { who: "code", color: "#8AA2FF", text: "step 2 · edited 6 files, tests green" },
  { who: "halo", color: "#E7D3F0", text: "approval needed: push branch dark-mode" },
  { who: "you", color: "var(--acc)", text: "approved" },
  { who: "writer", color: "#F3BB3C", text: "report ready · pull request opened" },
];

export default function Runs() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;

      // the pipeline draws itself as you scroll past, lighting each station in turn
      const stations = gsap.utils.toArray<HTMLElement>(".station", el);
      const lit = stations.map(() => true);
      const light = (p: number) => {
        stations.forEach((s, i) => {
          const on = p >= i / (stations.length - 1) - 0.02;
          if (on === lit[i]) return;
          lit[i] = on;
          s.classList.toggle("on", on);
          if (on) gsap.fromTo(s.querySelector(".node"), { scale: 0.78 }, { scale: 1, duration: 0.8, ease: "elastic.out(1,0.45)", overwrite: true });
        });
      };
      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: ".pipe",
          start: "top 82%",
          end: "top 34%",
          scrub: 0.4,
          onUpdate: (self) => light(self.progress),
          onRefresh: (self) => light(self.progress),
        },
      })
        .fromTo(".pipe-fill", { scaleX: 0 }, { scaleX: 1 }, 0)
        .fromTo(".pipe-run", { left: "0%" }, { left: "100%" }, 0);

      // the example run plays on a loop while it is on screen
      const logs = gsap.utils.toArray<HTMLElement>(".log", el);
      gsap.set(logs, { autoAlpha: 0, x: -14 });
      gsap.set(".approve", { autoAlpha: 0, y: 26, scale: 0.96 });
      gsap.set(".approve-done", { autoAlpha: 0, scale: 0.6 });
      gsap.timeline({
        repeat: -1,
        repeatDelay: 2.4,
        scrollTrigger: { trigger: ".console", start: "top 80%", end: "bottom top", toggleActions: "play pause resume pause" },
      })
        .to(logs.slice(0, 5), { autoAlpha: 1, x: 0, duration: 0.4, ease: "power2.out", stagger: 0.6 }, 0.3)
        .to(".approve", { autoAlpha: 1, y: 0, scale: 1, duration: 0.65, ease: "back.out(1.7)" }, ">-0.15")
        .to(".approve-yes", { scale: 0.9, duration: 0.12, ease: "power2.in", yoyo: true, repeat: 1 }, "+=1.2")
        .to(".approve-done", { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(2.4)" }, ">")
        .to(logs.slice(5), { autoAlpha: 1, x: 0, duration: 0.4, ease: "power2.out", stagger: 0.6 }, ">0.1");
    },
    { scope: root }
  );

  return (
    <section ref={root} id="runs" className="sec">
      <div className="wrap stack">
        <SectionHead
          label="Runs"
          lede="A run is a multi-step job. Every step gets a second opinion and is retried with feedback if it falls short. Anything risky waits for you."
        >
          Hand over<br />the whole job.
        </SectionHead>

        <div className="pipe">
          <div className="pipe-line" aria-hidden="true">
            <div className="pipe-fill" />
            <div className="pipe-run" />
          </div>
          <ol className="stations">
            {STEPS.map((s, i) => (
              <li key={s.title} className="station on" data-reveal>
                <div className="node"><MateImg k={s.k} size={46} /></div>
                <span className="lbl">Step {i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div
          className="console"
          data-reveal
          role="img"
          aria-label="Example run, add dark mode to the settings page: the Planner splits the job, Research and Code work, a second opinion checks each step, Halo asks before pushing the branch, and the Writer reports back with a pull request."
        >
          <div className="console-bar" aria-hidden="true">
            <span>Example run · Add dark mode to the settings page and run the tests</span>
            <span className="status">Running</span>
          </div>
          <div className="console-body" aria-hidden="true">
            <div className="logs">
              {LOG.map((l) => (
                <div className="log" key={l.who}>
                  <b style={{ color: l.color }}>{l.who}</b>
                  <span>{l.text}</span>
                </div>
              ))}
            </div>
            <div className="approve">
              <div className="approve-head"><MateImg k="halo" size={44} />Halo needs your OK</div>
              <p>Push branch dark-mode to origin and open a pull request.</p>
              <div className="approve-btns">
                <span className="btn btn-acc btn-sm approve-yes">Approve</span>
                <span className="btn btn-ghost btn-sm">Deny</span>
              </div>
              <span className="approve-done">Approved</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
