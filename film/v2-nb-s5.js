/* ===================================================================================================================
   SCENE 5: Now the fun part. I say it once: "Add dark mode. Run the tests." Planner splits it up. Research finds the way.
   Code makes the change. Ops checks the build. All inside a sandbox, nowhere near my files. And a second Mate double-checks
   every step. Something risky? Halo stops and asks me first. I tap approve. Tests green. Pull request, waiting.
   I wasn't even in the loop!
   =================================================================================================================== */
const S5 = { fun: F('now the fun part'), say: F('i say it once'), add: F('add dark mode'), run: F('run the tests'), plan: F('planner splits'),
  res: F('research finds'), code: F('code makes'), ops: F('ops checks'), sand: F('all inside a sandbox'), nowhere: F('nowhere near'),
  second: F('and a second mate'), every: F('every step'), risky: F('something risky'), halo: F('halo stops'), apW: F('approve'),
  green: F('tests green'), pr: F('pull request'), wait: F('waiting'), loop: F("i wasn't even"), loopW: F('loop'), next: F("and they don't just") };
const ROWS5 = [['planner', 'Planner splits it up', 'Theme tokens, a toggle, the tests, a build check'], ['research', 'Research finds the way', 'prefers-color-scheme and CSS variables'],
  ['code', 'Code makes the change', '6 files changed'], ['ops', 'Ops checks the build', 'Build passed, lint clean'], ['halo', 'Push to GitHub', 'Waiting for you']];
(() => {
  const w = shot('s5');
  put(w, winH('runW', 160, 300, 1600, 520, 'New run', NB.lime,
    avH('mimo', 46, 120, 120, 'r5av') +
    `<div class="fld e8" style="left:200px;top:120px;width:1340px;height:150px"></div>` +
    `<div class="tl" id="r5ph" style="left:240px;top:166px;font-size:50px;line-height:60px;color:#9A96A3">Tell your Mates what you need</div>` +
    `<div class="hd" id="r5txt" style="left:240px;top:160px;font-size:66px;line-height:74px">Add dark mode. Run the tests.</div><i id="r5c" style="left:240px;top:166px;width:7px;height:62px;background:${NB.purple}"></i>` +
    `<div class="btn3 e10" id="r5go" style="left:1240px;top:320px;width:300px;height:96px;font-size:44px;line-height:86px;background:${NB.purple};color:#fff">Start</div>`));
  // the run, inside its sandbox
  put(w, `<div id="sbox" style="left:190px;top:1120px;width:1540px;height:1330px;border:9px dashed ${INK};border-radius:46px;background:rgba(169,231,255,.18)"></div>` +
    `<div class="stk e8" id="sbStk" style="left:1430px;top:1066px;width:330px;background:${NB.sky};font-size:58px;line-height:84px">Sandbox</div>`);
  let rows = '';
  ROWS5.forEach(([k, t, d], j) => { const y = 110 + j * 200, risky = j === 4;
    rows += `<div class="slab e8 row5" id="row${j}" style="left:30px;top:${y}px;width:1340px;height:170px;background:${risky ? NB.orange : '#fff'};border-radius:24px">` +
      avH(k, 22, 20, 120, '', { e: 'e4' }) + `<div class="hd" style="left:172px;top:20px;font-size:52px;line-height:62px">${t}</div>` +
      (j === 2 ? `<div class="cd" style="left:172px;top:94px;font-size:36px;line-height:48px">6 files changed  <span style="position:static;color:#1E9E52">+148</span>  <span style="position:static;color:#D23A2C">−23</span></div>`
        : `<div class="tx" style="left:172px;top:96px;font-size:34px;line-height:46px;color:#4A4652">${d}</div>`) +
      `<div style="left:1222px;top:42px;width:86px;height:86px;border-radius:50%;border:4px solid ${INK};background:#fff"></div>` + okH(1222, 42, 86, 'rk' + j) +
      (risky ? `<div class="stk e6" id="riskStk" style="left:1110px;top:-30px;width:90px;background:${NB.yellow};font-size:64px;line-height:80px;padding:0">!</div>` : '') + `</div>`; });
  put(w, winH('board', 260, 1180, 1400, 1160, 'Run: Add dark mode', NB.orange, rows));
  // my files stay outside, out of reach
  put(w, `<div class="slab e12" id="files" style="left:2240px;top:1260px;width:420px;height:300px;background:${NB.yellow};border-radius:20px 30px 30px 30px"><div class="slab" style="left:-5px;top:-48px;width:200px;height:56px;background:${NB.yellow};border-radius:18px 18px 0 0;border-bottom:0"></div>` +
    `<div class="hd" style="left:0;top:110px;width:410px;text-align:center;font-size:62px;line-height:72px">My files</div></div>` +
    `<i id="gapLine" style="left:1760px;top:1404px;width:460px;height:0;border-top:10px dashed ${INK}"></i><div class="no" id="gapNo" style="left:1940px;top:1360px;width:96px;height:96px"></div>`);
  // the second Mate who checks every step
  put(w, `<div id="rev" style="left:1690px;top:1300px;width:150px;height:150px">` + avH('recall', 0, 0, 150, 'revAv', { e: 'e8' }) + `</div>`);
  // Halo asks first
  put(w, winH('haloW', 1800, 1840, 980, 560, 'Halo asks first', NB.pink,
    tileH('halo', 170, 300, 240, 'haloT', { e: 'e10' }) +
    `<div class="hd" style="left:340px;top:120px;font-size:54px;line-height:64px">Push 6 changed files\nto GitHub?</div>` +
    `<div class="btn3 e10" id="apY" style="left:340px;top:330px;width:270px;height:96px;font-size:46px;line-height:86px;background:${NB.lime}">Approve</div>` +
    `<div class="btn3 e10" id="apN" style="left:650px;top:330px;width:250px;height:96px;font-size:46px;line-height:86px;background:#fff">Not now</div>`) +
    `<div class="stk e10" id="apStk" style="left:2250px;top:1760px;width:400px;background:${NB.lime};font-size:72px;line-height:100px">Approved</div>` + curH('cur5'));
  // tests, then the pull request
  put(w, winH('testsW', 2900, 1500, 900, 600, 'Tests', NB.lime,
    ['settings.test.ts', 'theme.test.ts', 'toggle.test.ts', 'storage.test.ts', 'a11y.test.ts'].map((t, j) =>
      okH(46, 106 + j * 90, 68, '', 'tk5') + `<div class="cd" style="left:140px;top:${116 + j * 90}px;font-size:38px;line-height:50px">${t}</div>` +
      `<div class="tx tp5" style="left:660px;top:${116 + j * 90}px;font-size:36px;line-height:50px;color:#1E9E52">passed</div>`).join('')));
  put(w, `<div class="slab e12" id="prC" style="left:2900px;top:2190px;width:900px;height:260px;background:${NB.violet}">` +
    `<div class="hd" style="left:40px;top:30px;font-size:56px;line-height:66px">Add dark mode to settings</div>` +
    `<div class="cd" style="left:40px;top:120px;font-size:38px;line-height:50px">#42  <span style="position:static;color:#0E7A3C">+148</span>  <span style="position:static;color:#B0261A">−23</span></div>` +
    `<div class="btn3 e8" style="left:600px;top:140px;width:250px;height:84px;background:#fff">Review</div></div>` +
    `<div class="stk e8" id="waitStk" style="left:3580px;top:2120px;width:250px;background:${NB.yellow};font-size:50px;line-height:76px">waiting</div>`);
  // the loop: four Mates on a ring that turns by itself; my cursor is asleep
  let ring = `<div id="ring5" style="left:4400px;top:2050px;width:0;height:0">` +
    `<div style="left:-330px;top:-330px;width:660px;height:660px;border-radius:50%;border:10px solid ${INK}"></div>`;
  ['planner', 'research', 'code', 'ops'].forEach((k, j) => { const a = j * Math.PI / 2 - Math.PI / 4;
    ring += `<div class="rg5" id="rg5_${j}" style="left:${(Math.cos(a) * 330 - 105).toFixed(0)}px;top:${(Math.sin(a) * 330 - 105).toFixed(0)}px;width:210px;height:210px">` + tileH(k, 105, 105, 200, '', { e: 'e8' }) + `</div>`; });
  ring += `<div id="bead5" style="left:-330px;top:-330px;width:660px;height:660px"><div style="left:302px;top:-26px;width:56px;height:56px;border-radius:50%;background:${NB.lime};border:6px solid ${INK}"></div></div></div>`;
  put(w, ring + `<svg id="sleepCur" style="left:4930px;top:2300px;width:78px;height:105px;overflow:visible" viewBox="0 0 46 62"><path d="M3 3v44l12-11 8 19 8-4-8-18h17z" fill="#FFFFFF" stroke="#14121A" stroke-width="4" stroke-linejoin="round"/></svg>` +
    ['z', 'z', 'z'].map((z, j) => `<div class="hd zz5" style="left:${5010 + j * 36}px;top:${2270 - j * 44}px;font-size:${50 + j * 12}px;line-height:60px;color:${NB.purple}">z</div>`).join(''));
})();
cam('s5', [
  [S5.fun, 720, 560, 1.0, 8, 16],
  [S5.fun + 14, 960, 560, 1.06, 6, -6, 'snapSettle'],
  [S5.say - 4, 960, 562, 1.08, 6, -6, 'cruise'],
  [S5.add + 6, 960, 520, 1.2, 4, -3, 'softLand'],
  [S5.plan - 6, 965, 525, 1.22, 4, -3, 'cruise'],
  [S5.plan + 6, 960, 1400, 1.12, 8, 4, 'whip'],
  [S5.res - 2, 960, 1410, 1.12, 8, 4, 'cruise'],
  [S5.res + 10, 960, 1600, 1.12, 8, 2, 'softInOut'],
  [S5.code - 2, 960, 1605, 1.12, 8, 2, 'cruise'],
  [S5.code + 10, 960, 1800, 1.12, 8, 0, 'softInOut'],
  [S5.ops - 2, 960, 1805, 1.12, 8, 0, 'cruise'],
  [S5.ops + 10, 960, 1990, 1.1, 8, -2, 'softInOut'],
  [S5.sand - 4, 960, 1995, 1.1, 8, -2, 'cruise'],
  [S5.sand + 16, 1330, 1770, .66, 14, -10, 'softLand'],
  [S5.second - 4, 1320, 1775, .68, 13, -10, 'cruise'],
  [S5.second + 10, 1000, 1780, .74, 10, -4, 'softInOut'],
  [S5.risky - 4, 1000, 1790, .75, 10, -4, 'cruise'],
  [S5.risky + 8, 1000, 2240, 1.0, 8, 4, 'softInOut'],
  [S5.halo - 2, 1010, 2240, 1.0, 8, 4, 'cruise'],
  [S5.halo + 10, 2270, 2110, 1.06, 6, -8, 'whip'],
  [S5.green - 6, 2280, 2115, 1.08, 6, -8, 'cruise'],
  [S5.green + 6, 3360, 1800, 1.1, 6, -6, 'whip'],
  [S5.pr - 4, 3365, 1810, 1.12, 6, -6, 'cruise'],
  [S5.pr + 8, 3350, 2260, 1.04, 6, -4, 'softInOut'],
  [S5.loop - 4, 3355, 2265, 1.06, 6, -4, 'cruise'],
  [S5.loop + 8, 4560, 2080, .92, 12, -8, 'whip'],
  [S5.next, 4560, 2085, .96, 11, -10, 'cruise'],
]);
/* I say it once: "Add dark mode. Run the tests." */
M.hide('#r5ph', S5.add - 3);
typeSpoken('#r5txt', 'add dark mode run the tests', { caret: '#r5c', early: 3, cpf: 2 });
const go5 = F('tests', 0) + 12; M.hide('#r5c', go5 - 2); push('#r5go', go5, 10);
/* Planner splits it up. Research finds the way. Code makes the change. Ops checks the build. (each row stands up when its Mate is named) */
stand('#board', S5.plan - 6, { rx: -50, frames: 10 });
[S5.plan, S5.res, S5.code, S5.ops].forEach((q, j) => { stand('#row' + j, q - 3, { rx: -86, frames: 10 }); sfx(q - 1, 'pop: next Mate'); });
/* All inside a sandbox, nowhere near my files. */
M.enter('#sbox', { at: S5.sand + 2, frames: 12, ease: 'softLand', from: { scale: 1.12, opacity: 0 } }); slap('#sbStk', F('sandbox') + 2, -5, 2.4);
stand('#files', S5.nowhere - 4, { rx: -70, frames: 10 });
M.enter('#gapLine', { at: S5.nowhere + 2, frames: 8, ease: 'softLand', from: { scaleX: .05 }, to: { scaleX: 1 } }); $$('#gapLine')[0].style.transformOrigin = '0 50%';
land('#gapNo', F('files') + 2, { scale: .3 }, 9, 'popOver'); sfx(F('files') + 3, 'snap: no way through');
/* And a second Mate double-checks every step. (it travels down the rows and stamps each one) */
const revAt = [S5.every - 6, S5.every + 2, S5.every + 9, S5.every + 16];
M.show('#rev', S5.second);
M.kf('#rev', 'x', [[S5.second, 300], [S5.second + 12, 0, 'softLand']]);
M.kf('#rev', 'y', [[S5.second, 0]].concat(revAt.flatMap((a, j) => [[a - 5, j * 200, 'glide'], [a, j * 200]])));
revAt.forEach((a, j) => { land('#rk' + j, a + 1, { scale: .3 }, 8, 'popOver'); sfx(a + 1, 'tick: checked'); });
M.kf('#rev', 'rotation', [[S5.second, 12], [S5.second + 12, -4, 'softLand']]);
M.exit('#rev', { at: S5.risky - 2, frames: 8, to: { x: 260, opacity: 0 } });
/* Something risky? Halo stops and asks me first. */
stand('#row4', S5.risky - 2, { rx: -86, frames: 10 }); slap('#riskStk', S5.risky + 6, 10, 2.4);
M.kf('#row4', 'x', [[S5.halo - 2, 0], [S5.halo, -14, 'glide'], [S5.halo + 2, 12, 'glide'], [S5.halo + 4, -8, 'glide'], [S5.halo + 7, 0, 'glide']]);
stand('#haloW', S5.halo + 2, { rx: -60, frames: 12 }); sfx(S5.halo + 4, 'pop: Halo');
/* I tap approve. */
M.cursor('#cur5', { keys: [[S5.apW - 22, 2900, 2700, 2.4, -16], [S5.apW - 4, 2290, 2236, 1, 0], [S5.apW + 10, 2296, 2240, 1, 0], [S5.green - 6, 2700, 2600, 1.6, 10]], ease: 'glide' });
M.hide('#cur5', S5.green - 6);
M.press('#cur5', '#apY', { at: S5.apW, frames: 3, cursorDepth: .8, targetDepth: 1, lag: 1, release: true }); push('#apY', S5.apW + 1, 10);
M.kf('#apN', 'opacity', [[S5.apW + 2, 1], [S5.apW + 8, .35, 'glide']]);
slap('#apStk', S5.apW + 6, -7, 2.4); sfx(S5.apW + 8, 'success: approved');
land('#rk4', S5.apW + 8, { scale: .3 }, 8, 'popOver');
/* Tests green. */
stand('#testsW', S5.green - 8, { rx: -60, frames: 10 });
$$('.tk5').forEach((el, j) => { const a = S5.green + j * 3; land(el, a, { scale: .3 }, 8, 'popOver'); M.show($$('.tp5')[j], a); sfx(a, 'tick: passed'); });
sfx(F('green') + 2, 'success: tests green');
/* Pull request, waiting. */
stand('#prC', S5.pr - 2, { rx: -70, frames: 11 }); slap('#waitStk', S5.wait, 6, 2.2);
/* I wasn't even in the loop! */
M.kf('#ring5', 'rotation', [[S5.loop - 2, -30], [S5.next + 10, 70, 'cruise']]);
[0, 1, 2, 3].forEach(j => M.kf('#rg5_' + j, 'rotation', [[S5.loop - 2, 30], [S5.next + 10, -70, 'cruise']]));
$$('.zz5').forEach((el, j) => { const a = S5.loop + 6 + j * 6; M.show(el, a); M.kf(el, 'opacity', [[a, 0], [a + 5, 1, 'glide']]); M.kf(el, 'y', [[a, 16], [S5.next + 10, -30, 'cruise']]); });
M.kf('#sleepCur', 'rotation', [[S5.loop, -8], [S5.next + 10, -14, 'cruise']]);
sfx(S5.loopW, 'chime: the loop');
