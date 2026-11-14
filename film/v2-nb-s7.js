/* ===================================================================================================================
   SCENE 7: What did I decide last week? Mimo remembers. I said "shorter, please" once. Once! And they remembered.
   And when nobody needs them? They go back over their own mistakes... so they don't make them twice.
   No skill for the job? They write one.
   =================================================================================================================== */
const S7 = { what: F('what did i decide'), rem: F('mimo remembers'), said: F('i said'), shorter: F('shorter'), once1: F('once', 1), once2: F('once', 2),
  rmb: F('and they remembered'), nobody: F('and when nobody'), back: F('they go back'), so2: F("so they don't make"), noskill: F('no skill for'),
  write: F('they write one'), notall: F("and it's not all") };
(() => {
  const w = shot('s7');
  put(w, winH('memW', 210, 110, 1500, 860, 'Chat', NB.sky,
    `<div class="bub e6" id="q7" style="right:60px;top:110px;background:${NB.purple};color:#fff;font-size:44px;line-height:56px;border-radius:26px 26px 6px 26px">What did I decide last week?</div>` +
    avH('mimo', 50, 280, 120, 'm7av', { e: 'e6' }) +
    `<div class="bub e6" id="a7" style="left:200px;top:280px;background:#fff;font-size:44px;line-height:58px;border-radius:26px 26px 26px 6px">You moved the launch to Monday,\nafter the bug bash.</div>` +
    `<div class="slab e10" id="note7" style="left:760px;top:520px;width:620px;height:250px;background:${NB.yellow};border-radius:20px">` +
    `<div class="tl" style="left:36px;top:30px;font-size:32px;line-height:40px;color:#4A4652">My Space, Tuesday</div><div class="hd" style="left:36px;top:84px;font-size:52px;line-height:62px">Launch moves\nto Monday.</div></div>`));
  // the long report, then the short one
  let lines = ['This week the team shipped dark mode for the settings', 'page, after a plan from Planner and research on theme', 'tokens. Code changed six files and the full test suite', 'passed on the first run. Ops checked the build twice.',
    'Halo stopped one push until it was approved. Research', 'also tracked battery news: sodium-ion packs are now', 'reaching home storage, and prices kept falling. The', 'launch moved to Monday so the bugs could be fixed first.'];
  put(w, `<div class="slab e16" id="rep7" style="left:310px;top:1250px;width:1300px;height:700px;background:#fff;overflow:hidden"><div class="wh" style="background:${NB.blue}">${mk(mkid())}<b>Weekly report</b></div>` +
    avH('writer', 40, 110, 100, '', { e: 'e4' }) + lines.map((t, j) => `<div class="tx" style="left:170px;top:${118 + j * 64}px;font-size:36px;line-height:48px;color:#3A3644">${t}</div>`).join('') + `</div>` +
    `<div class="tx" id="rep7s" style="left:480px;top:1368px;font-size:44px;line-height:60px;color:${INK}">Dark mode shipped, tests green.\nLaunch moved to Monday.</div>` +
    `<div class="bub e8" id="sh7" style="left:1340px;top:1180px;background:${NB.purple};color:#fff;font-size:50px;line-height:62px;border-radius:26px 26px 6px 26px">shorter, please</div>`);
  ['Wed', 'Thu', 'Fri'].forEach((d, j) => put(w, `<div class="slab e10 wk7" style="left:${330 + j * 440}px;top:1720px;width:400px;height:230px;background:#fff">` +
    `<div class="hd" style="left:30px;top:22px;font-size:46px;line-height:56px">${d}</div><div class="tx" style="left:30px;top:94px;font-size:32px;line-height:44px;color:#3A3644">Two lines. Done.</div>` + okH(290, 20, 76, '', 'wk7ok') + `</div>`));
  put(w, `<div class="slab e12" id="jr7" style="left:1660px;top:1290px;width:720px;height:280px;background:${NB.lime};border-radius:24px">` +
    `<div class="tl" style="left:36px;top:30px;font-size:32px;line-height:40px;color:#3A3644">Writer's journal</div><div class="hd" style="left:36px;top:86px;font-size:50px;line-height:60px">Keep reports short.\nAsked once, on Tuesday.</div></div>`);
  // after hours: they go back over their mistakes
  put(w, `<div class="slab e22" id="night7" style="left:2400px;top:300px;width:1800px;height:1300px;background:#2A2D6A;border-radius:48px"></div>` +
    `<div style="left:3960px;top:380px;width:150px;height:150px;border-radius:50%;background:${NB.yellow};border:6px solid ${INK}"></div>` +
    tileH('ops', 2720, 640, 230, 't7ops', { e: 'e10' }) + tileH('code', 3000, 640, 230, 't7code', { e: 'e10' }) + tileH('research', 3280, 640, 230, 't7res', { e: 'e10' }) +
    ['z', 'z'].map((z, j) => `<div class="hd zz7" style="left:${3400 + j * 40}px;top:${460 - j * 46}px;font-size:${54 + j * 14}px;line-height:60px;color:#FFFDF5">z</div>`).join('') +
    `<div class="slab e12" id="fail7" style="left:2560px;top:900px;width:1000px;height:300px;background:${NB.red};border-radius:28px">` +
    `<div class="no" style="left:36px;top:40px;width:96px;height:96px;background:#fff"></div><div class="hd" style="left:160px;top:36px;font-size:58px;line-height:66px">Build failed</div>` +
    `<div class="cd" style="left:160px;top:124px;font-size:36px;line-height:48px">missing API key in .env</div><div class="tl" style="left:160px;top:196px;font-size:30px;line-height:40px;color:#3A1612">Ops, Monday 14:02</div></div>` +
    `<div class="slab e12" id="lesson7" style="left:2560px;top:900px;width:1000px;height:300px;background:${NB.lime};border-radius:28px">` + okH(36, 40, 96, '') +
    `<div class="hd" style="left:160px;top:36px;font-size:58px;line-height:66px">Lesson</div><div class="tx" style="left:160px;top:120px;font-size:42px;line-height:54px">Check the .env before every build.</div></div>` +
    `<div class="hd" id="mag7" style="left:3600px;top:860px;font-size:150px;line-height:160px;color:#FFFDF5">?</div>`);
  // no skill for the job? they write one
  put(w, `<div class="slab e12" id="job7" style="left:2560px;top:1800px;width:1200px;height:130px;background:${NB.cream};border-radius:26px"><div class="hd" style="left:40px;top:30px;font-size:56px;line-height:68px">Split this PDF into chapters</div></div>` +
    `<div class="slab e16" id="shelf7" style="left:2400px;top:2010px;width:1700px;height:520px;background:#fff"><div class="wh" style="background:${NB.orange}">${mk(mkid())}<b>Skills</b></div>` +
    ['weekly-report', 'clean-csv', 'book-a-court'].map((t, j) => `<div class="slab e6" style="left:${50 + j * 410}px;top:140px;width:370px;height:300px;background:${[NB.sky, NB.mint, NB.pink][j]};border-radius:22px"><div class="cd" style="left:26px;top:30px;font-size:32px;line-height:42px">${t}</div><div class="tl" style="left:26px;top:90px;font-size:28px;line-height:38px;color:#3A3644">SKILL.md</div></div>`).join('') +
    `<div id="slot7" style="left:1280px;top:140px;width:370px;height:300px;border:7px dashed ${INK};border-radius:22px"><div class="hd" style="left:0;top:90px;width:356px;text-align:center;font-size:100px;line-height:110px">?</div></div></div>` +
    `<div class="slab e12" id="new7" style="left:3900px;top:1560px;width:370px;height:300px;background:${NB.lime};border-radius:22px"><div class="cd" style="left:26px;top:30px;font-size:30px;line-height:40px">split-pdf-chapters</div>` +
    `<div class="tx" id="new7t" style="left:26px;top:96px;width:330px;font-size:27px;line-height:38px;color:#2A2733">Find the headings.\nCut at each one.\nName files by title.</div></div>`);
})();
cam('s7', [
  [S7.what, 760, 560, 1.06, 6, 16],
  [S7.what + 14, 960, 540, 1.1, 6, -6, 'snapSettle'],
  [S7.rem + 10, 980, 600, 1.12, 6, -6, 'cruise'],
  [S7.said - 6, 990, 610, 1.12, 6, -6, 'cruise'],
  [S7.said + 6, 960, 1560, 1.04, 8, 4, 'whip'],
  [S7.once2 - 6, 960, 1570, 1.06, 8, 4, 'cruise'],
  [S7.once2 + 6, 1330, 1640, .8, 10, -4, 'softInOut'],
  [S7.nobody - 6, 1330, 1650, .82, 10, -4, 'cruise'],
  [S7.nobody + 8, 3300, 900, .82, 10, -8, 'whip'],
  [S7.back + 10, 3240, 960, .96, 8, -6, 'softInOut'],
  [S7.noskill - 6, 3250, 970, .98, 8, -6, 'cruise'],
  [S7.noskill + 8, 3400, 2100, .88, 10, 4, 'whip'],
  [S7.notall, 3400, 2120, .92, 9, 2, 'cruise'],
]);
/* What did I decide last week? Mimo remembers. */
land('#q7', S7.what - 2, { y: 40, scale: .8 }, 10); sfx(S7.what, 'pop: question');
land('#m7av', S7.rem - 6, { scale: .4 }, 9, 'popOver'); stand('#a7', S7.rem - 4, { rx: -70, frames: 10, origin: '0% 100%' });
slap('#note7', F('remembers') + 4, -4, 2.2, 12); sfx(F('remembers') + 6, 'chime: remembered');
/* I said "shorter, please" once. */
stand('#rep7', S7.said + 2, { rx: -50, frames: 10 });
land('#sh7', S7.shorter - 2, { scale: .5, rotation: 8 }, 10, 'popOver'); sfx(S7.shorter, 'pop: shorter please');
const cut7 = S7.once1 - 2;
M.kf('#rep7', 'height', [[cut7, 700], [cut7 + 12, 330, 'softLand']], { fmt: v => v + 'px' }); sfx(cut7 + 2, 'snap: shorter');
$$('#rep7 .tx').forEach(el => M.hide(el, cut7 + 4)); M.show('#rep7s', cut7 + 4); land('#rep7s', cut7 + 4, { y: 20 }, 8);
/* Once! And they remembered. (every report after that is short; the rule is in Writer's journal) */
$$('.wk7').forEach((el, j) => { stand(el, S7.once2 + j * 4, { rx: -80, frames: 9 }); land($$('.wk7ok')[j], S7.once2 + 8 + j * 4, { scale: .3 }, 8, 'popOver'); sfx(S7.once2 + 8 + j * 4, 'tick: short again'); });
slap('#jr7', S7.rmb + 2, -5, 2.2, 12);
/* And when nobody needs them? (after hours, asleep) They go back over their own mistakes... so they don't make them twice. */
stand('#night7', S7.nobody, { rx: -40, frames: 12 });
['#t7ops', '#t7code', '#t7res'].forEach((s, j) => stand(s, S7.nobody + 4 + j * 3, { rx: -80, frames: 9 }));
$$('.zz7').forEach((el, j) => { const a = S7.nobody + 10 + j * 5; M.show(el, a, S7.back + 2); M.kf(el, 'y', [[a, 14], [S7.back + 2, -16, 'cruise']]); });
stand('#fail7', S7.back - 2, { rx: -80, frames: 10 }); sfx(S7.back, 'snap: a mistake');
hop('#t7ops img', S7.back + 4, 36, 12); land('#mag7', S7.back + 6, { scale: 2, rotation: 20 }, 10, 'snapSettle');
M.kf('#mag7', 'x', [[S7.back + 16, 0], [F('mistakes') + 10, -360, 'softInOut'], [S7.so2, -140, 'softInOut']]);
M.hide('#mag7', S7.so2 + 2);
const turn7 = S7.so2 + 2;                                       // the card turns over: the mistake becomes a lesson
$$('#fail7, #lesson7').forEach(e => gsap.set(e, { transformPerspective: 1600 }));
M.kf('#fail7', 'rotationX', [[turn7, 0], [turn7 + 5, 90, 'gentleIn']]); M.hide('#fail7', turn7 + 5);
M.show('#lesson7', turn7 + 5); M.kf('#lesson7', 'rotationX', [[turn7 + 5, -90], [turn7 + 12, 0, 'softLand']]);
sfx(turn7 + 6, 'success: lesson');
/* No skill for the job? They write one. */
stand('#job7', S7.noskill - 4, { rx: -80, frames: 10 }); stand('#shelf7', S7.noskill + 2, { rx: -50, frames: 11 });
M.kf('#slot7', 'rotation', [[S7.noskill + 14, 0], [S7.noskill + 16, -4, 'glide'], [S7.noskill + 18, 4, 'glide'], [S7.noskill + 21, 0, 'glide']]);
stand('#new7', S7.write - 4, { rx: -80, frames: 10 });
typeFast('#new7t', S7.write + 2, { cpf: 3, nl: true });
M.kf('#new7', 'x', [[S7.write + 22, 0], [S7.write + 32, 2400 + 5 + 1280 - 3900, 'softInOut']]);
M.kf('#new7', 'y', [[S7.write + 22, 0], [S7.write + 32, 2010 + 5 + 140 - 1560, 'softInOut']]);
M.hide('#slot7', S7.write + 32); sfx(S7.write + 32, 'snap: skill saved');

/* ===================================================================================================================
   SCENE 8: And it's not all work. Chef plans dinner and fills my grocery list. Tune builds a playlist from what I actually
   listen to. Luna keeps my journal. And Zen notices I slept badly, and goes easy on my calendar.
   =================================================================================================================== */
const S8 = { notall: F("and it's not all"), chef: F('chef plans'), grocery: F('grocery list'), tune: F('tune builds'), listen: F('listen to'),
  luna: F('luna keeps'), zen: F('and zen notices'), slept: F('slept badly'), easy: F('goes easy'), cal: F('calendar'), love: F("here's the part") };
(() => {
  const w = shot('s8');
  const panel = (id, x, y, title, c, k, inner) => winH(id, x, y, 1600, 820, title, c, tileH(k, 260, 430, 340, 't8' + k, { e: 'e12' }) + inner);
  put(w, panel('p8a', 120, 120, 'Chef', NB.orange, 'chef',
    `<div class="tl" style="left:520px;top:120px;font-size:34px;line-height:44px">Tonight</div><div class="hd" style="left:520px;top:166px;font-size:64px;line-height:74px">Lemon chickpea pasta</div>` +
    `<div class="tl" style="left:520px;top:290px;font-size:34px;line-height:44px">Grocery list</div>` +
    ['Chickpeas', 'Two lemons', 'Spinach', 'Parmesan'].map((t, j) => `<div style="left:520px;top:${348 + j * 96}px;width:60px;height:60px;border-radius:14px;border:4px solid ${INK};background:#fff"></div>` + okH(520, 348 + j * 96, 60, '', 'gr8') +
      `<div class="tx" style="left:606px;top:${354 + j * 96}px;font-size:42px;line-height:50px">${t}</div>`).join('')));
  put(w, panel('p8b', 2000, 120, 'Tune', NB.yellow, 'tune',
    `<div class="hd" style="left:520px;top:120px;font-size:60px;line-height:70px">Your Thursday mix</div><div class="tl" style="left:520px;top:200px;font-size:32px;line-height:42px">From what you played this week</div>` +
    [['Slow Tide', 'Mara Lune'], ['Paper Planes at Noon', 'The Fold'], ['Lemon Light', 'Juno Park'], ['Nightbus', 'Ola Sente'], ['Small Hours', 'Kit & Vale']].map(([t, a], j) =>
      `<div class="slab e4 tr8" style="left:520px;top:${270 + j * 100}px;width:980px;height:84px;background:${j % 2 ? '#fff' : NB.cream};border-width:4px;border-radius:16px">` +
      `<div class="hd" style="left:24px;top:16px;font-size:38px;line-height:48px">${t}</div><div class="tl" style="right:24px;top:20px;font-size:32px;line-height:42px">${a}</div></div>`).join('') +
    waveH('eq8', 120, 680, 12, INK, 60, 24, 12)));
  put(w, panel('p8c', 120, 1100, 'Journal', NB.violet, 'luna',
    `<div class="slab e8" style="left:520px;top:120px;width:1000px;height:600px;background:${NB.cream}"></div>` +
    `<div class="hd" id="jr8" style="left:570px;top:160px;width:900px;font-size:54px;line-height:76px;font-weight:600">Thursday.\nShipped dark mode. Long walk.\nEarly night, finally.</div>`));
  put(w, panel('p8d', 2000, 1100, 'Zen', NB.pink, 'zen',
    `<div class="slab e8" style="left:520px;top:110px;width:440px;height:600px;background:#fff"><div class="tl" style="left:30px;top:26px;font-size:30px;line-height:40px">Sleep</div>` +
    [7.2, 7.5, 6.9, 7.8, 7.1, 7.4, 5.2].map((h, j) => `<div class="slab sl8" style="left:${30 + j * 56}px;top:${520 - h * 50}px;width:40px;height:${h * 50}px;border-width:4px;border-radius:8px;background:${j === 6 ? NB.red : NB.violet};transform-origin:50% 100%"></div>`).join('') +
    `<div class="hd" id="slp8" style="left:30px;top:70px;font-size:50px;line-height:58px">5 h 12 min</div></div>` +
    `<div class="slab e8" style="left:1000px;top:110px;width:520px;height:600px;background:#fff"><div class="tl" style="left:30px;top:26px;font-size:30px;line-height:40px">Today</div>` +
    ['9:00', '11:00', '14:00', '17:00'].map((t, j) => `<div class="tl" style="left:30px;top:${90 + j * 120}px;font-size:28px;line-height:36px">${t}</div>`).join('') +
    `<div class="slab e6" id="cb8a" style="left:130px;top:84px;width:360px;height:100px;background:${NB.blue};border-radius:18px"><div class="hd" style="left:22px;top:24px;font-size:40px;line-height:48px">Deep work</div></div>` +
    `<div class="slab e6" id="cb8b" style="left:130px;top:444px;width:360px;height:100px;background:${NB.orange};border-radius:18px"><div class="hd" style="left:22px;top:24px;font-size:40px;line-height:48px">Hard gym</div></div>` +
    `<div class="slab e6" id="cb8c" style="left:130px;top:444px;width:360px;height:100px;background:${NB.mint};border-radius:18px"><div class="hd" style="left:22px;top:24px;font-size:40px;line-height:48px">Easy walk</div></div></div>`) +
    `<div class="stk e10" id="easy8" style="left:3180px;top:1830px;width:420px;background:${NB.lime};font-size:56px;line-height:84px">Go easy today</div>`);
})();
cam('s8', [
  [S8.notall, 1840, 1000, .5, 14, 14],
  [S8.notall + 16, 1960, 1060, .52, 12, -6, 'snapSettle'],
  [S8.chef - 6, 1950, 1060, .53, 12, -6, 'cruise'],
  [S8.chef + 8, 920, 540, 1.08, 6, -4, 'softInOut'],
  [S8.tune - 6, 930, 540, 1.1, 6, -4, 'cruise'],
  [S8.tune + 6, 2800, 540, 1.08, 6, -6, 'whip'],
  [S8.luna - 6, 2810, 545, 1.1, 6, -6, 'cruise'],
  [S8.luna + 6, 920, 1520, 1.08, 6, 4, 'whip'],
  [S8.zen - 6, 930, 1525, 1.1, 6, 4, 'cruise'],
  [S8.zen + 6, 2800, 1520, 1.06, 6, -6, 'whip'],
  [S8.love, 2810, 1530, 1.1, 6, -6, 'cruise'],
]);
/* And it's not all work. (four rooms of my life, from above) */
['#p8a', '#p8b', '#p8c', '#p8d'].forEach((s, j) => stand(s, S8.notall + j * 4, { rx: -60, frames: 11 }));
['chef', 'tune', 'luna', 'zen'].forEach((k, j) => hop('#t8' + k + ' img', S8.notall + 16 + j * 4, 34, 12));
/* Chef plans dinner and fills my grocery list. */
$$('.gr8').forEach((el, j) => { const a = S8.grocery - 6 + j * 4; land(el, a, { scale: .3 }, 8, 'popOver'); sfx(a, 'tick: groceries'); });
/* Tune builds a playlist from what I actually listen to. */
$$('.tr8').forEach((el, j) => { stand(el, S8.tune + 4 + j * 4, { rx: -86, frames: 8 }); sfx(S8.tune + 5 + j * 4, 'tick: a track'); });
M.show('.eq8', S8.tune + 4); wave('.eq8', S8.tune + 6, S8.luna, 2);
/* Luna keeps my journal. */
typeFast('#jr8', S8.luna - 4, { cpf: 2, nl: true });
/* And Zen notices I slept badly, and goes easy on my calendar. */
$$('.sl8').forEach((el, j) => M.enter(el, { at: S8.zen - 4 + j * 2, frames: 9, ease: 'softLand', from: { scaleY: .05 }, to: { scaleY: 1 } }));
M.kf($$('.sl8')[6], 'x', [[S8.slept, 0], [S8.slept + 2, -6, 'glide'], [S8.slept + 4, 6, 'glide'], [S8.slept + 7, 0, 'glide']]);
land('#slp8', S8.slept - 2, { y: 20 }, 8); sfx(S8.slept, 'snap: slept badly');
M.kf('#cb8a', 'y', [[S8.easy, 0], [S8.easy + 12, 120, 'softInOut']]); sfx(S8.easy + 10, 'snap: moved');
M.show('#cb8c', S8.cal - 4); M.hide('#cb8b', S8.cal - 4);
$$('#cb8c').forEach(e => gsap.set(e, { transformPerspective: 1200 })); M.kf('#cb8c', 'rotationX', [[S8.cal - 4, -90], [S8.cal + 4, 0, 'softLand']]);
slap('#easy8', S8.cal + 6, -5, 2.4, 11);

/* ===================================================================================================================
   SCENE 9: Here's the part I love. They keep watch, so I don't have to. My deadlines. My repos. The news. Even my house.
   Then they decide: a morning briefing, a quick message, or a phone call. I can even say, "Call me at six."
   And at six, it calls. Already caught up.
   =================================================================================================================== */
const S9 = { love: F("here's the part"), keep: F('they keep watch'), dl: F('my deadlines'), repos: F('my repos'), news: F('the news'), house: F('even my house'),
  decide: F('then they decide'), brief: F('a morning briefing'), msg: F('a quick message'), call: F('or a phone call'), say6: F('i can even say'),
  at6: F('and at six'), six2: F('six', 1), calls: F('it calls'), caught: F('already caught up'), last: F('last night') };
const WC = [['Thesis draft', 'due Friday', NB.yellow], ['CI failed', 'on main', NB.orange], ['Battery news', '3 new stories', NB.sky], ['Garage door', 'open since 9 pm', NB.pink]];
const WX = j => 330 + j * 420, LANE = [[340, 'Morning briefing', NB.cream], [960, 'Quick message', NB.mint], [1580, 'Phone call', NB.violet]];
(() => {
  const w = shot('s9');
  // Mimo keeps watch: a pulse goes out, and four empty slots wait for what it finds
  put(w, [0, 1, 2].map(j => `<div class="rad9" style="left:${960 - 260}px;top:${300 - 260}px;width:520px;height:520px;border-radius:50%;border:8px solid ${NB.purple}"></div>`).join(''));
  put(w, tileH('mimo', 960, 300, 320, 't9mimo', { e: 'e16' }));
  LANE.forEach(([x, t, c], j) => put(w, `<div class="slab e12 ln9" id="ln${j}" style="left:${x - 290}px;top:1060px;width:580px;height:620px;background:${c}"><div class="hd" style="left:0;top:34px;width:570px;text-align:center;font-size:52px;line-height:62px">${t}</div></div>`));
  WC.forEach((c, j) => put(w, `<div class="slot9" style="left:${WX(j) - 190}px;top:620px;width:380px;height:240px;border:7px dashed ${INK};border-radius:30px;opacity:.5"></div>`));
  WC.forEach(([t, d, c], j) => put(w, `<div class="slab e12 wc9" id="wc${j}" style="left:${WX(j) - 190}px;top:620px;width:380px;height:240px;background:${c};border-radius:30px">` +
    `<div class="hd" style="left:30px;top:44px;font-size:50px;line-height:60px">${t}</div><div class="tx" style="left:30px;top:124px;font-size:36px;line-height:46px;color:#3A3644">${d}</div></div>`));
  // "Call me at six."
  put(w, `<div class="bub e8" id="cm9" style="left:480px;top:1960px;background:${NB.purple};color:#fff;font-size:64px;line-height:78px;border-radius:30px 30px 8px 30px;padding:22px 40px">Call me at six.</div>` +
    `<div class="slab e12" id="clk9" style="left:420px;top:2200px;width:520px;height:250px;background:#14121A;border-radius:40px"><div class="hd" id="clkA" style="left:0;top:50px;width:510px;text-align:center;font-size:130px;line-height:140px;color:#FFFDF5">5:59</div>` +
    `<div class="hd" id="clkB" style="left:0;top:50px;width:510px;text-align:center;font-size:130px;line-height:140px;color:${NB.lime}">6:00</div></div>` +
    `<div class="slab e16" id="ph9" style="left:1180px;top:1880px;width:460px;height:880px;border-radius:64px;background:#14121A"><div style="left:20px;top:20px;width:410px;height:830px;border-radius:48px;background:${NB.sky};overflow:hidden">` +
    avH('mimo', 115, 110, 180, '', { e: 'e6' }) + `<div class="hd" style="left:0;top:320px;width:410px;text-align:center;font-size:56px;line-height:64px">Mimo</div>` +
    `<div class="tx" id="ph9s" style="left:0;top:392px;width:410px;text-align:center;font-size:32px;line-height:40px">calling</div>` +
    `<div class="tx" id="ph9l" style="left:0;top:392px;width:410px;text-align:center;font-size:32px;line-height:40px">00:04</div>` +
    `<div class="btn3 e6" id="ph9a" style="left:120px;top:640px;width:170px;height:96px;background:${NB.lime};font-size:36px;line-height:86px">Answer</div>` +
    waveH('pw9', 80, 520, 14, INK, 60, 18, 9) + `</div></div>` +
    `<div class="bub e8" id="cu9" style="left:1720px;top:2180px;background:#fff;font-size:44px;line-height:58px;border-radius:30px 30px 30px 8px">Morning! CI is green again,\nand your draft is due Friday.</div>`);
  ['#ring9a', '#ring9b'].forEach(id => put(w, `<div id="${id.slice(1)}" style="left:1210px;top:1910px;width:400px;height:820px;border-radius:70px;border:8px solid ${NB.purple}"></div>`));
})();
cam('s9', [
  [S9.love, 760, 360, 1.3, 6, 16],
  [S9.love + 14, 960, 330, 1.34, 6, -6, 'snapSettle'],
  [S9.keep - 4, 960, 335, 1.38, 6, -6, 'cruise'],
  [S9.keep + 14, 960, 500, .98, 10, -6, 'softInOut'],
  [S9.dl - 6, 960, 560, .98, 10, -4, 'softInOut'],
  [S9.house + 10, 960, 580, 1.0, 10, -4, 'cruise'],
  [S9.decide + 10, 960, 900, .72, 14, -6, 'softInOut'],
  [S9.call + 20, 960, 920, .74, 14, -6, 'cruise'],
  [S9.say6 + 2, 1180, 2280, .82, 10, 6, 'whip'],
  [S9.at6 - 4, 1180, 2290, .84, 10, 4, 'cruise'],
  [S9.calls + 6, 1360, 2320, .92, 8, -6, 'softInOut'],
  [S9.last, 1380, 2320, .96, 8, -6, 'cruise'],
]);
/* Here's the part I love. They keep watch, so I don't have to. */
stand('#t9mimo', S9.love + 2, { rx: -70, frames: 11 });
M.kf('#t9mimo img', 'rotation', [[S9.keep, 0], [S9.keep + 10, -10, 'softInOut'], [S9.keep + 30, 10, 'softInOut'], [S9.dl, 0, 'softInOut']]);
$$('.slot9').forEach((el, j) => land(el, S9.keep + 6 + j * 3, { scale: .8 }, 9));
$$('.rad9').forEach((el, j) => { const k = [], o = []; M.show(el, S9.love + 4, S9.decide);
  for (let fr = S9.love + 4 + j * 14; fr < S9.decide; fr += 42) { k.push([fr, .62], [fr + 41, 2.3, 'glide']); o.push([fr, .9], [fr + 41, 0, 'glide']); }
  M.kf(el, 'scale', k); M.kf(el, 'opacity', o); });
sfx(S9.keep, 'chime: keeping watch');
/* My deadlines. My repos. The news. Even my house. */
[S9.dl, S9.repos, S9.news, S9.house].forEach((q, j) => { stand('#wc' + j, q - 3, { rx: -84, frames: 10 }); sfx(q - 1, 'pop: watching'); });
/* Then they decide: a morning briefing, a quick message, or a phone call. */
$$('.ln9').forEach((el, j) => stand(el, S9.decide + 2 + j * 4, { rx: -70, frames: 11 }));
const fly9 = (j, at, lane, slot) => { const tx = LANE[lane][0] - WX(j), ty = 1180 + slot * 150 - 620 + 30;
  M.kf('#wc' + j, 'x', [[at, 0], [at + 12, tx, 'whip']]); M.kf('#wc' + j, 'y', [[at, 0], [at + 12, ty, 'whip']]);
  M.kf('#wc' + j, 'rotation', [[at, 0], [at + 6, (tx > 0 ? 8 : -8)], [at + 12, slot % 2 ? 3 : -3, 'whip']]); sfx(at + 12, 'snap: sorted'); };
fly9(2, S9.brief + 4, 0, 0); fly9(1, S9.brief + 10, 0, 1); fly9(0, S9.msg + 4, 1, 0); fly9(3, S9.call + 4, 2, 0);
/* I can even say, "Call me at six." And at six, it calls. Already caught up. */
land('#cm9', F('call me') - 4, { scale: .5, y: 40 }, 10, 'popOver'); sfx(F('call me') - 2, 'pop: call me at six');
stand('#clk9', S9.say6 + 4, { rx: -70, frames: 10 });
M.kf('#clkA', 'y', [[S9.six2 - 4, 0], [S9.six2 + 2, -120, 'gentleIn']]); M.hide('#clkA', S9.six2 + 2);
land('#clkB', S9.six2 - 1, { y: 120 }, 9); sfx(S9.six2, 'tick: six');
M.enter('#ph9', { at: S9.six2 + 4, frames: 12, ease: 'softLand', from: { y: 900, rotation: 10 }, to: { rotation: 4 } });
['#ring9a', '#ring9b'].forEach((el, n) => { const k = [], o = []; M.show(el, S9.calls - 4, S9.caught - 6);
  for (let fr = S9.calls - 4 + n * 10; fr < S9.caught - 6; fr += 20) { k.push([fr, 1], [fr + 19, 1.25, 'glide']); o.push([fr, .9], [fr + 19, 0, 'glide']); }
  M.kf(el, 'scale', k); M.kf(el, 'opacity', o); });
M.kf('#ph9', 'x', [[S9.calls, 0], [S9.calls + 2, -9], [S9.calls + 4, 9], [S9.calls + 6, -7], [S9.calls + 8, 7], [S9.calls + 10, 0]]);
sfx(S9.calls, 'chime: phone rings');
const ans9 = S9.caught - 6;
push('#ph9a', ans9, 6); M.hide('#ph9a', ans9 + 4); M.hide('#ph9s', ans9 + 4); M.show('#ph9l', ans9 + 4);
M.show('.pw9', ans9 + 4); wave('.pw9', ans9 + 4, S9.last, 3);
stand('#cu9', S9.caught + 2, { rx: -70, frames: 10, origin: '0% 100%' });
