"use client";
/* eslint-disable @next/next/no-img-element -- the film moves raw <img> layers with transforms; next/image wrappers get in the way */

import { useMemo, useRef } from "react";
import { gsap, useGSAP, ScrollSmoother, ScrollTrigger } from "@/lib/gsap";
import {
  APPS, EXT, GRASS, INT, JOBS, LIMITS, MATE_AR, ROOMS, SKY_STARS, SPOTS, STARS, WINDOWS, int, mateImg, type Rect,
} from "@/lib/house";
import type { MateKey } from "@/lib/mates";
import { FILM_URL, REPO_URL } from "@/lib/site";
import JoinForm from "@/components/site/JoinForm";
import Loops, { type LoopsDrive } from "./Loops";
import { buildFilm } from "./film";

const MATES = Object.keys(SPOTS) as MateKey[];

/** The team photo on the lawn at the end: back rows first, Mimo in the middle of the front row. */
const lawnRows = (sizes: number[]): MateKey[][] => {
  const rest: MateKey[] = MATES.filter((k) => k !== "mimo");
  let i = 0;
  return sizes.map((n, r) => {
    const last = r === sizes.length - 1;
    const row = rest.slice(i, (i += last ? n - 1 : n));
    if (last) row.splice(Math.floor(row.length / 2), 0, "mimo");
    return row;
  });
};
const LAWNS: [string, MateKey[][]][] = [
  ["wide", lawnRows([10, 9])],
  ["phone", lawnRows([6, 7, 6])],
];

/** Where a job's paper plane lands: just above the Mate's head. */
const head = (k: MateKey) => {
  const s = SPOTS[k];
  return { x: s.x, y: s.y - s.w / MATE_AR[k] };
};

const PLANNER = head("planner");
const HALO = head("halo");

const rectStyle = (r: Rect, pad = 0) => ({
  left: r[0] - pad,
  top: r[1] - pad,
  width: r[2] - r[0] + pad * 2,
  height: r[3] - r[1] + pad * 2,
});

type Pt = { x: number; y: number };

/** The control point of a gentle curve from a to b that bows sideways by `bend`. */
function ctrl(a: Pt, b: Pt, bend: number): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (a.x + b.x) / 2 + (-dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend };
}

function curve(a: Pt, b: Pt, bend: number) {
  const c = ctrl(a, b, bend);
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/** A box around a curve (the control point bounds it), for sizing its mask. */
function curveBox(a: Pt, b: Pt, bend: number, pad = 14) {
  const c = ctrl(a, b, bend);
  const x0 = Math.min(a.x, b.x, c.x) - pad;
  const y0 = Math.min(a.y, b.y, c.y) - pad;
  return { x: x0, y: y0, width: Math.max(a.x, b.x, c.x) + pad - x0, height: Math.max(a.y, b.y, c.y) + pad - y0 };
}

const JOB_BENDS = [-90, 60, -40, 70, 70, -80];
const RETURN_BENDS = [120, 90, 40, -40, 20, -30];
/** Research and Code share a floor: their tags step apart so they don't overlap. */
const TAG_NUDGE: Partial<Record<MateKey, number>> = { research: -44, code: 40 };

export default function HouseFilm() {
  const root = useRef<HTMLDivElement>(null);
  const drive = useMemo<LoopsDrive>(() => ({ fly: 0 }), []);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || !document.documentElement.classList.contains("film")) return;

      // elements, not selector text: inside this scoped context "#smooth-wrapper" would be searched for inside the film
      const smoother = ScrollSmoother.create({
        wrapper: document.getElementById("smooth-wrapper")!,
        content: document.getElementById("smooth-content")!,
        smooth: 1.1,
        effects: false,
        smoothTouch: 0.1,
      });
      const { tl, st, intro, kill } = buildFilm(el, drive);
      if (/film-(debug|probe)/.test(location.search)) Object.assign(window, { __film: { tl, st, smoother, ScrollTrigger } });

      // Nav links jump to a moment in the film, not to an element.
      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-go]");
        if (!a) return;
        e.preventDefault();
        smoother.scrollTo(st.labelToScroll(a.dataset.go!), true);
      };
      // Tabbing into something that isn't on screen yet takes you to it.
      const onFocus = (e: FocusEvent) => {
        const sc = (e.target as HTMLElement).closest<HTMLElement>("[data-label]");
        if (sc && Number(gsap.getProperty(sc, "opacity")) < 0.5) {
          smoother.scrollTo(st.labelToScroll(sc.dataset.label!), false);
        }
      };
      document.addEventListener("click", onClick);
      el.addEventListener("focusin", onFocus);

      const refresh = () => ScrollTrigger.refresh();
      document.fonts?.ready.then(refresh);

      // Decode every picture up front, so none of them stalls a frame the first time it comes on screen.
      const warm = () => el.querySelectorAll<HTMLImageElement>("img:not(.sc-bg)").forEach((img) => img.decode?.().catch(() => {}));
      const idle = window.requestIdleCallback?.(warm, { timeout: 2500 }) ?? window.setTimeout(warm, 1200);

      return () => {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
        else window.clearTimeout(idle);
        document.removeEventListener("click", onClick);
        el.removeEventListener("focusin", onFocus);
        intro.kill();
        kill();
        smoother.kill();
      };
    },
    { scope: root }
  );

  const lightsUp = () => {
    if (!root.current) return;
    const q = gsap.utils.selector(root);
    gsap.fromTo(q(".house-glow"), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1.25, duration: 0.9, ease: "power2.out", yoyo: true, repeat: 1 });
    // you're in: every light in the house comes back on, and the Mates on the lawn jump
    gsap.to(q(".win"), { opacity: 1, duration: 0.5, stagger: { each: 0.08, from: "end" }, ease: "power2.out" });
    gsap.to(q(".ext-on"), { opacity: 1, duration: 1.2, delay: 0.3, ease: "power2.out" });
    gsap.to(q(".lawn img"), {
      keyframes: [{ y: -18, duration: 0.18, ease: "power2.out" }, { y: 0, duration: 0.32, ease: "bounce.out" }],
      stagger: { each: 0.04, from: "random" },
      delay: 0.2,
    });
  };

  return (
    <div className="film" ref={root}>
      {/* ---------- the picture: decorative, every word is in the copy below ---------- */}
      <div className="stage" aria-hidden="true">
        <div className="den" />
        <div className="device">
          <div className="deck" />
          <div className="screen">
            <div className="ext" style={{ width: EXT.w, height: EXT.h }}>
              <i className="sky-ext" />
              <img className="ext-off" src="/house/night-off.webp" alt="" width={EXT.w} height={EXT.h} />
              <img className="ext-on" src="/house/night.webp" alt="" width={EXT.w} height={EXT.h} fetchPriority="high" />
              <i className="ext-top" />
              {WINDOWS.map((r, i) => (
                <i
                  key={i}
                  className="win"
                  style={{ ...rectStyle(r, 14), backgroundPosition: `${-(r[0] - 14)}px ${-(r[1] - 14)}px` }}
                />
              ))}
              <i className="house-glow" />
              <div className="smoke">
                {[0, 1, 2, 3].map((i) => <i key={i} className="puff" style={{ animationDelay: `${i * -1.6}s` }} />)}
              </div>
              {[...STARS, ...SKY_STARS].map(([x, y], i) => (
                <i
                  key={i}
                  className="star"
                  style={{ left: x, top: y, animationDelay: `${((i * 7) % 23) * -0.37}s`, animationDuration: `${3 + ((i * 5) % 7) * 0.6}s` }}
                />
              ))}
              {[...Array(9)].map((_, i) => (
                <i
                  key={i}
                  className="fly"
                  style={{ left: 700 + ((i * 97) % 760), top: 780 + ((i * 53) % 120), animationDelay: `${i * -1.3}s` }}
                />
              ))}
            </div>
            {LAWNS.map(([v, rows]) => (
              <div key={v} className={`lawn lawn-${v}`}>
                {rows.map((row, r) => (
                  <div key={r} className="lawn-row">
                    {row.map((k, j) => (
                      <div key={k} className={k === "mimo" ? "lawn-m lawn-mimo" : "lawn-m"}>
                        <img
                          src={mateImg(k)}
                          alt=""
                          style={{
                            animationDelay: `${((r * 7 + j * 5) % 11) * -0.31}s, ${((r * 3 + j * 7) % 9) * -0.27}s`,
                            animationDuration: `${3 + ((j + r) % 4) * 0.3}s, ${2.2 + ((j * 3) % 5) * 0.2}s`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            <div className="grass">
              <div className="grass-sway">
                <img className="grass-in" src="/house/grass.webp" alt="" width={GRASS.w} height={GRASS.h} />
              </div>
            </div>

            <div className="int">
              <div className="int-cam" style={{ width: INT.w, height: INT.h }}>
                <img className="int-img" src="/house/inside.webp" alt="" width={INT.w} height={INT.h} />
                <i className="edge edge-l" /><i className="edge edge-r" /><i className="edge edge-t" /><i className="edge edge-b" />
                <i className="fire" style={{ left: int.fire[0], top: int.fire[1] }} />
                <i className="int-dim" />
                {MATES.map((k, i) => {
                  const s = SPOTS[k];
                  const h = s.w / MATE_AR[k];
                  return (
                    <div key={k} className="mate" data-k={k} style={{ left: s.x - s.w / 2, top: s.y - h, width: s.w, height: h }}>
                      <div className="mate-h">
                        <div className="mate-b" style={{ animationDelay: `${(i * 0.37) % 2.4}s`, animationDuration: `${2.6 + (i % 4) * 0.35}s` }}>
                          <img src={mateImg(k)} alt="" width={s.w} height={Math.round(h)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <i className="ring" style={{ left: SPOTS.mimo.x, top: SPOTS.mimo.y - 30 }} />

                <svg className="paths" width={INT.w} height={INT.h} viewBox={`0 0 ${INT.w} ${INT.h}`} fill="none">
                  <defs>
                    {JOBS.map((j, i) => (
                      <mask key={j.k} id={`jm-${i}`} maskUnits="userSpaceOnUse" {...curveBox(PLANNER, head(j.k), JOB_BENDS[i])}>
                        <path className="jm" d={curve(PLANNER, head(j.k), JOB_BENDS[i])} stroke="#fff" strokeWidth="10" />
                      </mask>
                    ))}
                    <mask id="nm" maskUnits="userSpaceOnUse" {...curveBox(head("mimo"), PLANNER, -50)}>
                      <path className="nm" d={curve(head("mimo"), PLANNER, -50)} stroke="#fff" strokeWidth="10" />
                    </mask>
                  </defs>
                  <path id="lp" className="guide" d={curve({ x: int.mailSlot[0], y: int.mailSlot[1] }, head("mimo"), 70)} />
                  <path id="np" className="guide" d={curve(head("mimo"), PLANNER, -50)} />
                  <path className="trail fade" d={curve(head("mimo"), PLANNER, -50)} mask="url(#nm)" />
                  {JOBS.map((j, i) => (
                    <g key={j.k}>
                      <path id={`jp-${i}`} className="guide" d={curve(PLANNER, head(j.k), JOB_BENDS[i])} />
                      <path className="trail fade" d={curve(PLANNER, head(j.k), JOB_BENDS[i])} mask={`url(#jm-${i})`} />
                      <path id={`rp-${i}`} className="guide" d={curve(head(j.k), HALO, RETURN_BENDS[i])} />
                    </g>
                  ))}
                  <g className="letter">
                    <rect x="-17" y="-12" width="34" height="24" rx="3" />
                    <path d="M-17 -12 L0 2 L17 -12" />
                  </g>
                  <circle className="note" r="7" />
                  {JOBS.map((j) => (
                    <g key={j.k} className="plane">
                      <path d="M-10 -8 L13 0 L-10 8 L-6 0 Z" />
                    </g>
                  ))}
                </svg>
                {/* Kept apart from the masked trails above: those are only switched on for "How it works". */}
                <svg className="paths paths2" width={INT.w} height={INT.h} viewBox={`0 0 ${INT.w} ${INT.h}`} fill="none">
                  {/* the extra room, sketched onto the side of the house */}
                  <g className="extn">
                    <path className="ex-line" d="M1240 562 H1422 V452 L1331 404 L1240 452" />
                    <path className="ex-line" d="M1240 452 H1422" />
                    <g className="ex-ghost">
                      <circle cx="1331" cy="520" r="30" />
                      <text x="1331" y="532" textAnchor="middle">?</text>
                    </g>
                  </g>
                  <path id="op" className="guide" d={curve(HALO, { x: int.mailSlot[0], y: int.mailSlot[1] }, -30)} />
                  <g className="letter letter2">
                    <rect x="-14" y="-10" width="28" height="20" rx="3" />
                    <path d="M-14 -10 L0 1 L14 -10" />
                  </g>
                </svg>

                {JOBS.map((j) => {
                  const p = head(j.k);
                  return (
                    <span key={j.k} className="tag" style={{ left: p.x + (TAG_NUDGE[j.k] ?? 0), top: p.y - 8 }}>
                      <b>{j.k[0].toUpperCase() + j.k.slice(1)}</b> {j.text}
                    </span>
                  );
                })}
              </div>
              <canvas className="spot-cv" />
            </div>

            <div className="glow" />
          </div>
          <div className="bezel"><i /></div>
        </div>
        <div className="loops"><div className="loops-in"><Loops drive={drive} /></div></div>
        <div className="scrim-side" />
        <div className="scrim-top" />
      </div>

      {/* ---------- the words ---------- */}
      <div className="copy">
        <section className="sc sc-hero" id="top" data-label="hero">
          <img className="sc-bg" src="/house/night.webp" alt="" loading="lazy" />
          <div className="col">
            <h1>
              <span className="ln"><span>Working while</span></span>{" "}
              <span className="ln"><span>you don&rsquo;t.</span></span>
            </h1>
            <p className="lede">
              Loopmates is a team of 19 AI helpers that lives on your own computer. Tell them what you need. They plan
              it, do it, and ask you before anything important goes out.
            </p>
            <div className="cta">
              <a className="btn btn-solid" href="#join" data-go="join">Join the list</a>
              <a className="btn btn-ghost" href={FILM_URL} target="_blank" rel="noopener noreferrer">
                Watch the film<span className="sr"> (opens YouTube)</span>
              </a>
            </div>
          </div>
        </section>

        <section className="sc sc-what" id="what">
          <img className="sc-bg" src="/house/night.webp" alt="" loading="lazy" />
          <div className="col">
            <h2>So, what is Loopmates?</h2>
            <p className="what-p">
              Picture your computer as a little house. Inside live 19 Mates, AI helpers who each have one job. Mimo,
              the lead, takes your request, hands out the work and calls you when it&rsquo;s done.
            </p>
          </div>
        </section>

        <section className="sc sc-inside" id="mates">
          <img className="sc-bg" src="/house/inside.webp" alt="" loading="lazy" />
          <div className="col">
            <h2>Your second brain is a house full of Mates.</h2>
            <p>Nineteen Mates, each with one job and a room of its own. Switch any of them on or off, or make your own.</p>
          </div>
        </section>

        <section className="sc sc-tour" aria-label="The house, room by room">
          <ol className="rooms">
            {ROOMS.map((r, i) => (
              <li key={r.id} className="room-card">
                <div className="rc-faces" aria-hidden="true">
                  {r.mates.length ? (
                    r.mates.map((k) => <img key={k} src={mateImg(k)} alt="" width={58} height={Math.round(58 / MATE_AR[k])} />)
                  ) : (
                    <span className="rc-ghost">?</span>
                  )}
                </div>
                <p className="rc-room">
                  {r.name}
                  <span className="rc-count"> · {i + 1} of {ROOMS.length}</span>
                </p>
                <h3>{r.title}</h3>
                <p className="rc-line">{r.line}</p>
                {r.ask && (
                  <p className="rc-ask">
                    <span className="rc-say">You could say</span>
                    <span className="bubble">&ldquo;{r.ask}&rdquo;</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
          <svg className="map" viewBox="360 0 1080 915" aria-hidden="true">
            <path className="map-roof" d="M372 290 L808 10 L1244 290" />
            {ROOMS.map((r) => (
              <rect
                key={r.id}
                className={`cell${r.id === "extension" ? " cell-x" : ""}`}
                x={r.rect[0]} y={r.rect[1]} width={r.rect[2] - r.rect[0]} height={r.rect[3] - r.rect[1]} rx="8"
              />
            ))}
            {ROOMS.map((r) => (
              <rect
                key={r.id}
                className="cell-on"
                x={r.rect[0]} y={r.rect[1]} width={r.rect[2] - r.rect[0]} height={r.rect[3] - r.rect[1]} rx="8"
              />
            ))}
          </svg>
        </section>

        <section className="sc sc-how" id="how">
          <img className="sc-bg" src="/house/inside.webp" alt="" loading="lazy" />
          <div className="col">
            <h2>You ask once. The house gets to work.</h2>
            <ol className="steps">
              <li className="step">
                <span className="n">1</span>
                <p>
                  A letter drops through the door: your request, by chat, voice, Telegram, WhatsApp or Slack.{" "}
                  <span className="q">&ldquo;I launch my app on Friday. Get everything ready.&rdquo;</span>
                </p>
              </li>
              <li className="step"><span className="n">2</span><p>Mimo reads it, and Planner splits it into six jobs.</p></li>
              <li className="step">
                <span className="n">3</span>
                <p>
                  Paper planes fly to six rooms, and six Mates work at the same time.
                  <span className="jobs"> Research compares three similar apps, Writer drafts the launch post, Code fixes the sign-up bug, Orbit clears Friday morning, Data charts the sign-ups, and Browser fills in the launch-site form.</span>
                </p>
              </li>
              <li className="step"><span className="n">4</span><p>Everything they make comes back to Halo at the front door.</p></li>
              <li className="step"><span className="n">5</span><p>Mimo calls you when it&rsquo;s done.</p></li>
            </ol>
          </div>
        </section>

        <section className="sc sc-halo" id="safe">
          <img className="sc-bg" src="/house/inside.webp" alt="" loading="lazy" />
          <div className="col">
            <h2>Nothing leaves the house without your yes.</h2>
            <p>
              Halo waits at the front door. Anything that would send, delete, spend or post stops here, and you see
              exactly what will happen.
            </p>
            <div className="approve" role="img" aria-label="Example: Halo asks for your yes before Writer's launch post goes out on your blog.">
              <div className="ap-head">
                <img src={mateImg("halo")} alt="" width={46} height={42} />
                <div>
                  <p className="ap-t">Halo needs your yes</p>
                  <p className="ap-s">Writer&rsquo;s launch post is ready to go out.</p>
                </div>
              </div>
              <div className="ap-body">
                <p className="ap-ask">Post &ldquo;We launch on Friday&rdquo; to your blog.</p>
                <p className="ap-done">Sent. The post is live on your blog.</p>
              </div>
              <div className="ap-btns">
                <span className="ap-yes">Send it</span>
                <span className="ap-no">Not yet</span>
              </div>
            </div>
          </div>
        </section>

        <section className="sc sc-call" id="call">
          <img className="sc-bg" src="/house/night.webp" alt="" loading="lazy" />
          <div className="col">
            <h2>It knows when to tap you on the shoulder.</h2>
            <p>
              Your Mates keep an eye on deadlines, your projects, the news and your smart home. Then they decide what&rsquo;s
              worth a morning briefing, a message or a phone call.
            </p>
            <p className="said">&ldquo;Tell me if the garage is still open after 11&nbsp;pm.&rdquo;</p>
          </div>
          <div className="call" role="img" aria-label="Example: Mimo calls to say the garage door is still open.">
            <div className="call-face">
              <i /><i />
              <img src={mateImg("mimo")} alt="" width={72} height={59} />
            </div>
            <p className="call-who">Mimo</p>
            <p className="call-st">calling&hellip;</p>
            <p className="call-msg">&ldquo;It&rsquo;s 11:04 and the garage door is still open. Want me to close it?&rdquo;</p>
          </div>
        </section>

        <section className="sc sc-home" id="home">
          <img className="sc-bg" src="/house/night.webp" alt="" loading="lazy" />
          <div className="col">
            <h2>It lives on your computer, not in someone&rsquo;s cloud.</h2>
            <ul className="points">
              <li><b>One program, on your own computer.</b> Windows or Linux. Your phone and browser connect to it from anywhere.</li>
              <li><b>Your keys and files stay home.</b> They&rsquo;re kept on your computer, not on someone else&rsquo;s server.</li>
              <li><b>Start free.</b> Use Gemini, Groq, Cerebras, NVIDIA NIM or OpenRouter. If one is down, the next takes over.</li>
            </ul>
            <p className="apps">Works with {APPS.slice(0, -1).join(", ")} and {APPS[APPS.length - 1]}.</p>
          </div>
        </section>

        <section className="sc sc-limits" id="limits">
          <img className="sc-bg" src="/house/night-off.webp" alt="" loading="lazy" />
          <div className="col">
            <h2>When your computer sleeps, so does the house.</h2>
            <p className="lim-sub">The honest list. Worth knowing before you join.</p>
            <ul className="limits">
              {LIMITS.map((l) => (
                <li key={l.h} className="limit">
                  <p className="lh">{l.h}</p>
                  <p className="lp">{l.p}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sc sc-join" id="join" data-label="join">
          <img className="sc-bg" src="/house/night.webp" alt="" loading="lazy" />
          <div className="col">
            <p className="porch-line">We&rsquo;ll leave the porch light on.</p>
            <h2>Get your Mates first.</h2>
            <p>Leave your email and we&rsquo;ll send an invite as soon as there&rsquo;s room for you.</p>
            <JoinForm id="join-email" onDone={lightsUp} />
            <div className="next">
              <h3>What happens next</h3>
              <ol>
                <li><span>1</span>We email you an invite when there&rsquo;s room.</li>
                <li><span>2</span>You install it on your Windows or Linux computer.</li>
                <li><span>3</span>You tell Mimo what you need, and the house gets to work.</li>
              </ol>
            </div>
            <a className="film-link" href={FILM_URL} target="_blank" rel="noopener noreferrer">
              Or watch the film first<span className="sr"> (opens YouTube)</span>
            </a>
            {/* on phones the footer sits under the words, so the lawn stays clear */}
            <nav className="foot-mini" aria-label="Footer">
              <a href={REPO_URL}>Source on GitHub</a>
              <a href="#how" data-go="how">How it works</a>
              <a href="#limits" data-go="limits">What it can&rsquo;t do</a>
            </nav>
          </div>
          <footer className="foot">
            <span className="foot-word">loopmates</span>
            <nav aria-label="Footer">
              <a href={REPO_URL}>Source on GitHub</a>
              <a href="#how" data-go="how">How it works</a>
              <a href="#limits" data-go="limits">What it can&rsquo;t do</a>
            </nav>
            <span>&copy; 2026 Loopmates</span>
          </footer>
        </section>
      </div>
    </div>
  );
}
