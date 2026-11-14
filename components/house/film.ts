import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { EXT, INT, JOBS, ROOMS, ext, int, type Rect } from "@/lib/house";
import type { MateKey } from "@/lib/mates";
import { box, camVars, cover, fit, fullBox, isWide, vh, vw, zoomAt, type Box, type Cam } from "./cam";
import type { LoopsDrive } from "./Loops";

/** One unit of timeline time is this many viewport heights of scrolling. */
const PACE = 0.95;
/** The laptop's screen shape. */
const LAP_AR = 1.6;

/** Where the laptop screen sits before the device shrinks: the largest 16:10 box in the viewport. */
function band(): Box {
  const w = vw();
  const h = vh();
  if (w / h > LAP_AR) {
    const bw = h * LAP_AR;
    return { x: (w - bw) / 2, y: 0, w: bw, h };
  }
  const bh = w / LAP_AR;
  return { x: 0, y: (h - bh) / 2, w, h: bh };
}

/**
 * The picture area beside the words (wide screens) or above them (phones). On phones the words sit at the bottom
 * and some scenes have more of them, so pass that scene's column to keep the picture clear of it.
 */
const STAGE = (col?: HTMLElement): Box => {
  if (isWide()) return box(0.37, 0.08, 0.6, 0.86);
  const top = 0.07 * vh();
  const bottom = col ? Math.min(0.52 * vh(), col.offsetTop - 14) : 0.52 * vh();
  return { x: 0.03 * vw(), y: top, w: 0.94 * vw(), h: Math.max(0.2 * vh(), bottom - top) };
};

/** Shots of the cottage from outside. */
const E = {
  full: (): Cam => {
    // tall phones: a smaller house at the bottom and a tall sky above it (the sky continues past the picture)
    if (vh() / vw() > 1.2) {
      const s = Math.min(Math.max(vw() / EXT.w, vh() / EXT.h), (2.2 * vw()) / EXT.w);
      return { scale: s, x: vw() / 2 - 1105 * s, y: vh() - EXT.h * s };
    }
    const s = Math.max(vw() / EXT.w, vh() / EXT.h);
    const x = isWide() ? (vw() - EXT.w * s) / 2 : vw() / 2 - 1105 * s;
    return cover({ scale: s, x, y: (vh() - EXT.h * s) / 2 }, EXT.w, EXT.h);
  },
  house: (): Cam =>
    cover(fit(ext.house, STAGE(), { pad: 0.05, max: isWide() ? 1.9 : 1.7, min: isWide() ? 0 : 1.35 }), EXT.w, EXT.h),
  window: (): Cam => zoomAt((ext.window[0] + ext.window[2]) / 2, (ext.window[1] + ext.window[3]) / 2, isWide() ? 17 : 20),
  door: (): Cam => zoomAt((ext.door[0] + ext.door[2]) / 2, (ext.door[1] + ext.door[3]) / 2, isWide() ? 9 : 10),
  lap: (): Cam => {
    const b = band();
    const s = Math.max(b.w / EXT.w, b.h / EXT.h);
    return { scale: s, x: b.x + (b.w - EXT.w * s) / 2, y: b.y + (b.h - EXT.h * s) / 2 };
  },
};

/** Shots inside the cutaway. */
const I = {
  close: (): Cam => zoomAt(802, 500, isWide() ? 4.6 : 3.4),
  overview: (col?: HTMLElement) => (): Cam => fit(int.house, STAGE(col), { pad: 0.01 }),
  // Phones let the picture rise off the bottom, or rooms on the ground floor would sit behind the words.
  room: (r: Rect, col?: HTMLElement) => (): Cam =>
    cover(fit(r, STAGE(col), { pad: 0.1, max: isWide() ? 2.3 : 1.9 }), INT.w, INT.h, fullBox(), !isWide()),
  door: (): Cam => zoomAt((int.door[0] + int.door[2]) / 2, (int.door[1] + int.door[3]) / 2 + 20, isWide() ? 8 : 9),
};

/** The laptop pulled back: beside the words, or above them. */
const LAP = () =>
  isWide() ? { scale: 0.52, x: 0.2 * vw(), y: 0.01 * vh() } : { scale: 0.9, x: 0, y: -0.2 * vh() };

/** Where the 3D loops rest before you scroll. */
const LOOPS0 = () =>
  isWide() ? { x: 0.13 * vw(), y: -0.2 * vh(), scale: 0.6 } : { x: 0, y: 0.085 * vh(), scale: 0.38 };

/** The spotlight's opening, in cutaway pixels. */
const spotVars = (r: Rect, pad = 8) => ({ x0: r[0] - pad, y0: r[1] - pad, x1: r[2] + pad, y1: r[3] + pad });

/**
 * The whole page is one pinned stage and one timeline, scrubbed by scroll.
 * Each image change happens mid-move, and every resting point is a label the scroll settles on.
 */
export function buildFilm(root: HTMLElement, drive: LoopsDrive) {
  const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
  const $$ = (s: string) => gsap.utils.toArray<HTMLElement>(s, root);
  const mate = (k: MateKey) => $(`.mate[data-k="${k}"]`);
  const hopEl = (k: MateKey) => $(`.mate[data-k="${k}"] .mate-h`);

  const extCam = $(".ext");
  const intCam = $(".int-cam");
  const device = $(".device");
  const grass = $(".grass");
  // The spotlight is drawn on a screen-sized canvas each frame from the camera and this rectangle:
  // far cheaper than repainting a darkened layer the size of the zoomed house.
  const spot = { ...spotVars(int.house, 0), a: 0 };
  const cv = root.querySelector<HTMLCanvasElement>(".spot-cv")!;
  const ctx = cv.getContext("2d")!;
  let dpr = 1;
  let lastKey = "";
  const sizeCanvas = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(vw() * dpr);
    cv.height = Math.round(vh() * dpr);
    lastKey = "";
  };
  sizeCanvas();
  const drawSpot = () => {
    const s = Number(gsap.getProperty(intCam, "scale"));
    const sx = Number(gsap.getProperty(intCam, "x"));
    const sy = Number(gsap.getProperty(intCam, "y"));
    const key = [spot.a, s, sx, sy, spot.x0, spot.y0, spot.x1, spot.y1].map((v) => v.toFixed(2)).join("|");
    if (key === lastKey) return;
    lastKey = key;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (spot.a < 0.002) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x0 = sx + spot.x0 * s;
    const y0 = sy + spot.y0 * s;
    const w = (spot.x1 - spot.x0) * s;
    const h = (spot.y1 - spot.y0) * s;
    const r = Math.min(14 * s, w / 2, h / 2);
    const hole = () => (ctx.roundRect ? ctx.roundRect(x0, y0, w, h, r) : ctx.rect(x0, y0, w, h));
    ctx.beginPath();
    ctx.rect(0, 0, vw(), vh());
    hole();
    ctx.fillStyle = `rgba(12, 9, 32, ${0.62 * spot.a})`;
    ctx.fill("evenodd");
    ctx.beginPath();
    hole();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(255, 222, 170, ${0.5 * spot.a})`;
    ctx.stroke();
  };
  gsap.ticker.add(drawSpot);
  const sideScrim = $(".scrim-side");
  const topScrim = $(".scrim-top");

  const setBand = () => {
    const b = band();
    device.style.setProperty("--it", `${b.y}px`);
    device.style.setProperty("--il", `${b.x}px`);
  };
  setBand();

  // Layers that only matter for a moment stay visibility:hidden the rest of the time. Hidden layers aren't
  // painted, so zooming the house doesn't re-raster them on every frame (the masked trails are expensive).
  const paths = $(".paths:not(.paths2)");
  const paths2 = $(".paths2");
  gsap.set([paths, paths2, $(".int-dim"), $(".ring"), $(".house-glow")], { autoAlpha: 0 });
  gsap.set($$(".win"), { visibility: "hidden" });

  // starting states that CSS can't know
  gsap.set($$(".mate"), { scale: 0, y: 24, transformOrigin: "50% 100%" });
  gsap.set($$(".plane, .letter, .note"), { opacity: 0 });
  gsap.set($$(".jm, .nm, .ex-line"), { drawSVG: "0%" });
  gsap.set($$(".step"), { opacity: 0.4 });

  const words = SplitText.create(root.querySelector(".what-p"), { type: "words", wordsClass: "w" }).words;
  gsap.set(words, { opacity: 0.16 });

  const tl = gsap.timeline({ defaults: { ease: "none", duration: 0.3 } });
  // The words come in out of focus and sharpen as they settle. The blur sits on the scene's children, not the
  // full-screen section, so only the text is filtered; it is cleared once sharp, because any filter would cut
  // the frosted buttons inside off from the picture behind them.
  const show = (sel: string, at: number, d = 0.3) => {
    const kids = $$(`${sel} > :not(.sc-bg)`);
    tl.fromTo(sel, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: d, ease: "power2.out" }, at)
      .fromTo(kids, { filter: "blur(14px)" }, { filter: "blur(0px)", duration: d * 1.15, ease: "power2.out" }, at)
      .set(kids, { filter: "none" }, at + d * 1.15);
    return tl;
  };
  const hide = (sel: string | Element, at: number, d = 0.15) =>
    tl.to(sel, { opacity: 0, y: -24, duration: d, ease: "power1.in" }, at);
  const hop = (k: MateKey, at: number) =>
    tl.to(hopEl(k), { keyframes: [{ y: -14, duration: 0.06, ease: "power2.out" }, { y: 0, duration: 0.09, ease: "bounce.out" }] }, at);

  // ---------- 0 · the first frame
  tl.set(extCam, camVars(E.full), 0)
    .set(intCam, camVars(I.close), 0)
    .set($(".loops"), { x: () => LOOPS0().x, y: () => LOOPS0().y, scale: () => LOOPS0().scale }, 0)
    .addLabel("hero", 0);

  // ---------- 1 · through the loops, closer to the house: "So, what is Loopmates?"
  tl.to(drive, { fly: 1, duration: 1.2 }, 0.05)
    .to($(".loops"), { x: 0, y: 0, scale: 1, duration: 0.85, ease: "power2.in" }, 0.05)
    .to($(".loops"), { opacity: 0, duration: 0.16 }, 1.06)
    .to($(".sc-hero"), { y: () => -0.08 * vh(), opacity: 0, duration: 0.4, ease: "power2.in" }, 0.05)
    .to(topScrim, { opacity: 0, duration: 0.4 }, 0.1)
    .to(extCam, { ...camVars(E.house), duration: 1.2, ease: "power2.inOut" }, 0.35)
    .to(grass, { y: () => 0.22 * vh(), scale: 1.12, duration: 1.2, ease: "power2.inOut" }, 0.35)
    .to(sideScrim, { opacity: 1, duration: 0.4 }, 0.85);
  show(".sc-what", 1.0);
  tl.to(words, { opacity: 1, duration: 0.05, stagger: 0.6 / words.length }, 1.2).addLabel("what", 1.9);

  // ---------- 2 · fly in through the upstairs window; warm light hides the change of picture
  hide(".sc-what", 2.0, 0.25);
  tl.to(sideScrim, { opacity: 0, duration: 0.3 }, 2.0)
    .to(extCam, { ...camVars(E.window), duration: 0.8, ease: "power3.in" }, 2.0)
    .to(grass, { y: () => 0.9 * vh(), scale: 1.5, duration: 0.45, ease: "power2.in" }, 2.0)
    .fromTo($(".glow"), { opacity: 0, scale: 0.25 }, { opacity: 1, scale: 2.4, duration: 0.42, ease: "power2.in" }, 2.38)
    .set($(".int"), { opacity: 1 }, 2.8);

  // ---------- 3 · inside: pull back from the living room, Mates pop in
  tl.to($(".glow"), { opacity: 0, scale: 3.2, duration: 0.4, ease: "power1.out" }, 2.82)
    .to(intCam, { ...camVars(I.overview($(".sc-inside .col"))), duration: 0.75, ease: "power3.out" }, 2.8);
  // Mimo and Spark are already home when the light clears
  tl.to([mate("mimo"), mate("spark")], { scale: 1, y: 0, duration: 0.14, ease: "back.out(2.4)", stagger: 0.03 }, 2.74);
  (["writer", "chef", "code", "byte", "research", "scout", "planner", "flow", "data", "tune", "recall", "ops", "luna", "orbit", "halo", "zen", "browser"] as MateKey[]).forEach((k, i) =>
    tl.to(mate(k), { scale: 1, y: 0, duration: 0.16, ease: "back.out(2.4)" }, 3.0 + i * 0.025)
  );
  tl.to(sideScrim, { opacity: 1, duration: 0.3 }, 3.1);
  show(".sc-inside", 3.2);
  tl.addLabel("inside", 3.6);

  // ---------- 4 · room by room
  const T0 = 3.7;
  const STEP = 0.8;
  const cards = $$(".room-card");
  const ons = $$(".cell-on");
  gsap.set(cards, { opacity: 0 });
  gsap.set(ons, { opacity: 0 });
  ROOMS.forEach((r, i) => {
    const t = T0 + i * STEP;
    if (i === 0) {
      hide(".sc-inside", t);
      tl.set($(".sc-tour"), { opacity: 1 }, t)
        .fromTo(spot, { a: 0 }, { a: 1, duration: 0.3 }, t + 0.1)
        .fromTo($(".map"), { opacity: 0 }, { opacity: 1, duration: 0.2 }, t + 0.3);
    } else {
      hide(cards[i - 1], t, 0.14);
      tl.to(ons[i - 1], { opacity: 0, duration: 0.15 }, t);
    }
    tl.to(intCam, { ...camVars(I.room(r.rect)), duration: 0.5, ease: "power2.inOut" }, t)
      .to(spot, { ...spotVars(r.rect), duration: 0.5, ease: "power2.inOut" }, t)
      .fromTo(cards[i], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" }, t + 0.32)
      .to(ons[i], { opacity: 1, duration: 0.15 }, t + 0.3);
    r.mates.forEach((k, j) => hop(k, t + 0.42 + j * 0.05));
    if (r.id === "extension") {
      tl.set(paths2, { autoAlpha: 1 }, t);
      tl.to($$(".ex-line"), { drawSVG: "100%", duration: 0.3, ease: "power1.inOut", stagger: 0.06 }, t + 0.12)
        .fromTo($(".ex-ghost"), { opacity: 0, scale: 0.6, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.15, ease: "back.out(2)" }, t + 0.4);
    }
    tl.addLabel(`room-${i}`, t + 0.6);
  });

  // ---------- 5 · how it works: one letter in, six paper planes out, everything back to Halo
  const H0 = T0 + ROOMS.length * STEP;
  hide(cards[cards.length - 1], H0, 0.14);
  tl.to(ons[ons.length - 1], { opacity: 0, duration: 0.15 }, H0)
    .to($(".map"), { opacity: 0, duration: 0.14 }, H0)
    .to($(".extn"), { opacity: 0, duration: 0.2 }, H0)
    .set(paths2, { autoAlpha: 0 }, H0 + 0.22)
    .to(spot, { ...spotVars(int.house, 0), duration: 0.5, ease: "power2.inOut" }, H0)
    .to(spot, { a: 0, duration: 0.3 }, H0 + 0.2)
    .to(intCam, { ...camVars(I.overview($(".sc-how .col"))), duration: 0.55, ease: "power2.inOut" }, H0)
    .to($(".int-dim"), { autoAlpha: 1, duration: 0.3 }, H0 + 0.25);
  show(".sc-how", H0 + 0.3);
  tl.addLabel("how", H0 + 0.62);

  const steps = $$(".step");
  const stepOn = (i: number, at: number) => {
    tl.to(steps[i], { opacity: 1, duration: 0.1 }, at);
    if (i > 0) tl.to(steps[i - 1], { opacity: 0.4, duration: 0.1 }, at);
  };
  const letters = $$(".letter");
  const planes = $$(".plane");
  const tags = $$(".tag");
  gsap.set(tags, { autoAlpha: 0, xPercent: -50, yPercent: -100 });

  tl.set(paths, { autoAlpha: 1 }, H0 + 0.6);
  stepOn(0, H0 + 0.62);
  tl.set(letters[0], { opacity: 1 }, H0 + 0.7)
    .to(letters[0], { motionPath: { path: "#lp", align: "#lp", alignOrigin: [0.5, 0.5] }, duration: 0.42, ease: "power1.inOut" }, H0 + 0.7)
    .to(letters[0], { opacity: 0, duration: 0.06 }, H0 + 1.12);
  hop("mimo", H0 + 1.1);

  stepOn(1, H0 + 1.16);
  tl.set($(".note"), { opacity: 1 }, H0 + 1.2)
    .to($(".nm"), { drawSVG: "100%", duration: 0.3 }, H0 + 1.2)
    .to($(".note"), { motionPath: { path: "#np", align: "#np", alignOrigin: [0.5, 0.5] }, duration: 0.3, ease: "power1.inOut" }, H0 + 1.2)
    .to($(".note"), { opacity: 0, duration: 0.06 }, H0 + 1.5);
  hop("planner", H0 + 1.5);

  stepOn(2, H0 + 1.56);
  JOBS.forEach((j, i) => {
    const at = H0 + 1.6 + i * 0.07;
    tl.set(planes[i], { opacity: 1 }, at)
      .to(root.querySelector(`#jm-${i} .jm`), { drawSVG: "100%", duration: 0.45, ease: "power1.inOut" }, at)
      .to(planes[i], { motionPath: { path: `#jp-${i}`, align: `#jp-${i}`, alignOrigin: [0.5, 0.5], autoRotate: true }, duration: 0.45, ease: "power1.inOut" }, at)
      .to(planes[i], { opacity: 0, duration: 0.05 }, at + 0.45)
      .fromTo(tags[i], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.12, ease: "power2.out" }, at + 0.43);
    hop(j.k, at + 0.45);
  });

  const R0 = H0 + 1.6 + (JOBS.length - 1) * 0.07 + 0.55;
  stepOn(3, R0);
  // the finished work flies back down to Halo as paper planes
  tl.to($$(".trail"), { opacity: 0.35, duration: 0.2 }, R0);
  JOBS.forEach((_, i) => {
    const at = R0 + 0.04 + i * 0.035;
    tl.set(planes[i], { opacity: 1 }, at)
      .to(planes[i], { motionPath: { path: `#rp-${i}`, align: `#rp-${i}`, alignOrigin: [0.5, 0.5], autoRotate: true }, duration: 0.34, ease: "power1.inOut" }, at)
      .to(planes[i], { opacity: 0, duration: 0.04 }, at + 0.32);
  });
  hop("halo", R0 + 0.45);
  stepOn(4, R0 + 0.5);
  tl.fromTo($(".ring"), { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.15, ease: "back.out(2)" }, R0 + 0.52);
  hop("mimo", R0 + 0.55);
  tl.addLabel("how-done", R0 + 0.75);

  // ---------- 6 · Halo at the door
  const HA = R0 + 0.85;
  hide(".sc-how", HA);
  tl.to([...tags, ...$$(".fade"), $(".ring")], { autoAlpha: 0, duration: 0.2 }, HA)
    .set(paths, { autoAlpha: 0 }, HA + 0.22)
    .to($(".int-dim"), { autoAlpha: 0, duration: 0.3 }, HA)
    .to(intCam, { ...camVars(I.room(ROOMS.find((r) => r.id === "hall")!.rect, $(".sc-halo .col"))), duration: 0.55, ease: "power2.inOut" }, HA)
    .set(spot, spotVars(ROOMS.find((r) => r.id === "hall")!.rect), HA + 0.1)
    .to(spot, { a: 1, duration: 0.3 }, HA + 0.25);
  show(".sc-halo", HA + 0.35);
  tl.fromTo($(".approve"), { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: "back.out(1.6)" }, HA + 0.5)
    .addLabel("halo", HA + 0.8);

  const S = HA + 0.9;
  tl.to($(".ap-yes"), { scale: 0.93, duration: 0.05 }, S)
    .to($(".ap-yes"), { scale: 1, duration: 0.06 }, S + 0.05)
    .to($(".ap-ask"), { opacity: 0, duration: 0.08 }, S + 0.08)
    .fromTo($(".ap-done"), { opacity: 0 }, { opacity: 1, duration: 0.08 }, S + 0.12)
    .set(paths2, { autoAlpha: 1 }, S + 0.1)
    .set(letters[1], { opacity: 1 }, S + 0.12)
    .to(letters[1], { motionPath: { path: "#op", align: "#op", alignOrigin: [0.5, 0.5] }, duration: 0.25, ease: "power1.in" }, S + 0.12)
    .to(letters[1], { opacity: 0, duration: 0.05 }, S + 0.37);
  hop("halo", S + 0.1);

  // ---------- 7 · out through the front door, into the night: Mimo calls
  const O = S + 0.32;
  hide(".sc-halo", O);
  tl.set(paths2, { autoAlpha: 0 }, O + 0.1)
    .to(spot, { a: 0, duration: 0.2 }, O)
    .to(intCam, { ...camVars(I.door), duration: 0.5, ease: "power2.in" }, O)
    .set(extCam, camVars(E.door), O + 0.38)
    .set(grass, { y: () => 0.5 * vh(), scale: 1.3 }, O + 0.38)
    .to($(".int"), { opacity: 0, duration: 0.14 }, O + 0.4)
    .to(extCam, { ...camVars(E.full), duration: 0.7, ease: "power3.out" }, O + 0.42)
    .to(grass, { y: 0, scale: 1, duration: 0.7, ease: "power3.out" }, O + 0.42);

  const C = O + 0.75;
  show(".sc-call", C);
  tl.fromTo($(".call"), { opacity: 0, y: 30, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: "back.out(1.6)" }, C + 0.15)
    // Promote the laptop to its own layer while the call scene rests (the one-off raster is invisible when nothing
    // moves), and only until the limits scene rests. It only ever shrinks, so the fixed raster stays sharp.
    // Left on all the time it makes the paper planes, painted into the same layer, re-raster the whole screen.
    .set(device, { willChange: "transform" }, C + 0.46)
    .addLabel("call", C + 0.5);

  // ---------- 8 · pull back: the house was on your laptop all along
  const L = C + 0.6;
  hide(".sc-call", L);
  tl.to(sideScrim, { opacity: 0, duration: 0.3 }, L)
    .to(device, { x: () => LAP().x, y: () => LAP().y, scale: () => LAP().scale, "--lap": 1, duration: 0.75, ease: "power2.inOut" }, L + 0.05)
    .to(extCam, { ...camVars(E.lap), duration: 0.75, ease: "power2.inOut" }, L + 0.05);
  show(".sc-home", L + 0.55);
  tl.addLabel("home", L + 0.95);

  // ---------- 9 · push back in; the lights go out one window at a time, one limit each
  const M = L + 1.05;
  hide(".sc-home", M);
  tl.to(device, { x: 0, y: 0, scale: 1, "--lap": 0, duration: 0.65, ease: "power2.inOut" }, M + 0.05)
    .to(extCam, { ...camVars(E.full), duration: 0.65, ease: "power2.inOut" }, M + 0.05)
    .set($$(".win"), { visibility: "visible" }, M + 0.35)
    .to($(".ext-on"), { opacity: 0, duration: 0.6 }, M + 0.4)
    .to($(".smoke"), { opacity: 0, duration: 0.3 }, M + 0.4)
    .to(topScrim, { opacity: 1, duration: 0.3 }, M + 0.5)
    // on wide screens the lower rows sit over the trees: darken the left too
    .to(sideScrim, { opacity: () => (isWide() ? 0.85 : 0), duration: 0.3 }, M + 0.5);
  show(".sc-limits", M + 0.6);
  tl.set(device, { willChange: "auto" }, M + 0.93).addLabel("limits", M + 0.95);
  const lims = $$(".limit");
  const wins = $$(".win");
  gsap.set(lims, { opacity: 0 });
  const LM = M + 1.0;
  lims.forEach((el, i) => {
    const at = LM + i * 0.36;
    tl.fromTo(el, { opacity: 0, y: 20, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.18, ease: "power2.out" }, at).to(wins[i], { opacity: 0, duration: 0.22 }, at);
  });
  const lastWin = LM + lims.length * 0.36;
  tl.to(wins.slice(lims.length), { opacity: 0, duration: 0.3 }, lastWin).addLabel("limits-all", lastWin + 0.3);

  // ---------- 10 · one light left on, and the Mates out on the lawn: join
  const J = lastWin + 0.4;
  hide(".sc-limits", J);
  const lawnIn = (sel: string) =>
    tl.fromTo($$(sel), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.2, ease: "back.out(1.8)", stagger: { each: 0.014, from: "center" } }, J + 0.3);
  // the words sit on the dark left on wide screens; on phones the top scrim already carries them
  tl.to(sideScrim, { opacity: () => (isWide() ? 1 : 0), duration: 0.3 }, J)
    .to(wins[wins.length - 1], { opacity: 1, duration: 0.4 }, J + 0.15)
    .to($(".smoke"), { opacity: 1, duration: 0.3 }, J + 0.3);
  lawnIn(".lawn-wide .lawn-m");
  lawnIn(".lawn-phone .lawn-m");
  show(".sc-join", J + 0.45);
  tl.addLabel("join", J + 0.8).to({}, { duration: 0.05 }, J + 0.8);

  const sections = $$(".sc");
  const st = ScrollTrigger.create({
    trigger: root,
    start: "top top",
    end: () => `+=${Math.round(tl.duration() * vh() * PACE)}`,
    pin: true,
    scrub: 0.6,
    animation: tl,
    invalidateOnRefresh: true,
    // ?film-debug turns snapping off so a script can stop on any frame
    snap: location.search.includes("film-debug")
      ? undefined
      : { snapTo: "labelsDirectional", duration: { min: 0.35, max: 1.4 }, delay: 0.12, ease: "power2.inOut" },
    onRefreshInit: () => {
      setBand();
      sizeCanvas();
    },
    onUpdate: () => {
      // only the words on screen can be clicked
      for (const s of sections) s.style.pointerEvents = Number(gsap.getProperty(s, "opacity")) > 0.5 ? "auto" : "none";
    },
  });

  // ---------- on load: the first frame settles in
  const intro = gsap.timeline({ delay: 0.1 });
  if (window.scrollY < 10) {
    intro
      .from(".sc-hero .ln > span", { yPercent: 110, filter: "blur(12px)", duration: 1.3, ease: "power4.out", stagger: 0.12, clearProps: "filter" }, 0)
      .from(".sc-hero .lede, .sc-hero .cta", { opacity: 0, y: 24, filter: "blur(10px)", duration: 1, ease: "power3.out", stagger: 0.1, clearProps: "filter" }, 0.45)
      .from(".screen", { scale: 1.08, duration: 2.4, ease: "power2.out" }, 0)
      .from(".loops-in", { scale: 0.5, opacity: 0, duration: 2, ease: "expo.out" }, 0.2)
      .from(".grass-in", { yPercent: 25, duration: 2, ease: "power3.out" }, 0);
  }

  const kill = () => gsap.ticker.remove(drawSpot);
  return { tl, st, intro, kill };
}

