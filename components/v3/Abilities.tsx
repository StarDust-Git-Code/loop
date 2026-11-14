"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";
import MateImg from "@/components/MateImg";
import type { MateKey } from "@/lib/mates";

const ABILITIES: { h: string; p: string; ask: string; mates: MateKey[]; wide?: boolean }[] = [
  {
    h: "Talk to them, or call them",
    p: "Chat with one Mate or bring in a few at once. Pick up the phone and talk, or let a Mate ring you when something comes up.",
    ask: "@Research @Spark which of these three names is best?",
    mates: ["mimo", "spark", "research"],
    wide: true,
  },
  {
    h: "Big jobs, start to finish",
    p: "Give it a goal. It plans the steps, checks each one, retries what fails, and you can add instructions while it works.",
    ask: "Build a one-page site for the bake sale.",
    mates: ["planner", "code", "ops"],
  },
  {
    h: "It remembers for you",
    p: "It picks up facts from your chats and files, and finds them again when you ask.",
    ask: "What did I decide about the demo last week?",
    mates: ["recall", "mimo"],
  },
  {
    h: "Things on repeat",
    p: "Morning briefings, weekly reports, reminders. Describe it in a sentence and Flow builds it.",
    ask: "Every Monday at 9, check my projects and send me a summary.",
    mates: ["flow", "orbit"],
    wide: true,
  },
  {
    h: "It uses the web for you",
    p: "Reads pages, compares options and fills in forms. You still sign in yourself.",
    ask: "Book the tennis court for Saturday at 10.",
    mates: ["browser", "scout"],
    wide: true,
  },
  {
    h: "Writes and codes",
    p: "Drafts in your voice. Code runs in a sealed sandbox, with tests, so you can review every change.",
    ask: "Add dark mode to the settings page and run the tests.",
    mates: ["writer", "code", "byte"],
  },
  {
    h: "Keeps an eye on things",
    p: "Watches news feeds, your smart home and your calendar, and speaks up when something changes.",
    ask: "Tell me if the garage is still open after 11 pm.",
    mates: ["mimo", "zen", "luna"],
  },
  {
    h: "Your apps, connected",
    p: "Google, Notion, Obsidian, Slack, WhatsApp, Telegram, Discord, Spotify, GitHub, Home Assistant, health data and MCP servers.",
    ask: "Add today’s meeting notes to my Notion.",
    mates: ["tune", "data", "chef"],
    wide: true,
  },
];

/** Everything Loopmates can do, in plain words, each with something you could actually say to it. */
export default function Abilities() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.utils.toArray<HTMLElement>(".ab-card").forEach((card, i) => {
        gsap.fromTo(
          card,
          { y: 90, scale: 0.94, autoAlpha: 0 },
          { y: 0, scale: 1, autoAlpha: 1, duration: 1.1, ease: "power4.out", delay: (i % 3) * 0.08, scrollTrigger: { trigger: card, start: "top 92%" } }
        );
        gsap.from(card.querySelectorAll(".ab-mates img"), {
          scale: 0,
          rotate: -30,
          duration: 0.9,
          ease: "elastic.out(1,0.6)",
          stagger: 0.08,
          scrollTrigger: { trigger: card, start: "top 80%" },
        });
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} id="does" className="ab">
      <div className="sec-head" data-rise>
        <h2>What it can do.</h2>
        <p>Every Mate shares the same toolbox. Here is what that adds up to, with things you could actually say.</p>
      </div>
      <ul className="ab-grid">
        {ABILITIES.map((a) => (
          <li key={a.h} className={`ab-card${a.wide ? " wide" : ""}`}>
            <div className="ab-mates" aria-hidden="true">
              {a.mates.map((k) => <MateImg key={k} k={k} size={64} />)}
            </div>
            <h3>{a.h}</h3>
            <p>{a.p}</p>
            <p className="ab-ask">&ldquo;{a.ask}&rdquo;</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
