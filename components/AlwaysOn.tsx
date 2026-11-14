"use client";

import { useRef } from "react";
import { gsap, useGSAP, playInView, prefersReducedMotion } from "@/lib/gsap";
import SectionHead from "./SectionHead";
import MateImg from "./MateImg";
import Tile from "./Tile";
import type { MateKey } from "@/lib/mates";

/** How the leader sorts events. `order` is the order they drop in. */
const LANES: { name: string; events: { order: number; text: string; hot?: boolean }[] }[] = [
  { name: "Briefing", events: [{ order: 1, text: "New video in a feed you follow" }, { order: 4, text: "Two new issues on a watched repo" }] },
  { name: "Message", events: [{ order: 2, text: "Run finished, report ready" }, { order: 3, text: "Deadline tomorrow" }] },
  { name: "Call", events: [{ order: 5, text: "Garage open after 11 pm", hot: true }] },
];

const PY_BARS = [34, 52, 44, 70, 62, 100];
const STANDUP: MateKey[] = ["mimo", "research", "code", "chef", "tune"];

export default function AlwaysOn() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;

      // Jarvis mode: events drop into their lane one by one
      const evs = gsap.utils
        .toArray<HTMLElement>(".ev", el)
        .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
      gsap.set(evs, { autoAlpha: 0, y: -20, scale: 0.88 });
      gsap.timeline({
        repeat: -1,
        repeatDelay: 0.7,
        scrollTrigger: { trigger: ".lanes", start: "top 85%", end: "bottom top", toggleActions: "play pause resume pause" },
      })
        .to(evs, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.9)", stagger: 0.75 })
        .to(evs, { autoAlpha: 0, duration: 0.4, stagger: 0.05 }, "+=2.6");

      // memory graph: nodes breathe, links flow
      const graph = [
        gsap.to(".gnode", { scale: 1.3, transformOrigin: "50% 50%", duration: 1.3, ease: "sine.inOut", stagger: { each: 0.22, repeat: -1, yoyo: true } }),
        gsap.to(".gedge", { strokeDashoffset: -16, duration: 1.1, ease: "none", repeat: -1 }),
      ];
      playInView(".graph", graph);

      // python sandbox: the chart grows, again and again
      gsap.set(".pybars i", { scaleY: 0 });
      gsap.to(".pybars i", {
        scaleY: 1,
        duration: 0.9,
        ease: "back.out(1.6)",
        stagger: 0.09,
        repeat: -1,
        repeatDelay: 3.5,
        scrollTrigger: { trigger: ".pybars", start: "top 92%", end: "bottom top", toggleActions: "play pause resume pause" },
      });

      // stand-up: a little hop down the line
      playInView(
        ".standup",
        gsap.utils.toArray<HTMLElement>(".standup img", el).map((img, i) =>
          gsap.to(img, { y: -7, duration: 0.45, ease: "power2.out", yoyo: true, repeat: -1, repeatDelay: 1.6, delay: i * 0.16 })
        )
      );
    },
    { scope: root }
  );

  return (
    <section ref={root} id="more" className="sec">
      <div className="wrap stack">
        <SectionHead
          label="Always on"
          lede="The server stays up on your machine, so the team keeps watching, remembering and getting things ready between your messages."
        >
          Working while<br />you don&apos;t.
        </SectionHead>

        <div className="bento">
          <div className="s4" data-reveal>
            <Tile className="tall wide">
              <div className="tile-copy">
                <span className="lbl">Jarvis mode</span>
                <h3>It watches, then decides how loud to be.</h3>
                <p>
                  The leader watches runs, deadlines, news topics, RSS and YouTube feeds, GitHub repos and Home Assistant
                  devices. It scores every event: morning briefing, message, or call.
                </p>
              </div>
              <div className="lanes" aria-hidden="true">
                {LANES.map((lane) => (
                  <div className="lane" key={lane.name}>
                    <span className="lbl">{lane.name}</span>
                    {lane.events.map((ev) => (
                      <span key={ev.order} data-order={ev.order} className={ev.hot ? "ev hot" : "ev"}>{ev.text}</span>
                    ))}
                  </div>
                ))}
              </div>
            </Tile>
          </div>

          <div className="s2" data-reveal>
            <Tile className="tall">
              <span className="lbl">Memory</span>
              <h3>It learns you.</h3>
              <p>Shared memories, a knowledge graph and a journal per Mate. Say “shorter please” once and that Mate remembers.</p>
              <svg className="graph tile-art" viewBox="0 0 320 130" aria-hidden="true">
                <g fill="none" stroke="rgba(244,241,234,0.32)" strokeWidth="1.5" strokeDasharray="3 5">
                  <path className="gedge" d="M40 66L112 30" /><path className="gedge" d="M40 66L122 100" />
                  <path className="gedge" d="M112 30L192 60" /><path className="gedge" d="M122 100L192 60" />
                  <path className="gedge" d="M192 60L266 30" /><path className="gedge" d="M192 60L276 102" />
                </g>
                <circle className="gnode" cx="40" cy="66" r="9" fill="#F4F1EA" />
                <circle className="gnode" cx="112" cy="30" r="7" fill="#F27AA8" />
                <circle className="gnode" cx="122" cy="100" r="7" fill="#8AA2FF" />
                <circle className="gnode" cx="192" cy="60" r="11" fill="var(--acc)" />
                <circle className="gnode" cx="266" cy="30" r="7" fill="#F3BB3C" />
                <circle className="gnode" cx="276" cy="102" r="7" fill="#B892FF" />
              </svg>
            </Tile>
          </div>

          <div className="s2" data-reveal>
            <Tile>
              <span className="lbl">Python sandbox</span>
              <h3>Python for the exact numbers.</h3>
              <p>Data, Code and Byte run short Python scripts, in Docker when installed. Each run needs your approval.</p>
              <div className="pybars tile-art" aria-hidden="true">
                {PY_BARS.map((h, i) => <i key={i} style={{ height: `${h}%`, opacity: 0.45 + i * 0.11 }} />)}
              </div>
            </Tile>
          </div>

          <div className="s2" data-reveal>
            <Tile>
              <span className="lbl">Company mode</span>
              <h3>A team for your team.</h3>
              <p>A people directory, assignments and check-ins. Employees talk to the bot on Telegram and see only their own work.</p>
              <div className="icons tile-art" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
            </Tile>
          </div>

          <div className="s2" data-reveal>
            <Tile>
              <span className="lbl">Weekly stand-up</span>
              <h3>One line each, in their own voice.</h3>
              <p>Once a week, every Mate that was busy writes a single line about what it did.</p>
              <div className="standup tile-art" aria-hidden="true">
                {STANDUP.map((k) => <MateImg key={k} k={k} size={56} />)}
              </div>
            </Tile>
          </div>
        </div>
      </div>
    </section>
  );
}
