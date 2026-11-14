/* Loopmates film v2: the white world (scene 2 on). Neobrutalism with 3D: warm white paper with a dot grid, thick ink outlines,
   flat vibrant colour, every object an ink slab extruded 45 deg; the camera tilts the whole table in 3D between beats.
   Uses the clock and cue helpers from v2.js (M, F, FE, idx, W, say, land, sfx, markSVG). Every frame is a pure function of time. */
const INK = '#14121A';
const NB = { lime: '#D4FF4F', pink: '#FF9BCF', yellow: '#FFD84A', blue: '#8DB2FF', violet: '#BDA6FF', orange: '#FFA65E', teal: '#62E6CB', sky: '#A9E7FF',
  red: '#FF5A4A', purple: '#6A4DF4', mint: '#C3F7D6', peach: '#FFCBAA', cream: '#FFF3D6' };
const TILE = { mimo: NB.sky, research: NB.yellow, code: NB.orange, planner: NB.violet, writer: NB.blue, ops: NB.mint, halo: NB.pink, browser: NB.peach,
  flow: NB.violet, data: NB.teal, chef: NB.sky, tune: NB.yellow, luna: NB.orange, zen: NB.pink, orbit: NB.peach, spark: NB.violet, scout: NB.mint,
  recall: NB.pink, byte: NB.yellow, hira: NB.lime };
const EXT = (d, c = 'rgb(20, 18, 26)') => Array.from({ length: d }, (_, k) => `${k + 1}px ${k + 1}px 0px ${c}`).join(', ');
const EXT0 = (d, c = 'rgb(20, 18, 26)') => Array.from({ length: d }, () => `0px 0px 0px ${c}`).join(', ');
const RING = (r, c = INK) => Array.from({ length: 16 }, (_, k) => `${(r * Math.cos(k * Math.PI / 8)).toFixed(2)}px ${(r * Math.sin(k * Math.PI / 8)).toFixed(2)}px 0 ${c}`).join(',');
const TEXT3 = (d, o = 3.5) => RING(o) + ',' + Array.from({ length: d }, (_, k) => `${(k + 1 + o * .7).toFixed(1)}px ${(k + 1 + o * .7).toFixed(1)}px 0 ${INK}`).join(',');
document.head.insertAdjacentHTML('beforeend', `<style>${[4, 6, 8, 10, 12, 16, 22].map(d => `.e${d}{box-shadow:${EXT(d)}}`).join('')}
.t3{text-shadow:${TEXT3(10)}}.t3s{text-shadow:${TEXT3(6, 2.5)}}.t3x{text-shadow:${TEXT3(16, 5)}}</style>`);

const nbIds = [];
function shot(id, night) {
  document.getElementById('main').insertAdjacentHTML('beforeend',
    `<section class="nbshot${night ? ' night' : ''}" id="${id}"><div class="nbp"><div class="nbt"><div class="nbw" id="${id}w"><div class="dots"></div></div></div></div><div class="nbv"></div></section>`);
  nbIds.push(id);
  return document.getElementById(id + 'w');
}
const put = (w, html) => w.insertAdjacentHTML('beforeend', html);
/* the camera of a shot: [frame, look-at x, look-at y, zoom, tilt x (deg), tilt y (deg), ease arriving here] */
function cam(id, keys) { ['--cx', '--cy', '--z', '--rx', '--ry'].forEach((p, n) => M.kf('#' + id, p, keys.map(k => [k[0], k[n + 1], k[6]]))); }
const $$ = s => typeof s === 'string' ? Array.from(document.querySelectorAll(s)) : (s.length != null ? Array.from(s) : [s]);
const tileH = (key, x, y, s, id, o = {}) => `<div class="tile ${o.e || 'e10'}" id="${id}" style="left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;background:${o.bg || TILE[key]};border-radius:${Math.round(s * .17)}px"><img src="assets/m/${o.img || key}.png"></div>`;
const avH = (key, x, y, s, id, o = {}) => `<div class="av ${o.e || 'e4'}"${id ? ` id="${id}"` : ''} style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${o.bg || TILE[key]};border-radius:${Math.round(s * .26)}px"><img src="assets/m/${o.img || key}.png"></div>`;
const okH = (x, y, s, id, cls = '') => `<div class="ok ${cls}"${id ? ` id="${id}"` : ''} style="left:${x}px;top:${y}px;width:${s}px;height:${s}px"></div>`;
const curH = id => `<svg id="${id}" style="left:0;top:0;width:52px;height:70px;overflow:visible;z-index:50" viewBox="0 0 46 62"><path d="M3 3v44l12-11 8 19 8-4-8-18h17z" fill="#FFFFFF" stroke="#14121A" stroke-width="4" stroke-linejoin="round"/></svg>`;
const mk = id => `<div class="mk">${markSVG(id)}</div>`;
let mkN = 10; const mkid = () => 'nbm' + (mkN++);
/* an app window: ink slab with a coloured title strip carrying the Loopmates mark and the page's real name */
const winH = (id, x, y, w, h, title, bg, inner = '', o = {}) => `<div class="slab ${o.e || 'e16'}" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${o.fill || '#fff'}"><div class="wh" style="background:${bg}">${mk(mkid())}<b>${title}</b></div>${inner}</div>`;

/* motion vocabulary of the white world */
const persp = (el, p = 1500) => $$(el).forEach(e => gsap.set(e, { transformPerspective: p }));
function stand(sel, at, o = {}) {                // a slab stands up off the table (hinged on its bottom edge), landing decelerated
  $$(sel).forEach(e => { e.style.transformOrigin = o.origin || '50% 100%'; });
  persp(sel, o.p || 1500);
  const from = { rotationX: o.rx == null ? -84 : o.rx }; if (o.y) from.y = o.y; if (o.scale) from.scale = o.scale; if (o.ry) from.rotationY = o.ry;
  const to = { rotationX: 0 }; if (o.ry) to.rotationY = 0;
  M.enter(sel, { at, frames: o.frames || 12, ease: o.ease || 'softLand', from, to });
}
function standOut(sel, at, o = {}) {
  $$(sel).forEach(e => { e.style.transformOrigin = o.origin || '50% 100%'; }); persp(sel, o.p || 1500);
  M.exit(sel, { at, frames: o.frames || 9, ease: 'accelExit', from: { rotationX: 0 }, to: { rotationX: o.rx == null ? 86 : o.rx } });
}
function slap(sel, at, rot = -6, from = 2.3, frames = 11) {   // a sticker slapped on: arrives oversize and decelerates onto the table
  M.enter(sel, { at, frames, ease: 'snapSettle', from: { scale: from, rotation: rot * 2.6 }, to: { rotation: rot } });
  sfx(at + 3, 'pop: sticker');
}
function push(sel, at, d = 10) {                 // a slab button pressed into the table: it moves onto its own extrusion and comes back
  M.kf(sel, 'x', [[at - 1, 0], [at + 2, d, 'glide'], [at + 8, 0, 'glide']]);
  M.kf(sel, 'y', [[at - 1, 0], [at + 2, d, 'glide'], [at + 8, 0, 'glide']]);
  M.kf(sel, 'boxShadow', [[at - 1, EXT(d)], [at + 2, EXT0(d), 'glide'], [at + 8, EXT(d), 'glide']]);
  sfx(at + 1, 'switch: press');
}
function hop(sel, at, h = 26, frames = 12) {      // a Mate hops on its tile
  M.kf(sel, 'y', [[at, 0], [at + Math.round(frames * .4), -h, 'glide'], [at + frames, 0, 'gentleIn']]);
}
/* typing that follows the voice: the shown words are typed as each spoken word is heard. map[j] = spoken word index for shown word j */
function typeSpoken(sel, phrase, o = {}) {
  const el = $$(sel)[0], text = el.textContent, i0 = idx(phrase, o.k || 0), n = phrase.split(/\s+/).length;
  const words = text.split(' '), map = o.map || words.map((_, j) => Math.min(j, n - 1)), early = o.early == null ? 3 : o.early;
  const fr0 = W[i0 + map[0]].f - early, ev = []; let shown = 0;
  words.forEach((w, j) => { let fr = Math.max(W[i0 + map[j]].f - early, ev.length ? fr0 + ev[ev.length - 1][0] + 1 : fr0);
    const end = shown + [...w].length + (j < words.length - 1 ? 1 : 0);
    while (shown < end) { shown = Math.min(end, shown + (o.cpf || 2)); ev.push([fr++ - fr0, shown]); } });
  for (let k = 1; k < ev.length; k++) if (ev[k][0] <= ev[k - 1][0]) ev[k][0] = ev[k - 1][0] + 1;
  M.type(sel, { at: fr0, events: ev, caret: o.caret, caretGap: 8 });
  ev.filter((x, k) => k % 3 === 0).forEach(x => sfx(fr0 + x[0], 'tick: typing'));
  return fr0 + ev[ev.length - 1][0];
}
function typeFast(sel, at, o = {}) {             // typing not tied to the voice: a steady burst, cpf characters a frame
  const el = $$(sel)[0], n = [...el.textContent].length, ev = []; let s = 0, fr = 0;
  while (s < n) { s = Math.min(n, s + (o.cpf || 2) + ((fr * 7) % 3 === 0 ? 1 : 0)); ev.push([fr, s]); fr += (o.every || 1); if (o.nl && el.textContent[s - 1] === '\n') fr += 2; }
  M.type(sel, { at, events: ev, caret: o.caret, caretGap: 8 });
  for (let k = 0; k < ev.length; k += 4) sfx(at + ev[k][0], 'tick: typing');
  return at + ev[ev.length - 1][0];
}
function wave(sel, at, until, seed = 0) {         // a voice: bars that move while it talks
  $$(sel).forEach((b, j) => { const k = [[at, .2]];
    for (let fr = at, n = 0; fr < until; fr += 4, n++) k.push([fr + 4, .22 + .78 * Math.abs(Math.sin(j * 1.7 + n * .93 + seed)), 'softInOut']);
    k.push([until + 6, .2, 'glide']); M.kf(b, 'scaleY', k); });
}
const waveH = (cls, x, y, n, col, h = 46, gap = 13, w = 7) => Array.from({ length: n }, (_, j) => `<i class="${cls}" style="left:${x + j * gap}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${w / 2}px;background:${col};transform-origin:50% 50%"></i>`).join('');

/* the 3D Loopmates mark: a real extruded solid (layers stacked in depth), so it shows its sides when it turns */
function mark3H(id, x, y, s, depth = 16) {
  let h = `<div class="l3" id="${id}" style="left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px">`;
  for (let k = depth; k >= 1; k--) h += `<div style="left:0;top:0;width:${s}px;height:${s}px;transform:translateZ(${-k * 2.2}px)">${markSVG(mkid(), k === depth ? '#14121A' : '#2A2533')}</div>`;
  return h + `<div style="left:0;top:0;width:${s}px;height:${s}px">${markSVG(mkid())}</div></div>`;
}

/* ===================================================================================================================
   SCENE 2 (white): So, we built Loopmates!  Nineteen Mates. Nineteen little brains. Each with a name, a voice, and one thing
   they're really good at. Need a twentieth? I just make one. And every single one of them lives on one computer. Mine.
   =================================================================================================================== */
const S2 = { lm: F('loopmates'), n19: F('nineteen mates'), brains: F('nineteen little'), each: F('each with'), name: F('name'), voice: F('voice'),
  thing: F('one thing'), need: F('need a twentieth'), make: F('i just make one'), every: F('and every single one'), lives: F('lives on'),
  comp: F('computer'), mine: F('mine'), setup: F('setup') };
const ORDER19 = ['mimo', 'research', 'code', 'planner', 'writer', 'ops', 'halo', 'browser', 'flow', 'data', 'chef', 'tune', 'luna', 'zen', 'orbit', 'spark', 'scout', 'recall', 'byte'];
const GX = c => 496 + c * 232, GY = r => 280 + r * 232;          // the Agents page grid, in the page's own (screen) coordinates
(() => {
  const w = shot('s2');
  // the logo, on the paper at the top of the table
  put(w, mark3H('lgMark', 520, 540, 220) +
    `<div class="hd t3x" id="lgWord" style="left:660px;top:432px;font-size:196px;line-height:210px;color:${NB.purple};clip-path:inset(-30% var(--cr,0%) -30% -6%)">Loopmates</div>`);
  // the Agents page (its box is exactly one screen, so the laptop can show it 1:1 later)
  let page = `<div id="agentsPage" style="left:0;top:1100px;width:1920px;height:1080px">` +
    `<div class="hd" style="left:398px;top:62px;font-size:84px;line-height:96px">Agents</div>` +
    `<div class="btn3 e8" id="newBtn" style="left:1238px;top:70px;width:330px;height:84px;background:${NB.lime}">+ New agent</div>`;
  ORDER19.forEach((k, i) => { page += tileH(k, GX(i % 5), GY(Math.floor(i / 5)), 196, 'g_' + k, { e: 'e10' }); });
  page += tileH('spark', GX(4), GY(3), 196, 'g_hira', { bg: TILE.hira, e: 'e10' }) +
    `<div class="tag e4" id="hiraTag" style="left:${GX(4) - 62}px;top:${GY(3) + 64}px;width:124px;background:${NB.pink}">Hira</div></div>`;
  put(w, page);
  // the 19 counter, a sticker on the table
  put(w, `<div class="stk e10" id="n19" style="left:1560px;top:1300px;width:210px;background:${NB.yellow};font-size:110px;line-height:150px">19</div>`);
  // the agent card: name, voice, the one thing
  put(w, winH('prof', 2560, 1250, 1500, 830, 'Research', NB.yellow,
    tileH('research', 400, 470, 440, 'profT', { e: 'e12' }) +
    `<div class="tl" style="left:700px;top:118px;font-size:34px;line-height:44px">Name</div><div class="fld e4" style="left:700px;top:170px;width:700px;height:96px"></div>` +
    `<div class="hd" id="pfName" style="left:732px;top:184px;font-size:54px;line-height:66px">Research</div><i id="pfCaret" style="left:732px;top:190px;width:6px;height:56px;background:${NB.purple}"></i>` +
    `<div class="tl" style="left:700px;top:310px;font-size:34px;line-height:44px">Voice on calls</div><div class="fld e4" id="pfVoice" style="left:700px;top:362px;width:700px;height:96px"></div>` +
    `<div class="btn3 e4" id="pfPlay" style="left:724px;top:378px;width:140px;height:64px;font-size:30px;line-height:54px;background:${NB.yellow}">Play</div>` +
    waveH('pfw', 904, 386, 30, INK, 48, 15, 8) +
    `<div class="tl" style="left:700px;top:502px;font-size:34px;line-height:44px">Job, in one line</div><div class="fld e4" style="left:700px;top:554px;width:700px;height:96px"></div>` +
    `<div class="tx" id="pfJob" style="left:732px;top:578px;font-size:42px;line-height:52px">Finds and cites sources</div><i id="pfCaret2" style="left:732px;top:578px;width:6px;height:50px;background:${NB.purple}"></i>`));
  // the New agent form (real field names from the dashboard)
  const pics = ['mimo', 'spark', 'luna', 'tune', 'chef', 'zen'];
  put(w, winH('newForm', 400, 1240, 1120, 860, 'New agent', NB.lime,
    `<div class="tl" style="left:56px;top:112px;font-size:32px;line-height:42px">Name</div><div class="fld e4" style="left:56px;top:160px;width:1000px;height:92px"></div>` +
    `<div class="hd" id="nfName" style="left:86px;top:172px;font-size:52px;line-height:64px">Hira</div><i id="nfC1" style="left:86px;top:178px;width:6px;height:54px;background:${NB.purple}"></i>` +
    `<div class="tl" style="left:56px;top:290px;font-size:32px;line-height:42px">Job, in one line</div><div class="fld e4" style="left:56px;top:338px;width:1000px;height:92px"></div>` +
    `<div class="tx" id="nfJob" style="left:86px;top:360px;font-size:40px;line-height:50px">Screens candidates and books interviews.</div><i id="nfC2" style="left:86px;top:360px;width:6px;height:50px;background:${NB.purple}"></i>` +
    `<div class="tl" style="left:56px;top:468px;font-size:32px;line-height:42px">Picture</div>` +
    pics.map((k, j) => avH(k, 56 + j * 132, 520, 112, 'nfp_' + k, { bg: '#fff' })).join('') +
    `<div id="nfRing" style="left:${56 + 132 - 12}px;top:508px;width:136px;height:136px;border:6px solid ${NB.purple};border-radius:38px"></div>` +
    `<div class="btn3 e8" id="nfCreate" style="left:716px;top:718px;width:340px;height:84px;background:${NB.purple};color:#fff">Create agent</div>`));
  put(w, curH('cur2'));
})();

/* my laptop, drawn in the white world: its screen shows the Agents page exactly as the camera last saw it */
(() => {
  const w = shot('s2l');
  put(w, `<div class="slab e22" id="lapLid" style="left:430px;top:200px;width:1060px;height:640px;background:#14121A;border-radius:44px"></div>` +
    `<div id="lapScr" style="left:480px;top:250px;width:960px;height:540px;overflow:hidden;border-radius:8px;background:#FFFDF5"><div id="lapIn" style="left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;transform:scale(.5)"><div style="left:-24px;top:-20px;width:1968px;height:1128px;background-image:radial-gradient(circle, rgba(20,18,26,.17) 2.6px, transparent 3.2px);background-size:48px 48px"></div></div></div>` +
    `<div class="slab e16" id="lapBase" style="left:300px;top:840px;width:1320px;height:74px;background:${NB.violet};border-radius:10px 10px 40px 40px"></div>` +
    `<div class="stk e12" id="mineStk" style="left:1250px;top:150px;width:330px;background:${NB.yellow};font-size:96px;line-height:130px">Mine.</div>`);
  const clone = document.getElementById('agentsPage').cloneNode(true);
  clone.removeAttribute('id'); clone.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  clone.style.top = '0px'; document.getElementById('lapIn').appendChild(clone);
})();

/* ---------- So, we built Loopmates!  (the mark from my laptop's screen lands as a solid; the name slides out from behind it) ---------- */
const ZC = 526 / 220;                                             // at the cut the mark is exactly as big as it was on the screen at the end of the dive
cam('s2', [
  [CUT2, 520, 540, ZC, 0, 0],
  [CUT2 + 16, 960, 560, 1.0, 12, -10, 'snapSettle'],
  [S2.n19 - 8, 960, 560, 1.03, 10, -8, 'cruise'],
  [S2.n19 + 8, 980, 1690, .92, 14, 6, 'whip'],                      // down the table to the team
  [S2.brains - 2, 980, 1690, .93, 13, 4, 'cruise'],
  [S2.brains + 10, 960, 1680, .96, 10, -6, 'softInOut'],
  [S2.each - 6, 960, 1680, .97, 9, -7, 'cruise'],
  [S2.each + 6, 3310, 1650, 1.0, 6, -8, 'whip'],                   // over to one of them
  [S2.need - 8, 3320, 1655, 1.04, 5, -6, 'cruise'],
  [S2.need + 4, 960, 1640, 1.0, 8, 6, 'whip'],                      // back to the page: I make a twentieth
  [S2.make + 18, 960, 1640, 1.02, 6, 4, 'cruise'],
  [S2.lives - 10, 960, 1640, 1.0, 0, 0, 'softInOut'],               // square to the lens: this page is a screen
  [S2.lives, 960, 1640, 1.0, 0, 0],
]);
M.kf('#lgMark', 'rotationY', [[CUT2, 0], [CUT2 + 18, -34, 'snapSettle'], [S2.n19, -22, 'cruise']]);
M.kf('#lgMark', 'rotationX', [[CUT2, 0], [CUT2 + 18, 14, 'snapSettle'], [S2.n19, 10, 'cruise']]);
persp('#lgMark', 1200);
M.kf('#lgWord', '--cr', [[CUT2 + 4, 100], [CUT2 + 18, 0, 'softLand']], { fmt: v => v + '%' });
M.kf('#lgWord', 'x', [[CUT2 + 4, -90], [CUT2 + 18, 0, 'softLand']]);
sfx(S2.lm - 1, 'chime: Loopmates');

/* ---------- Nineteen Mates. (they drop onto the table one after another; the count is a sticker) ---------- */
ORDER19.forEach((k, n) => { const at = S2.n19 - 2 + Math.round(n * 1.15); stand('#g_' + k, at, { rx: -80, y: -40, frames: 10 }); if (n % 3 === 0) sfx(at + 2, 'pop: a Mate'); });
stand('#newBtn', S2.n19 + 2, { frames: 10 });
slap('#n19', S2.n19 + 4, 7, 2.4); M.count('#n19', { at: S2.n19 + 4, from: 1, to: 19, frames: 22, round: true });
M.exit('#n19', { at: S2.each - 8, frames: 8, to: { y: -60, rotation: 20, opacity: 0 } });
/* Nineteen little brains. (a ripple of thought runs across the team) */
ORDER19.forEach((k, n) => { const r = Math.floor(n / 5), c = n % 5; hop('#g_' + k + ' img', S2.brains + (r + c) * 2, 30, 12); });
/* ---------- Each with a name, a voice, and one thing they're really good at. ---------- */
stand('#prof', S2.each - 2, { rx: -70, frames: 12 });
M.type('#pfName', { at: S2.name - 3, events: [[0, 2], [1, 4], [2, 6], [3, 8]], caret: '#pfCaret', caretOff: S2.voice - 4 });
land('#pfPlay', S2.voice - 3, { scale: .4 }, 9, 'popOver'); push('#pfPlay', S2.voice + 1, 4);
M.show('.pfw', S2.voice); wave('.pfw', S2.voice + 2, S2.need - 6, 1);
M.type('#pfJob', { at: S2.thing - 3, events: Motion.cadence('Finds and cites sources', { style: 'fast', seed: 3 }), caret: '#pfCaret2', caretOff: S2.need });
hop('#profT img', S2.voice, 22, 12);
/* ---------- Need a twentieth? I just make one. ---------- */
M.cursor('#cur2', { keys: [[S2.need - 10, 1800, 1360, 2.2, -16], [S2.need + 2, 1420, 1205, 1, 0], [S2.need + 14, 1430, 1210, 1, 0],
  [S2.make - 6, 380 + 188 + 50, 1240 + 580, 1, 0], [S2.make + 6, 380 + 188 + 52, 1240 + 582, 1, 0], [S2.make + 12, 400 + 880, 1240 + 760, 1, 0], [S2.make + 22, 400 + 884, 1240 + 762, 1, 0],
  [S2.lives - 12, 1900, 2300, 2, 10]], ease: 'glide' });
M.hide('#cur2', S2.lives - 12);
M.press('#cur2', '#newBtn', { at: S2.need + 6, frames: 3, cursorDepth: .8, targetDepth: 1, lag: 1, release: true }); push('#newBtn', S2.need + 7, 8);
stand('#newForm', S2.need + 10, { rx: -76, frames: 11 });
M.type('#nfName', { at: S2.need + 16, events: [[0, 1], [2, 2], [3, 3], [5, 4]], caret: '#nfC1', caretOff: S2.need + 24 });
const nfJobEnd = typeFast('#nfJob', S2.need + 23, { cpf: 2, caret: '#nfC2' });
M.hide('#nfC2', nfJobEnd + 8);
M.press('#cur2', '#nfp_spark', { at: S2.make, frames: 3, cursorDepth: .8, targetDepth: .9, lag: 1, release: true });
land('#nfRing', S2.make + 1, { scale: 1.4 }, 8, 'snapSettle'); sfx(S2.make + 1, 'tick: picture');
M.press('#cur2', '#nfCreate', { at: S2.make + 16, frames: 3, cursorDepth: .8, targetDepth: 1, lag: 1, release: true }); push('#nfCreate', S2.make + 17, 8);
standOut('#newForm', S2.make + 22, { rx: 80, frames: 9 });
stand('#g_hira', S2.make + 26, { rx: -80, y: -60, frames: 10 }); slap('#hiraTag', S2.make + 32, -5, 2.2);
sfx(S2.make + 30, 'success: Hira is ready');

/* ---------- lives on one computer. Mine.  (match cut: that page is my laptop's screen; pull back) ---------- */
cam('s2l', [
  [S2.lives, 960, 520, 2.0, 0, 0],
  [S2.comp + 12, 960, 545, .98, 9, -6, 'softLand'],
  [S2.mine + 10, 960, 548, .97, 10, -8, 'cruise'],
  [S2.setup, 960, 550, 1.0, 8, -6, 'cruise'],
]);
slap('#mineStk', S2.mine - 2, 8, 2.6, 12);
