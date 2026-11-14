/* Loopmates film. Every frame is a pure function of time: authored through Motion calls only (no timers, no Math.random, no CSS animations).
   The picture is cut to the voice: every cue below is looked up in the voice-over's word timings (audio/vo/words.js),
   so a new take re-times the whole film without touching these numbers. */
const FPS = 30, LEAD = 0.4;                                   // the voice starts 0.4 s into the film
const norm = s => s.toLowerCase().replace(/[^a-z0-9']/g, '');
const W = window.VOW.map(w => ({ w: norm(w.word), f: Math.round((w.start + LEAD) * FPS), e: Math.round((w.end + LEAD) * FPS) }));
const idx = (phrase, k = 0) => {
  const p = phrase.split(/\s+/).map(norm); let n = 0;
  for (let i = 0; i + p.length <= W.length; i++) if (p.every((s, j) => W[i + j].w === s) && n++ === k) return i;
  throw new Error('cue not found in the voice-over: ' + phrase);
};
const F = (phrase, k) => W[idx(phrase, k)].f;                 // frame on which the phrase starts
const END = W[W.length - 1].e;
const DUR = Math.ceil((END + 48) / FPS);                      // a short hold after the last word

const M = Motion.film({ fps: FPS, duration: DUR, width: 1920, height: 1080, clock: 'smooth' });
const $ = s => document.querySelector(s);
const rnd = (() => { let a = 20261112; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
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
const COL = { browser: '#6FCF3A', byte: '#7C5CFF', chef: '#F59A3C', code: '#3D5BF0', data: '#7C5CFF', flow: '#3FD8A0', halo: '#E3C9F2', luna: '#A56BDB', mimo: '#F27AA8', ops: '#8B5CF6',
  orbit: '#9DB7E8', planner: '#E3D3C1', recall: '#2EC4D6', research: '#E8382F', scout: '#B07A45', spark: '#F2632A', tune: '#22C7C0', writer: '#F3BB3C', zen: '#7EA6F5' };
const mate = (key, x, y, size, id) => `<div class="mate"${id ? ` id="${id}"` : ''} style="left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;--c:${COL[key]}"><i></i><img src="assets/m/${key}.png"></div>`;

/* ======================= cues ======================= */
const c = F('not on my'), d = F('somewhere'), e = F('with my passwords'), f = F('on a model'), g = F('and the bill'), h = F('two hundred'), i_ = F('every single');
const and = F('and my ai'), s2 = F("i didn't want"), sb = F('i wanted a'), so = F('so we built'), mine = F('mine'), each = F('each one');
const CUT = {
  logo: so + 12, team: F('nineteen') - 2, desk2: F('one computer') - 2, row: each - 2, say: F('i say') - 2, pipe: F('planner') - 2, tests: F('tests green') - 2,
  loop: F('nice') + 13, halo: F('something') - 2, mem: F('what did') - 2, short: F('shorter') - 2, home: F("it's 11") - 2, models: F('my models') - 2,
  keys: F('my keys') - 2, machine: F('my machine') - 2, morning: F('by morning') - 2, end: F('loopmates', 1) - 4,
};

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
    for (let fr = ph; fr < CUT.row; fr += per) k.push([fr, o, 'softInOut'], [fr + per / 2, Math.min(1, o + .45), 'softInOut']);
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

  // marks
  $('#lonMark').innerHTML = markSVG('mk1'); $('#lmMark').innerHTML = markSVG('mk2'); $('#mMark').innerHTML = markSVG('mk3'); $('#endMark').innerHTML = markSVG('mk4');

  // the team photo: all 19 real Mates. It is built twice: full frame, and small on my laptop's screen.
  const ROWS = [
    { keys: ['byte', 'data', 'scout', 'zen', 'recall', 'browser', 'flow'], y: 420, size: 240, x0: 318, dx: 214 },
    { keys: ['luna', 'halo', 'orbit', 'ops', 'chef', 'tune', 'spark'], y: 600, size: 292, x0: 258, dx: 234 },
    { keys: ['writer', 'research', 'mimo', 'code', 'planner'], y: 818, size: 384, x0: 360, dx: 300 },
  ];
  const team = pre => ROWS.map(r => r.keys.map((k, j) => mate(k, r.x0 + j * r.dx, r.y, r.size, pre ? pre + k : '')).join('')).join('');
  $('#team').innerHTML = team('tm_');
  $('#lteam').innerHTML = team('') + '<div class="cap" style="top:56px;font-size:124px;line-height:140px">19 Mates.</div>';

  // five of them, close up: a name, a voice, a skill
  const FIVE = [['mimo', 'Mimo', 'Leader and second brain'], ['research', 'Research', 'Finds and cites sources'], ['code', 'Code', 'Writes and runs code'], ['planner', 'Planner', 'Splits the work'], ['writer', 'Writer', 'Scripts, reports, copy']];
  $('#row').innerHTML = FIVE.map(([k, name, skill], m) => {
    const x = 240 + m * 360;
    const bars = Array.from({ length: 9 }, (_, j) => `<i class="wv wv${m}" style="left:${x - 51 + j * 12}px;top:768px;width:6px;height:46px;border-radius:3px;background:${COL[k]};transform-origin:50% 50%"></i>`).join('');
    return mate(k, x, 452, 372, 'rw_' + m) + `<div class="h rname" id="rn_${m}" style="left:${x - 180}px;top:662px;width:360px;text-align:center;font-size:66px;line-height:78px">${name}</div>` + bars +
      `<div class="t rskill" id="rs_${m}" style="left:${x - 180}px;top:842px;width:360px;text-align:center;font-size:30px;line-height:40px;color:var(--ink)">${skill}</div>`;
  }).join('');

  // the run: four stations on one line
  const ST = [
    ['planner', 'Planner\nbreaks it down.'], ['research', 'Research\nfinds the way.'], ['code', 'Code\nmakes the changes.'], ['ops', 'Ops\nchecks the build.'],
  ];
  const props = [
    ['research', 'edit', 'check', 'report'].map((t, j) => `<div class="card pr0" data-ui style="left:${900 + j * 176}px;top:600px;width:156px;height:132px;border-radius:26px"><div class="h lime" style="left:0;top:14px;width:156px;text-align:center;font-size:58px;line-height:64px">${j + 1}</div><div class="t" style="left:0;top:84px;width:156px;text-align:center;font-size:25px;line-height:32px">${t}</div></div>`).join(''),
    ['MDN: prefers-color-scheme', 'CSS custom properties', 'Next.js themes guide'].map((t, j) => `<div class="pill pr1" data-ui style="left:900px;top:${590 + j * 92}px;width:${[590, 500, 480][j]}px;height:76px"><div class="t" style="left:30px;top:19px;font-size:30px;line-height:38px;color:var(--ink)">↗  ${t}</div></div>`).join(''),
    `<div class="card" data-ui style="left:900px;top:590px;width:860px;height:230px;border-radius:26px">` + ["+ html[data-theme='dark'] { --bg: #0b0a0d; }", '+ const [theme, setTheme] = useTheme();', '  6 files changed'].map((t, j) => `<div class="mono pr2" style="left:40px;top:${34 + j * 58}px;font-size:31px;line-height:42px;color:${j < 2 ? 'var(--acc)' : 'var(--soft)'}">${t}</div>`).join('') + '</div>',
    ['build', 'lint', 'second opinion'].map((t, j) => `<div class="pill" data-ui style="left:${[900, 1130, 1340][j]}px;top:600px;width:${[210, 190, 400][j]}px;height:88px"><div class="tick" style="left:20px;top:18px;width:52px;height:52px"><b class="pr3"></b></div><div class="t" style="left:90px;top:22px;font-size:34px;line-height:44px;color:var(--ink)">${t}</div></div>`).join(''),
  ];
  $('#stations').innerHTML = ST.map(([k, txt], n) => `<div id="st_${n}" style="left:${n * 1920}px;top:0;width:1920px;height:1080px">` + mate(k, 560, 500, 520, 'sm_' + n) +
    `<div class="cap l" id="sc_${n}" style="left:900px;top:300px;width:1000px;font-size:104px;line-height:116px">${txt}</div>` + props[n] + '</div>').join('');

  // tests
  $('#testRows').innerHTML = ['settings.test.ts', 'theme.test.ts', 'toggle.test.ts', 'storage.test.ts', 'a11y.test.ts'].map((t, j) =>
    `<div class="tick" style="left:56px;top:${52 + j * 96}px;width:56px;height:56px"><b class="tk"></b></div><div class="mono" style="left:142px;top:${58 + j * 96}px;font-size:36px;line-height:46px;color:var(--ink)">${t}</div><div class="t tp" style="right:60px;top:${60 + j * 96}px;font-size:32px;line-height:42px;color:var(--acc)">passed</div>`).join('');

  // the loop: four Mates on the ring, turning by themselves
  $('#orbit').innerHTML = ['planner', 'research', 'code', 'ops'].map((k, j) => { const a = j * Math.PI / 2 - Math.PI / 4; return mate(k, Math.cos(a) * 360, Math.sin(a) * 360, 214, 'ob_' + j); }).join('');

  // memory: a small web of linked notes
  const NODES = [[1010, 360, 9], [1180, 300, 12], [1390, 350, 9], [1600, 300, 11], [1740, 420, 9], [960, 600, 14], [1500, 420, 8], [1760, 620, 10], [1300, 240, 8], [1640, 880, 9], [1120, 860, 10], [820, 420, 9], [1400, 900, 8]];
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [2, 6], [6, 3], [4, 7], [1, 8], [8, 2], [7, 9], [5, 10], [11, 0], [11, 5], [10, 12], [12, 9]];
  $('#graph').innerHTML = EDGES.map(([a, b]) => `<line class="ge" x1="${NODES[a][0]}" y1="${NODES[a][1]}" x2="${NODES[b][0]}" y2="${NODES[b][1]}" stroke="rgba(244,241,234,.16)" stroke-width="2.5"/>`).join('') +
    NODES.map(([x, y, r], n) => `<circle class="gn" id="gn_${n}" cx="${x}" cy="${y}" r="${r}" fill="rgba(244,241,234,.38)"/>`).join('');

  $('#repText').textContent = 'Dark mode is now on the settings page. A toggle switches themes and the choice is saved for next time. Every colour now comes from a theme token, so a new theme is a small change. Six files were edited and the full test suite passes. One follow-up is left: the charts page still uses fixed colours, and I have opened an issue for it. The pull request links each change to the step that asked for it.';

  // models
  const MODELS = ['Gemini', 'NVIDIA NIM', 'Groq', 'Cerebras', 'OpenRouter'], MW = [270, 350, 220, 300, 360];
  let mx = (1920 - (MW.reduce((a, b) => a + b, 0) + 4 * 28)) / 2;
  $('#models').innerHTML = MODELS.map((t, j) => { const x = mx; mx += MW[j] + 28;
    return `<div class="pill" data-ui style="left:${x}px;top:560px;width:${MW[j]}px;height:118px"><div class="h" style="left:0;top:30px;width:${MW[j]}px;text-align:center;font-size:50px;line-height:58px;font-weight:600">${t}</div></div>` +
      `<div class="pill mo" id="mo_${j}" data-ui style="left:${x}px;top:560px;width:${MW[j]}px;height:118px;background:var(--acc);border-color:var(--acc)"><div class="h" style="left:0;top:30px;width:${MW[j]}px;text-align:center;font-size:50px;line-height:58px;font-weight:600;color:var(--bg)">${t}</div></div>`; }).join('');

  // phone: a live waveform once the call is answered
  $('#wave').innerHTML = Array.from({ length: 14 }, (_, j) => `<i class="pw" style="left:${j * 17 + 4}px;top:0;width:8px;height:44px;border-radius:4px;background:#F27AA8;transform-origin:50% 50%"></i>`).join('');

  // the morning summary
  $('#sumRows').innerHTML = ['Dark mode merged, tests green', 'Garage closed at 11:02 pm', 'Report cut to half its length'].map((t, j) =>
    `<div class="tick" style="left:54px;top:${150 + j * 102}px;width:58px;height:58px"><b class="sk"></b></div><div class="t" style="left:138px;top:${156 + j * 102}px;font-size:40px;line-height:48px;color:var(--ink)">${t}</div>`).join('');
})();

/* ======================= the camera of the night world: (frame, look-at x, look-at y, zoom, ease of the move arriving here) ======================= */
const CAM = [
  [0, 520, 2985, 2.05],
  [and - 4, 526, 2983, 1.96, 'cruise'],            // the clock
  [and + 16, 965, 2890, 1.25, 'glide'],            // pull back: the whole desk
  [c - 4, 990, 2887, 1.33, 'cruise'],
  [c + 12, 1400, 2885, 1.62, 'softLand'],          // my laptop, asleep
  [d - 7, 1408, 2876, 1.72, 'cruise'],
  [d + 13, 960, 672, 1.18, 'whip'],                // straight up to the cloud
  [e - 8, 960, 656, 1.29, 'cruise'],
  [e + 4, 1050, 680, 1.30, 'glide'],               // room on the right for what comes up from below
  [f - 6, 1060, 685, 1.36, 'cruise'],
  [f + 8, 1262, 690, 2.50, 'softLand'],            // the one control
  [g - 10, 1272, 693, 2.68, 'cruise'],
  [g + 6, 960, 880, 1.50, 'glide'],                // under the box
  [h - 9, 960, 885, 1.56, 'cruise'],
  [h + 9, 960, 902, 2.30, 'softLand'],             // the figure
  [i_ - 6, 960, 908, 2.42, 'cruise'],
  [i_ + 16, 1262, 1150, 1.00, 'softLand'],         // step back: it keeps coming
  [s2 + 26, 1180, 2880, 1.22, 'softInOut'],        // fall with the bill, back down to my desk
  [sb - 6, 1186, 2882, 1.25, 'cruise'],
  [sb + 12, 1380, 2900, 1.80, 'softLand'],         // my own laptop
  [so - 4, 1380, 2906, 1.98, 'cruise'],
  [CUT.logo, 1378, 2924, 9.40, 'accelExit'],       // dive into its screen
  [CUT.desk2, 1378, 2924, 9.40],
  [CUT.desk2, 1378, 2924, 4.824],                  // match cut: the team photo is exactly the laptop's screen
  [CUT.desk2 + 16, 1380, 2905, 2.10, 'softLand'],  // ...and it is one computer
  [mine - 9, 1380, 2903, 2.18, 'cruise'],
  [mine - 4, 1380, 2906, 2.48, 'snapSettle'],
  [CUT.row, 1380, 2907, 2.54, 'cruise'],
];
['--cx', '--cy', '--z'].forEach((p, n) => M.kf('#main', p, CAM.map(k => [k[0], k[n + 1], k[4]])));

/* ---------- 2:00 ---------- */
M.kf('#dOld', 'y', [[5, 0], [11, -92, 'gentleIn']]); M.kf('#dOld', 'opacity', [[5, 1], [11, 0, 'gentleIn']]); M.hide('#dOld', 11);
land('#dNew', 8, { y: 96 }, 9);
M.kf('#clockglow', 'opacity', [[0, .55], [8, .55], [12, 1, 'softLand'], [60, .85, 'cruise'], [190, .9, 'cruise']]);
sfx(9, 'tick: the minute flips');

/* ---------- My AI agent is hard at work.  (you hear typing; nothing here is typing) ---------- */
say('#capB', 'my ai agent is hard at work', { out: c - 7 });
for (let fr = and + 8; fr < c - 6; fr += 4 + ((fr * 7) % 3)) sfx(fr, 'tick: key, off screen');

/* ---------- Not on my computer. ---------- */
say('#capC', 'not on my computer', { out: d - 9, to: { y: 60, opacity: 0 } });
M.kf('#lsheen', 'x', [[c - 8, -260], [d - 2, 520, 'softInOut']]);
M.kf('#sleep', 'opacity', [[0, .25], [30, .95, 'softInOut'], [60, .25, 'softInOut'], [90, .95, 'softInOut'], [120, .25, 'softInOut'], [150, .95, 'softInOut'], [sb, .25, 'softInOut']]);
[0, 1, 2].forEach(n => { const el = '#z' + n, fr = c + 2 + n * 6, S = .7 + n * .18;
  M.show(el, fr, d - 3);
  M.kf(el, 'opacity', [[fr, 0], [fr + 5, .95, 'glide'], [d - 8, .95], [d - 3, 0, 'gentleIn']]);
  M.kf(el, 'y', [[fr, 16], [d - 3, -18, 'cruise']]); M.kf(el, 'scale', [[fr, S * .8], [d - 3, S, 'cruise']]); });

/* ---------- Somewhere in the cloud. ---------- */
say('#capD', 'somewhere in the cloud', { out: e - 8, to: { y: 60, opacity: 0 } });
const TAPS = []; for (let fr = d + 4; fr < h; fr += 4 + ((fr * 5) % 4)) TAPS.push(fr);
const bob = [[d, 0]]; TAPS.forEach(fr => bob.push([fr, 0], [fr + 1, 4, 'cruise'], [fr + 3, 0, 'glide']));
M.kf('#blob', 'y', bob);
M.kf('#blob', 'rotation', [[d, -1.5], [e, 1.5, 'softInOut'], [f, -1.2, 'softInOut'], [g, 2, 'softInOut'], [h, 0, 'softInOut']]);
const flick = [[d - 10, .55]]; for (let fr = d, k = 0; fr < i_; fr += 5 + (k % 3) * 3, k++) flick.push([fr, k % 2 ? .5 : .95, 'cruise']);
M.kf('#faceglow', 'opacity', flick);
M.kf('#blob .eye', 'scaleY', [[d + 26, 1], [d + 27, .1], [d + 29, .1], [d + 30, 1], [f + 30, 1], [f + 31, .1], [f + 33, .1], [f + 34, 1]]);
M.kf('#blob .eye', 'x', [[e - 4, 0], [e + 6, 5, 'glide'], [f - 6, 5], [f + 2, 0, 'glide'], [f + 12, 7, 'glide'], [g - 12, 7], [g - 2, 0, 'glide']]);   // it watches my passwords arrive, then my cursor
M.kf('#blob .eye', 'y', [[d, 5], [e - 4, 5], [e + 6, -2, 'glide'], [f - 6, -2], [f + 2, 5, 'glide'], [f + 12, 1, 'glide'], [g - 12, 1], [g - 2, 5, 'glide']]);
M.kf('#led0', 'opacity', [[0, 1], [d + 12, 1], [d + 12, .2], [d + 18, .2], [d + 18, 1], [e + 20, 1], [e + 20, .2], [e + 28, .2], [e + 28, 1], [g, 1], [g, .2], [g + 6, .2], [g + 6, 1]]);
M.kf('#led1', 'opacity', [[0, .2], [d + 24, .2], [d + 24, 1], [e + 4, 1], [e + 4, .2], [f + 10, .2], [f + 10, 1], [f + 24, 1], [f + 24, .2]]);
M.kf('#led2', 'opacity', [[0, 1], [e - 10, 1], [e - 10, .2], [e + 8, .2], [e + 8, 1], [f + 30, 1], [f + 30, .2], [g - 6, .2], [g - 6, 1]]);
M.kf('#cloudFront', 'x', [[d - 10, -10], [s2, 16, 'cruise']]); M.kf('#cloudBack', 'x', [[d - 10, 8], [s2, -8, 'cruise']]);
TAPS.filter(fr => fr > d + 12 && fr < g).forEach(fr => sfx(fr + 1, 'tick: key'));

/* ---------- With my passwords. ---------- */
say('#capE', 'with my passwords', { out: f - 7, to: { y: 60, opacity: 0 } });
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

/* ---------- On a model I don't control. ---------- */
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

/* ---------- Two hundred dollars. Every single month. ---------- */
const PRINTS = [[h - 9, h + 2]]; for (let fr = i_ - 5, n = 0, step = 8; n < 10; n++) { PRINTS.push([fr, fr + Math.max(2, step - 3)]); fr += step; step = Math.max(4, step - 1); }
const feed = [[0, -2200]]; PRINTS.forEach(([a, b], n) => feed.push([a, -2200 + n * 200], [b, -2200 + (n + 1) * 200, n ? 'cruise' : 'glide']));
M.kf('#strip', 'y', feed);
PRINTS.forEach(([a], n) => sfx(a + 1, n ? 'tick: another month' : 'tick: printing'));
sfx(h - 5, 'tick: printing'); sfx(h - 1, 'tick: printing'); sfx(h + 2, 'snap: the bill');
say('#capH', 'every single month', { out: s2 - 4, to: { x: 100, opacity: 0 } });

/* ---------- I didn't want another assistant.  (the bill is thrown out) ---------- */
say('#capI', "i didn't want another assistant", { out: sb - 6 });
const yank = F('assistant') + 3;
M.kf('#paperwrap', 'y', [[yank, 0], [yank + 13, 1900, 'accelExit']]); M.kf('#paperwrap', 'rotation', [[yank, 0], [yank + 13, 9, 'accelExit']]); M.hide('#paperwrap', yank + 13);
sfx(yank, 'snap: the bill goes');

/* ---------- I wanted a second brain.  (my own laptop wakes up: the first lime in the film) ---------- */
say('#capJ', 'i wanted a second brain', { out: so - 6 });
const wake = F('second brain') - 2;
M.show('#lon', wake); M.kf('#lon', 'opacity', [[wake, 0], [wake + 6, 1, 'glide']]);
M.kf('#lspill', 'opacity', [[0, 0], [wake, 0], [wake + 14, 1, 'glide'], [CUT.row, .9, 'cruise']]);
M.show('#lonMark', wake, CUT.desk2); land('#lonMark', wake, { scale: .5 }, 12, 'popOver'); M.show('#lteam', CUT.desk2);
sfx(wake, 'switch: my laptop wakes');

/* ======================= hard cuts, always on a word ======================= */
const order = ['logo', 'team', 'desk2', 'row', 'say', 'pipe', 'tests', 'loop', 'halo', 'mem', 'short', 'home', 'models', 'keys', 'machine', 'morning', 'end'];
const elOf = k => (k === 'desk2' ? '#stage1' : '#sh_' + k);
order.forEach((k, n) => M.cut(CUT[k], { hide: [n ? elOf(order[n - 1]) : '#stage1'], show: [elOf(k)], label: k }));

/* ---------- So, we built Loopmates!  (the screen's mark becomes the logo) ---------- */
M.kf('#lmMark', 'x', [[CUT.logo, 440], [CUT.logo + 14, 0, 'snapSettle']]); M.kf('#lmMark', 'scale', [[CUT.logo, 2.77], [CUT.logo + 14, 1, 'snapSettle']]);
M.kf('#lmWord', '--cr', [[CUT.logo + 4, 100], [CUT.logo + 16, 0, 'softLand']], { fmt: v => v + '%' }); M.kf('#lmWord', 'x', [[CUT.logo + 4, -70], [CUT.logo + 16, 0, 'softLand']]);
M.kf('#camLogo', 'scale', [[CUT.logo, 1], [CUT.team, 1.05, 'cruise']]);
sfx(F('loopmates') - 1, 'chime: Loopmates');

/* ---------- Nineteen Mates.  (all 19, one after another) ---------- */
['mimo', 'research', 'code', 'writer', 'planner', 'ops', 'orbit', 'chef', 'halo', 'tune', 'luna', 'spark', 'zen', 'scout', 'recall', 'data', 'browser', 'byte', 'flow'].forEach((k, n) => {
  const at = CUT.team + Math.round(n * 1.25);
  land('#tm_' + k, at, { y: 60, scale: .6 }, 9); if (n % 3 === 0) sfx(at + 1, 'pop: a Mate'); });
M.count('#n19', { at: CUT.team, from: 1, to: 19, frames: 24, round: true });
land('#capTeam', CUT.team, { y: 40 }, 9);

/* ---------- One computer. Mine. ---------- */
say('#capK', 'one computer', {}); M.hide('#capK', mine - 9);
land('#capMine', mine - 9, { scale: 1.6 }, 9, 'snapSettle');
sfx(mine - 8, 'pop: mine');

/* ---------- Each one a brain of its own, with a name, a voice, and a skill. ---------- */
say('#capRow', 'each one a brain of its own', {});
M.kf('#row', 'x', [[CUT.row, 26], [CUT.say, -26, 'cruise']]);
const nameAt = F('name') - 2, voiceAt = F('voice') - 2, skillAt = F('skill') - 2;
[0, 1, 2, 3, 4].forEach(m => {
  land('#rw_' + m, CUT.row + m * 2, { y: 70, scale: .86 }, 11);
  land('#rn_' + m, nameAt + m * 2, { y: 30 }, 9);
  land('#rs_' + m, skillAt + m * 2, { y: 24 }, 9);
  document.querySelectorAll('.wv' + m).forEach((b, j) => {
    const a = voiceAt + m * 2 + (j % 3), k = [[a, .12]];
    for (let fr = a, n = 0; fr < CUT.say; fr += 4, n++) k.push([fr + 4, .22 + .78 * Math.abs(Math.sin(j * 1.7 + n * .9 + m * 1.3)), 'softInOut']);
    M.show(b, a); M.kf(b, 'scaleY', k); }); });
sfx(nameAt, 'tick: a name'); sfx(voiceAt, 'tick: a voice'); sfx(skillAt, 'tick: a skill');

/* ---------- I say it once: "Add dark mode. Run the tests." ---------- */
say('#capSay', 'i say it once', {});
land('#sayBar', CUT.say, { y: 90, scale: .96 }, 12);
(() => {
  const T0 = F('add dark') - 2, wordsF = ['add', 'dark', 'mode', 'run', 'the', 'tests'], counts = [3, 8, 14, 18, 22, 29], i0 = idx('add dark');
  const ev = []; let shown = 0;
  wordsF.forEach((w, n) => { let fr = W[i0 + n].f - 2 - T0; while (shown < counts[n]) { shown++; ev.push([fr++, shown]); } });
  for (let n = 1; n < ev.length; n++) if (ev[n][0] <= ev[n - 1][0]) ev[n][0] = ev[n - 1][0] + 1;       // one letter per frame at most
  M.type('#sayText', { at: T0, events: ev, caret: '#sayCaret', caretGap: 8 });
  ev.filter((x, n) => n % 3 === 0).forEach(x => sfx(T0 + x[0], 'tick: typing'));
  const send = T0 + ev[ev.length - 1][0] + 4;
  M.kf('#saySend', 'scale', [[send, 1], [send + 2, .82, 'glide'], [send + 5, 1.05, 'glide']]); sfx(send + 1, 'switch: send');
})();
M.kf('#camSay', 'scale', [[CUT.say, 1], [CUT.pipe, 1.045, 'cruise']]);

/* ---------- Planner, Research, Code, Ops: the job moves down the line by itself ---------- */
(() => {
  const cue = [F('planner'), F('research'), F('code makes'), F('ops')];
  const px = [[CUT.pipe, 24]], bx = [[CUT.pipe, 300], [cue[0] + 6, 560, 'softLand']];
  cue.forEach((q, n) => { if (!n) return;
    px.push([q - 10, -(n - 1) * 1920 - 22, 'cruise'], [q + 1, -n * 1920 + 22, 'whip']);
    bx.push([q - 10, (n - 1) * 1920 + 560], [q + 2, n * 1920 + 560, 'whip']); sfx(q - 2, 'pop: next Mate'); });
  px.push([CUT.tests, -3 * 1920 - 26, 'cruise']);
  M.kf('#pipe', 'x', px); M.kf('#bead', 'x', bx);
  const phr = ['planner breaks it down', 'research finds the way', 'code makes the changes', 'ops checks the build'];
  phr.forEach((p, n) => { say('#sc_' + n, p, {}); land('#sm_' + n, n ? cue[n] - 7 : CUT.pipe, { y: 50, scale: .84 }, 12); });
  document.querySelectorAll('.pr0').forEach((el, j) => { land(el, F('breaks') + 4 + j * 3, { y: 40, scale: .7 }, 9); sfx(F('breaks') + 5 + j * 3, 'tick: step'); });
  document.querySelectorAll('.pr1').forEach((el, j) => { land(el, F('finds') + 2 + j * 4, { x: -60 }, 9); sfx(F('finds') + 3 + j * 4, 'tick: source'); });
  document.querySelectorAll('.pr2').forEach((el, j) => { land(el, F('makes') + 2 + j * 5, { x: -30 }, 7); sfx(F('makes') + 3 + j * 5, 'tick: line'); });
  document.querySelectorAll('.pr3').forEach((el, j) => { land(el, F('checks') + 2 + j * 5, { scale: .3 }, 8, 'popOver'); sfx(F('checks') + 3 + j * 5, 'tick: check'); });
})();

/* ---------- Tests green. Nice. ---------- */
say('#capTests', 'tests green', {});
land('#testCard', CUT.tests, { y: 70, scale: .95 }, 11);
document.querySelectorAll('.tk').forEach((el, j) => { const a = CUT.tests + 5 + j * 3; land(el, a, { scale: .3 }, 7, 'popOver'); M.show(document.querySelectorAll('.tp')[j], a); sfx(a, 'tick: passed'); });
sfx(F('green') + 2, 'success: tests green');
const nice = F('nice') - 4;
M.exit('#testCard', { at: nice - 2, frames: 5, ease: 'accelExit', to: { scale: .86, y: 60, opacity: 0 }, hide: true }); M.exit('#capTests', { at: nice - 2, frames: 5, ease: 'accelExit', to: { y: -50, opacity: 0 }, hide: true });
land('#capNice', nice, { scale: 1.5 }, 9, 'snapSettle'); M.kf('#capNice', 'rotation', [[nice, -3], [nice + 9, 0, 'snapSettle']]);
sfx(nice + 1, 'pop: nice');

/* ---------- I wasn't even in the loop.  (the ring turns by itself; my cursor is asleep) ---------- */
say('#capLoop', "i wasn't even in the loop", {});
M.kf('#orbit', 'rotation', [[CUT.loop, -24], [CUT.halo, 34, 'cruise']]);
[0, 1, 2, 3].forEach(j => M.kf('#ob_' + j, 'rotation', [[CUT.loop, 24], [CUT.halo, -34, 'cruise']]));
M.kf('#orbBead', 'rotation', [[CUT.loop, 30], [CUT.halo, 260, 'cruise']]);
['#lz0', '#lz1'].forEach((el, n) => { const a = CUT.loop + 4 + n * 9;
  M.show(el, a); M.kf(el, 'opacity', [[a, 0], [a + 6, .95, 'glide'], [a + 26, .95], [a + 34, 0, 'gentleIn']]); M.kf(el, 'y', [[a, 14], [a + 34, -22, 'cruise']]); });
M.kf('#camLoop', 'scale', [[CUT.loop, 1.06], [CUT.halo, 1, 'glide']]);

/* ---------- Something risky? Halo asks first. I approve. Done. ---------- */
const haloIn = F('halo asks') - 4;
say('#capRisk', 'something risky', { out: haloIn - 2, outFrames: 4, to: { scale: 1.2, opacity: 0 } });
say('#capHalo', 'halo asks first', {});
land('#haloMate', haloIn, { x: -260, scale: .86 }, 12); land('#okCard', haloIn + 2, { x: 240, y: 20 }, 12);
sfx(haloIn + 2, 'pop: Halo');
const ok = F('approve') - 1;
M.cursor('#curHalo', { keys: [[ok - 20, 2060, 1220, 3.4, -20], [ok - 4, 1090, 716, 1.5, 0], [ok + 10, 1094, 720, 1.5, 0], [ok + 20, 1500, 1260, 2.2, 10]], ease: 'glide' }); M.hide('#curHalo', ok + 21);
M.press('#curHalo', '#okYes', { at: ok, frames: 3, cursorDepth: .82, targetDepth: .9, cursorBase: 1.5, lag: 1, release: true }); sfx(ok + 1, 'switch: approve');
M.kf('#okNo', 'opacity', [[ok + 2, 1], [ok + 8, .28, 'glide']]);
const done = F('done') - 2;
land('#okDone', done, { scale: 1.9 }, 9, 'snapSettle'); sfx(done + 1, 'success: done');
M.kf('#camHalo', 'scale', [[haloIn, 1], [CUT.mem, 1.04, 'cruise']]);

/* ---------- What did I decide last week? Mimo remembers. ---------- */
land('#askBubble', CUT.mem, { scale: .6, y: 30 }, 10); sfx(CUT.mem + 1, 'pop: question');
land('#memMate', CUT.mem, { y: 70, scale: .9 }, 12);
const rem = F('mimo remembers') - 4;
land('#memCard', rem, { x: 160, scale: .94 }, 12); say('#capMem', 'mimo remembers', {});
land('#hit', rem, { scale: .2 }, 10, 'popOver'); M.kf('#hit', 'scale', [[rem + 10, 1], [CUT.short, 1.5, 'cruise']]);
M.kf('#graph', 'opacity', [[CUT.mem, .35], [rem + 10, 1, 'glide']]);
sfx(rem + 2, 'chime: remembered');
M.kf('#camMem', 'scale', [[CUT.mem, 1], [CUT.short, 1.04, 'cruise']]);

/* ---------- "Shorter, please." Said once, remembered. ---------- */
land('#shortBubble', CUT.short, { scale: .6, y: 30 }, 10); sfx(CUT.short + 1, 'pop: shorter please');
const cutDown = F('please') + 5;
M.kf('#repCard', 'height', [[CUT.short, 620], [cutDown, 620], [cutDown + 13, 300, 'softLand']], { fmt: v => v + 'px' }); sfx(cutDown + 2, 'snap: shorter');
say('#capShort', 'said once remembered', {});
land('#journal', F('remembered') - 4, { y: 50, scale: .9 }, 11); sfx(F('remembered') - 2, 'tick: journal');
M.kf('#camShort', 'scale', [[CUT.short, 1], [CUT.home, 1.04, 'cruise']]);

/* ---------- It's 11 p.m. The garage is still open. Mimo calls my phone. "Close it?" Yes. Lights off, too. ---------- */
land('#hClock', CUT.home, { scale: 1.3 }, 12, 'snapSettle'); sfx(CUT.home + 1, 'tick: 11 pm');
land('#haCard', F('and the garage') - 4, { y: 70 }, 12);
const ring = F('mimo calls') - 6;
say('#capGarage', 'the garage is still open', { out: ring - 2 });
M.kf('#gOpen', 'scale', [[F('open') - 2, 1], [F('open') + 2, 1.28, 'glide'], [F('open') + 10, 1, 'glide']]);
land('#phone', ring, { y: 1000 }, 14);
['#ringA', '#ringB'].forEach((el, n) => { const k = [], o = [];
  for (let fr = ring + 4 + n * 12; fr < ring + 46; fr += 24) { k.push([fr, 1], [fr + 23, 1.75, 'glide']); o.push([fr, .7], [fr + 23, 0, 'glide']); }
  M.kf(el, 'scale', k); M.kf(el, 'opacity', o); });
M.kf('#phone', 'x', [[ring + 14, 0], [ring + 16, -7], [ring + 18, 7], [ring + 20, -6], [ring + 22, 6], [ring + 24, -4], [ring + 26, 0]]);
sfx(ring + 14, 'chime: phone rings');
const answer = F('close it') - 10;
M.kf('#callYes', 'scale', [[answer - 3, 1], [answer - 1, .82, 'glide'], [answer + 2, 1, 'glide']]); sfx(answer - 1, 'switch: answer');
M.hide('#callYes', answer + 2); M.hide('#callNo', answer + 2); M.hide('#callTitle', answer + 2); M.show('#callLive', answer + 2); M.hide('#ringA', answer + 2); M.hide('#ringB', answer + 2);
document.querySelectorAll('.pw').forEach((b, j) => { const k = [[answer + 2, .1]];
  for (let fr = answer + 2, n = 0; fr < CUT.models; fr += 4, n++) k.push([fr + 4, .14 + .86 * Math.abs(Math.sin(j * 1.3 + n * 1.1)), 'softInOut']);
  M.show(b, answer + 2); M.kf(b, 'scaleY', k); });
land('#bClose', F('close it') - 2, { scale: .6, y: 20 }, 9); sfx(F('close it') - 1, 'pop: close it');
land('#bYes', F('yes') - 2, { scale: .6, y: 20 }, 9); sfx(F('yes') - 1, 'pop: yes');
land('#bLights', F('lights off') - 2, { scale: .6, y: 20 }, 9); sfx(F('lights off') - 1, 'pop: lights off');
const shut = F('yes') + 8, dark = F('too') + 2;
M.hide('#gOpen', shut); land('#gClosed', shut, { scale: 1.7 }, 9, 'snapSettle'); sfx(shut + 1, 'switch: garage closed');
M.hide('#lOn', dark); land('#lOff', dark, { scale: 1.5 }, 8, 'snapSettle'); sfx(dark + 1, 'switch: lights off');
M.kf('#lamp', 'opacity', [[CUT.home, 1], [dark, 1], [dark + 6, 0, 'glide']]);
M.show('#dim', dark); M.kf('#dim', 'opacity', [[dark, 0], [dark + 8, 1, 'glide']]);
M.kf('#camHome', 'scale', [[CUT.home, 1], [CUT.models, 1.035, 'cruise']]);

/* ---------- My models. My keys. My machine. ---------- */
land('#capModels', CUT.models, { scale: 1.3 }, 8, 'snapSettle'); sfx(CUT.models + 1, 'pop: my models');
[0, 1, 2, 3, 4].forEach(j => { const a = CUT.models + 3 + j * 4; M.show('#mo_' + j, a, j < 4 ? a + 4 : undefined); sfx(a, 'tick: model'); });
land('#capKeys', CUT.keys, { scale: 1.3 }, 8, 'snapSettle'); sfx(CUT.keys + 1, 'pop: my keys');
[0, 1, 2].forEach(j => land('#kchip' + j, CUT.keys + 2 + j * 3, { y: -620, rotation: [-9, 7, -5][j] }, 9));
M.kf('#vshackle', 'y', [[CUT.keys, -5.5], [CUT.keys + 13, -5.5], [CUT.keys + 16, 0, 'glide']]); M.kf('#vlock', 'scale', [[CUT.keys + 15, 1], [CUT.keys + 17, 1.18, 'glide'], [CUT.keys + 22, 1, 'glide']]); sfx(CUT.keys + 16, 'snap: locked at home');
land('#capMachine', CUT.machine, { scale: 1.3 }, 8, 'snapSettle'); sfx(CUT.machine + 1, 'pop: my machine');
M.kf('#camMachine', 'scale', [[CUT.machine, 1.12], [CUT.machine + 12, 1, 'softLand'], [CUT.morning, 1.03, 'cruise']]); $('#camMachine').style.transformOrigin = '960px 680px';

/* ---------- By morning, the work is done, and the summary's waiting. ---------- */
say('#capMorning', 'by morning the work is done', {});
M.kf('#sun', 'y', [[CUT.morning, 150], [CUT.end, -70, 'glide']]);
land('#lunaMate', CUT.morning, { y: 80, scale: .9 }, 14);
const sum = F("summary's") - 10;
land('#sumCard', sum, { y: 90, scale: .95 }, 12);
document.querySelectorAll('.sk').forEach((el, j) => { const a = sum + 12 + j * 6; land(el, a, { scale: .3 }, 8, 'popOver'); sfx(a, 'tick: done overnight'); });
M.kf('#camMorning', 'scale', [[CUT.morning, 1], [CUT.end, 1.04, 'cruise']]);

/* ---------- Loopmates. Working while I don't.   Oh, and the subscription? There isn't one. ---------- */
M.kf('#endMark', 'scale', [[CUT.end, 1.7], [CUT.end + 14, 1, 'snapSettle']]); M.kf('#endMark', 'x', [[CUT.end, -90], [CUT.end + 14, 0, 'snapSettle']]);
land('#endWord', CUT.end + 2, { x: 120, scale: 1.25 }, 14, 'snapSettle'); sfx(CUT.end + 3, 'chime: Loopmates');
say('#capEnd', "working while i don't", {});
const oh = F('oh and') - 4;
M.kf('#endLock', 'y', [[oh, 0], [oh + 14, -150, 'softInOut']]); M.kf('#endLock', 'scale', [[oh, 1], [oh + 14, .66, 'softInOut']]);
land('#endBill', oh + 3, { y: -1000, rotation: -7 }, 13); sfx(oh + 13, 'snap: the bill again');
const zero = F("there isn't") + 2;
M.count('#endAmt', { at: zero, from: 200, to: 0, frames: 13, round: false, format: v => '$' + Number(v).toFixed(2) }); sfx(zero, 'counter: down to zero');
M.kf('#endAmt', 'color', [[zero, '#D9432C'], [zero + 13, '#14161B', 'cruise']]);
M.kf('#endBill', 'scale', [[zero + 13, 1], [zero + 15, 1.07, 'glide'], [zero + 22, 1, 'glide']]); sfx(zero + 14, 'success: nothing to pay');
M.kf('#camEnd', 'scale', [[CUT.end, 1], [DUR * FPS, 1.03, 'cruise']]);

window.__ready = Motion.loaded().then(() => { if (/selftest/.test(location.search)) Motion.selfTest(M, { samples: 24 }); });
