/* Loopmates film v2. Every frame is a pure function of time: authored through Motion calls only (no timers, no Math.random, no CSS animations).
   The picture is cut to the user's own voice-over (audio/v2/vo.mp3). Cues are looked up in its word timings (audio/v2/words.js,
   made locally by tools/align.py), so a new take re-times the film without touching these numbers. */
const FPS = 30, LEAD = 0.4;                                   // the voice starts 0.4 s into the film
const norm = s => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '');
const W = window.VOW.map(w => ({ w: norm(w.word), f: Math.round((w.start + LEAD) * FPS), e: Math.round((w.end + LEAD) * FPS) }));
const idx = (phrase, k = 0) => {
  const p = phrase.split(/\s+/).map(norm); let n = 0;
  for (let i = 0; i + p.length <= W.length; i++) if (p.every((s, j) => W[i + j].w === s) && n++ === k) return i;
  throw new Error('cue not found in the voice-over: ' + phrase);
};
const F = (phrase, k) => W[idx(phrase, k)].f;                 // frame on which the phrase starts
const FE = (phrase, k) => { const p = phrase.split(/\s+/).length; return W[idx(phrase, k) + p - 1].e; };   // frame on which it ends
const END = W[W.length - 1].e;
const DUR = Math.ceil((END + 48) / FPS);

const M = Motion.film({ fps: FPS, duration: DUR, width: 1920, height: 1080, clock: 'smooth' });
const $ = s => document.querySelector(s);
const rnd = (() => { let a = 20261113; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const sfx = (f, what) => M.mark(f, 'sfx', what);

/* a caption whose words land with the voice (2 frames early); `phrase` are the spoken words, the element holds what is shown */
function say(sel, phrase, o = {}) {
  const i = idx(phrase, o.k || 0), n = phrase.split(/\s+/).length, fr = [];
  for (let j = 0; j < n; j++) fr.push(W[i + j].f - 2);
  const gaps = fr.slice(1).map((f, j) => Math.max(1, f - fr[j]));
  M.words(sel, { at: fr[0], mech: 'rise', gaps: gaps.length ? gaps : [1], dist: o.dist || 46, frames: o.frames || 11, ease: 'softLand' });
  if (o.out != null) M.exit(sel, { at: o.out, frames: o.outFrames || 6, ease: 'accelExit', to: o.to || { y: -40, opacity: 0 }, hide: true });
  return fr[0];
}
const land = (sel, at, from, frames = 11, ease = 'softLand') => M.enter(sel, { at, frames, ease, from });
const markSVG = id => `<svg class="mark" viewBox="0 0 64 64" width="100%" height="100%" fill="none"><defs><clipPath id="${id}"><rect x="25" y="38" width="14" height="18"/></clipPath></defs><circle cx="24" cy="32" r="16" stroke="#D4FF4F" stroke-width="8"/><circle cx="40" cy="32" r="16" stroke="#F4F1EA" stroke-width="8"/><circle cx="24" cy="32" r="16" stroke="#D4FF4F" stroke-width="8" clip-path="url(#${id})"/></svg>`;

/* ======================= cues (scene 1: the problem) ======================= */
const TWO = F('2'), A = F('and somewhere'), AI = F('my ai agent'), CL = F("in someone else's cloud"), e = F('holding my passwords'), f = F('on a model'),
  g = F('and the bill'), h = F('two hundred'), i_ = F('every single month'), s2 = F("i didn't want");
const S1_END = s2;                                            // scene 2 picks up from here

/* ======================= build the repeated parts (deterministic) ======================= */
(() => {
  const st = $('#stars'); let s = '';
  for (let i = 0; i < 150; i++) {
    const big = rnd() < .12, z = big ? 3.4 : 1.4 + rnd() * 1.4, o = (.18 + rnd() * .6).toFixed(2);
    s += `<i style="left:${(rnd() * 1920).toFixed(0)}px;top:${(rnd() * 2700).toFixed(0)}px;width:${z.toFixed(1)}px;height:${z.toFixed(1)}px;opacity:${o}${big ? ';box-shadow:0 0 8px rgba(190,215,255,.9)' : ''}"></i>`;
  }
  st.innerHTML = s;
  Array.from(st.children).filter((el, i) => i % 9 === 0).forEach((el, i) => {
    const o = +el.style.opacity, per = 34 + (i * 7) % 30, ph = (i * 13) % per, k = [[0, o]];
    for (let fr = ph; fr < S1_END + 60; fr += per) k.push([fr, o, 'softInOut'], [fr + per / 2, Math.min(1, o + .45), 'softInOut']);
    M.kf(el, 'opacity', k);
  });
  const puff = a => a.map(([x, y, r]) => `<i style="left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px"></i>`).join('');
  $('#cloudBack').innerHTML = puff([[600, 650, 150], [720, 500, 150], [880, 420, 165], [1060, 430, 160], [1220, 520, 160], [1330, 660, 140], [520, 745, 110], [1405, 765, 105], [960, 560, 200]]);
  $('#cloudFront').innerHTML = puff([[640, 800, 105], [545, 765, 80], [728, 846, 70], [1285, 800, 110], [1388, 768, 80], [1202, 852, 68]]);
  // the bill: 11 months on one strip, newest at the top (it feeds out of the slot downwards)
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV'], N = MONTHS.length, H = N * 200;
  $('#strip').innerHTML = MONTHS.map((m, i) => `<div class="seg" style="top:${(N - 1 - i) * 200}px">${i < N - 1 ? '<u></u>' : ''}<b>${m}</b><s>agent plan</s><em>$200.00</em></div>`).join('');
  const pts = ['0px 0px', '440px 0px', `440px ${H - 14}px`];
  for (let x = 440; x > 0; x -= 22) pts.push(`${x - 11}px ${H}px`, `${x - 22}px ${H - 14}px`);
  $('#strip').style.clipPath = `polygon(${pts.join(',')})`;
  $('#lonMark').innerHTML = markSVG('mk1');
})();

/* my laptop stays asleep through the whole problem (it wakes in scene 2) */
M.hide('#lon', 0);
M.kf('#lspill', 'opacity', [[0, 0]]);

/* ======================= the camera of the night world: (frame, look-at x, look-at y, zoom, ease of the move arriving here) ======================= */
const CAM = [
  [0, 520, 2985, 2.05],
  [A - 30, 526, 2983, 1.96, 'cruise'],            // the clock, through the sigh
  [A - 4, 965, 2890, 1.25, 'glide'],              // pull back: my whole desk, my laptop asleep
  [A + 6, 975, 2884, 1.27, 'cruise'],
  [AI - 2, 962, 1240, 0.92, 'softInOut'],         // "somewhere out there": tilt up off the desk, through the night sky
  [AI + 14, 960, 628, 1.62, 'softLand'],          // ...and land on it: my agent, hard at work
  [CL - 6, 962, 632, 1.70, 'cruise'],
  [CL + 14, 960, 672, 1.18, 'glide'],             // "someone else's cloud": pull back, it sits inside the cloud
  [e - 8, 960, 656, 1.29, 'cruise'],
  [e + 4, 1050, 680, 1.30, 'glide'],              // room on the right for what comes up from below
  [f - 6, 1060, 685, 1.36, 'cruise'],
  [f + 8, 1262, 690, 2.50, 'softLand'],           // the one control
  [g - 10, 1272, 693, 2.68, 'cruise'],
  [g + 6, 960, 880, 1.50, 'glide'],               // under the box
  [h - 9, 960, 885, 1.56, 'cruise'],
  [h + 9, 960, 902, 2.30, 'softLand'],            // the figure
  [i_ - 6, 960, 908, 2.42, 'cruise'],
  [i_ + 16, 1262, 1150, 1.00, 'softLand'],        // step back: it keeps coming
  [S1_END + 40, 1250, 1160, 1.03, 'cruise'],
];
['--cx', '--cy', '--z'].forEach((p, n) => M.kf('#main', p, CAM.map(k => [k[0], k[n + 1], k[4]])));

/* ---------- It's 2 a.m.  (the minute flips on "2") ---------- */
const flip = TWO - 3;
M.kf('#dOld', 'y', [[flip - 6, 0], [flip, -92, 'gentleIn']]); M.kf('#dOld', 'opacity', [[flip - 6, 1], [flip, 0, 'gentleIn']]); M.hide('#dOld', flip);
land('#dNew', flip - 3, { y: 96 }, 9);
M.kf('#clockglow', 'opacity', [[0, .55], [flip - 3, .55], [flip + 1, 1, 'softLand'], [flip + 50, .85, 'cruise'], [A, .9, 'cruise']]);
sfx(flip - 2, 'tick: the minute flips');

/* ---------- [sigh]  my own laptop, asleep ---------- */
M.kf('#lsheen', 'x', [[A - 30, -260], [A + 4, 520, 'softInOut']]);
M.kf('#sleep', 'opacity', [[0, .25], [30, .95, 'softInOut'], [60, .25, 'softInOut'], [90, .95, 'softInOut'], [120, .25, 'softInOut'], [S1_END, .25, 'softInOut']]);
[0, 1, 2].forEach(n => { const el = '#z' + n, fr = A - 26 + n * 6, S = .7 + n * .18, off = A + 10;
  M.show(el, fr, off);
  M.kf(el, 'opacity', [[fr, 0], [fr + 5, .95, 'glide'], [off - 5, .95], [off, 0, 'gentleIn']]);
  M.kf(el, 'y', [[fr, 16], [off, -18, 'cruise']]); M.kf(el, 'scale', [[fr, S * .8], [off, S, 'cruise']]); });

/* ---------- And somewhere out there, my AI agent is hard at work. ---------- */
say('#capC', 'somewhere out there', { out: AI - 4, to: { y: -60, opacity: 0 } });
say('#capB', 'my ai agent is hard at work', { out: CL - 6 });
const TAPS = []; for (let fr = AI - 6; fr < h; fr += 4 + ((fr * 5) % 4)) TAPS.push(fr);
const bob = [[AI - 8, 0]]; TAPS.forEach(fr => bob.push([fr, 0], [fr + 1, 4, 'cruise'], [fr + 3, 0, 'glide']));
M.kf('#blob', 'y', bob);
M.kf('#blob', 'rotation', [[AI, -1.5], [e, 1.5, 'softInOut'], [f, -1.2, 'softInOut'], [g, 2, 'softInOut'], [h, 0, 'softInOut']]);
const flick = [[AI - 10, .55]]; for (let fr = AI, k = 0; fr < i_; fr += 5 + (k % 3) * 3, k++) flick.push([fr, k % 2 ? .5 : .95, 'cruise']);
M.kf('#faceglow', 'opacity', flick);
M.kf('#blob .eye', 'scaleY', [[AI + 26, 1], [AI + 27, .1], [AI + 29, .1], [AI + 30, 1], [f + 30, 1], [f + 31, .1], [f + 33, .1], [f + 34, 1]]);
M.kf('#blob .eye', 'x', [[e - 4, 0], [e + 6, 5, 'glide'], [f - 6, 5], [f + 2, 0, 'glide'], [f + 12, 7, 'glide'], [g - 12, 7], [g - 2, 0, 'glide']]);   // it watches my passwords arrive, then my cursor
M.kf('#blob .eye', 'y', [[AI, 5], [e - 4, 5], [e + 6, -2, 'glide'], [f - 6, -2], [f + 2, 5, 'glide'], [f + 12, 1, 'glide'], [g - 12, 1], [g - 2, 5, 'glide']]);
M.kf('#led0', 'opacity', [[0, 1], [AI + 12, 1], [AI + 12, .2], [AI + 18, .2], [AI + 18, 1], [e + 20, 1], [e + 20, .2], [e + 28, .2], [e + 28, 1], [g, 1], [g, .2], [g + 6, .2], [g + 6, 1]]);
M.kf('#led1', 'opacity', [[0, .2], [AI + 24, .2], [AI + 24, 1], [e + 4, 1], [e + 4, .2], [f + 10, .2], [f + 10, 1], [f + 24, 1], [f + 24, .2]]);
M.kf('#led2', 'opacity', [[0, 1], [e - 10, 1], [e - 10, .2], [e + 8, .2], [e + 8, 1], [f + 30, 1], [f + 30, .2], [g - 6, .2], [g - 6, 1]]);
M.kf('#cloudFront', 'x', [[AI - 10, -10], [S1_END + 40, 16, 'cruise']]); M.kf('#cloudBack', 'x', [[AI - 10, 8], [S1_END + 40, -8, 'cruise']]);
TAPS.filter(fr => fr > AI && fr < g).forEach(fr => sfx(fr + 1, 'tick: key'));

/* ---------- In someone else's cloud. ---------- */
say('#capD', "in someone else's cloud", { out: e - 8, to: { y: 60, opacity: 0 } });

/* ---------- Holding my passwords. ---------- */
say('#capE', 'holding my passwords', { out: f - 7, to: { y: 60, opacity: 0 } });
[ { el: '#chip0', from: [1840, 1230], hover: [1488, 600], slot: [1155, 530], rot: -7 },
  { el: '#chip1', from: [1960, 1290], hover: [1532, 696], slot: [1155, 566], rot: 5 },
  { el: '#chip2', from: [1800, 1330], hover: [1476, 792], slot: [1155, 602], rot: -4 } ].forEach((k, n) => {
  const a = e - 10 + n * 4, dock = e + 14 + n * 5;            // from below (my desk), a short hover you can read, then into a slot
  M.show(k.el, a, dock + 6);
  M.kf(k.el, 'x', [[a, k.from[0]], [a + 12, k.hover[0], 'whip'], [dock, k.hover[0] - 8, 'cruise'], [dock + 6, k.slot[0], 'accelExit']]);
  M.kf(k.el, 'y', [[a, k.from[1]], [a + 12, k.hover[1], 'whip'], [dock, k.hover[1] - 4, 'cruise'], [dock + 6, k.slot[1], 'accelExit']]);
  M.kf(k.el, 'rotation', [[a, k.rot * 2.4], [a + 12, k.rot, 'whip'], [dock, k.rot * .6, 'cruise'], [dock + 6, 0, 'accelExit']]);
  M.kf(k.el, 'scale', [[a, 1], [dock, 1], [dock + 6, .2, 'accelExit']]);
  M.show('#pip' + n, dock + 6); sfx(dock + 5, 'pop: password taken'); });

/* ---------- Running on a model I don't control.  (I try the selector twice; it is locked) ---------- */
say('#capF', "on a model i don't control", { out: g - 9, to: { x: 120, opacity: 0 } });
M.cursor('#cursor', { keys: [[f + 2, 2090, 1260, 4, -24], [f + 13, 766, 520, 1.6, 0], [g - 16, 770, 524, 1.6, 0], [g - 7, 2040, 1300, 2.6, 12]], ease: 'glide' });
M.hide('#cursor', g - 6);
[f + 16, f + 27].forEach(p => {
  M.press('#cursor', '#sel', { at: p, frames: 3, cursorDepth: .82, targetDepth: .95, cursorBase: 1.6, lag: 1, release: true });
  sfx(p + 1, 'switch: click'); sfx(p + 3, 'snap: locked'); });
const shake = (p, a) => [[p + 2, 0], [p + 4, -a, 'glide'], [p + 6, a * .85, 'glide'], [p + 8, -a * .5, 'glide'], [p + 10, 0, 'glide']];
M.kf('#sel', 'x', shake(f + 16, 9).concat(shake(f + 27, 10)));
M.kf('#lock', 'rotation', shake(f + 16, 16).concat(shake(f + 27, 18)));

/* ---------- And the bill?  (the paper answers, and pushes the question apart) ---------- */
land('#capG1', g - 2, { y: 56 }); land('#capG2', F('bill') - 2, { y: 56, scale: 1.18 }, 12);
M.kf('#capG1', 'x', [[h - 10, 0], [h, -1100, 'accelExit']]); M.hide('#capG1', h);
M.kf('#capG2', 'x', [[h - 10, 0], [h, 1100, 'accelExit']]); M.hide('#capG2', h);

/* ---------- Two hundred dollars. Every. Single. Month.  (one month prints on each word, then it runs away) ---------- */
const wEv = F('every single month'), wMo = FE('every single month');
const PRINTS = [[h - 9, h + 2], [wEv - 2, wEv + 6], [F('single') - 2, F('single') + 6], [F('month') - 2, F('month') + 6]];
for (let fr = wMo + 4, n = 0, step = 7; n < 7; n++) { PRINTS.push([fr, fr + Math.max(2, step - 3)]); fr += step; step = Math.max(4, step - 1); }
const feed = [[0, -2200]]; PRINTS.forEach(([a, b], n) => feed.push([a, -2200 + n * 200], [b, -2200 + (n + 1) * 200, n ? 'cruise' : 'glide']));
M.kf('#strip', 'y', feed);
PRINTS.forEach(([a], n) => sfx(a + 1, n ? 'tick: another month' : 'tick: printing'));
sfx(h - 5, 'tick: printing'); sfx(h - 1, 'tick: printing'); sfx(h + 2, 'snap: the bill');
say('#capH', 'every single month', { out: S1_END + 20, to: { x: 100, opacity: 0 } });
M.mark(S1_END, 'cut', 'end of scene 1');

window.__S1_END = S1_END / FPS;
