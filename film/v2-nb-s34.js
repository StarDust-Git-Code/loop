/* ===================================================================================================================
   SCENE 3: Setup? One command. A free model key. Scan a code. Done. And if a model goes down mid-sentence?
   The next one picks it right up. All on free tiers.
   =================================================================================================================== */
const S3 = { setup: F('setup'), cmd: F('one command'), key: F('a free model key'), scan: F('scan a code'), done: F('done'), down: F('and if a model'),
  downW: F('down'), next: F('the next one'), picks: F('picks it right'), free: F('all on free'), talk: F('i talk to them') };
(() => {
  const w = shot('s3');
  put(w, winH('term', 360, 250, 1200, 580, 'Terminal', NB.yellow,
    `<div class="cd" id="tmCmd" style="left:52px;top:118px;font-size:44px;line-height:56px;color:#FFFDF5">$ cd backend &amp;&amp; ./install.sh</div><i id="tmCaret" style="left:52px;top:122px;width:22px;height:48px;background:${NB.lime}"></i>` +
    ['Service registered, restarts by itself', 'Added the loopmates command', 'Opening the setup page'].map((t, j) =>
      `<div class="cd tmo" style="left:52px;top:${214 + j * 74}px;font-size:36px;line-height:50px;color:#FFFDF5"><span style="position:static;color:${NB.lime}">✓</span> ${t}</div>`).join(''), { fill: '#1C1926' }));
  put(w, winH('setupW', 2000, 250, 1200, 580, 'Loopmates setup', NB.lime,
    `<div class="tl" style="left:56px;top:116px;font-size:36px;line-height:46px">Gemini API key</div><div class="fld e4" style="left:56px;top:170px;width:1000px;height:100px"></div>` +
    `<div class="cd" id="keyTxt" style="left:90px;top:194px;font-size:44px;line-height:54px;color:${INK}">AIza••••••••••••••••7Qc</div>` + okH(1080, 180, 80, 'keyOk') +
    `<div class="tl" style="left:56px;top:300px;font-size:34px;line-height:44px">A free key from Google AI Studio is enough.</div>` +
    `<div class="btn3 e8" id="keySave" style="left:56px;top:400px;width:260px;height:84px;background:${NB.purple};color:#fff">Save</div>`));
  put(w, winH('pairW', 3640, 250, 1200, 580, 'Pair your dashboard', NB.pink,
    `<div class="tl" style="left:56px;top:116px;font-size:34px;line-height:44px">Enter this code when your dashboard asks.</div>` +
    [...'4KQ27M'].map((c, j) => `<div class="fld e6 pc" style="left:${56 + j * 120 + (j > 2 ? 40 : 0)}px;top:210px;width:100px;height:140px;background:#fff"><div class="hd" style="left:0;top:20px;width:92px;text-align:center;font-size:84px;line-height:96px">${c}</div></div>`).join('') +
    `<div class="tl" style="left:56px;top:420px;font-size:30px;line-height:40px">Valid for 10 minutes.</div>`));
  // my phone reads the code
  put(w, `<div class="slab e12" id="phone3" style="left:4530px;top:340px;width:330px;height:640px;border-radius:52px;background:#14121A">` +
    `<div style="left:16px;top:16px;width:288px;height:598px;border-radius:38px;background:#FFFDF5;overflow:hidden">` +
    `<div class="hd" style="left:0;top:70px;width:288px;text-align:center;font-size:30px;line-height:38px">Loopmates</div>` +
    `<div id="vf" style="left:34px;top:150px;width:220px;height:220px;border:6px dashed ${NB.purple};border-radius:26px"></div>` +
    `<div class="hd" id="vfCode" style="left:0;top:228px;width:288px;text-align:center;font-size:44px;line-height:56px">4KQ 27M</div>` +
    okH(104, 420, 80, 'vfOk') + `</div></div>`);
  put(w, `<div class="stk e16" id="doneStk" style="left:3850px;top:560px;width:560px;background:${NB.lime};font-size:170px;line-height:220px">Done.</div>`);
  // the reply that survives a model going down
  put(w, winH('fbW', 300, 1640, 1320, 640, 'Chat', NB.sky,
    avH('mimo', 50, 118, 110, 'fbAv') +
    `<div class="tx" id="strm" style="left:190px;top:122px;width:1080px;font-size:44px;line-height:62px">Here's your week.\nMonday: finish the landing page.\nTuesday: two lab sessions and a\nlong walk. Wednesday stays free.</div><i id="strmC" style="left:190px;top:128px;width:6px;height:52px;background:${NB.purple}"></i>`));
  const chip = (id, bg, t, strike) => `<div class="slab e8" id="${id}" style="left:1180px;top:1570px;width:300px;height:96px;background:${bg};border-radius:20px"><div class="hd" style="left:0;top:16px;width:290px;text-align:center;font-size:46px;line-height:56px${strike ? ';text-decoration:line-through;text-decoration-thickness:6px' : ''}">${t}</div></div>`;
  put(w, chip('chipG', NB.blue, 'Gemini') + chip('chipGx', NB.red, 'Gemini', 1) + chip('chipQ', NB.orange, 'Groq') +
    `<div class="tx" id="downTx" style="left:1200px;top:1500px;font-size:34px;line-height:44px;color:#D23A2C">rate limited</div>`);
  const PROV = [['Gemini', NB.blue, 300], ['Groq', NB.orange, 240], ['Cerebras', NB.pink, 320], ['NVIDIA NIM', NB.mint, 380], ['OpenRouter', NB.violet, 380]];
  let px = 960 - (PROV.reduce((a, p) => a + p[2], 0) + 4 * 40) / 2;
  PROV.forEach(([t, c, wd]) => { put(w, `<div class="slab e10 prv" style="left:${px}px;top:2420px;width:${wd}px;height:120px;background:${c};border-radius:24px"><div class="hd" style="left:0;top:26px;width:${wd - 10}px;text-align:center;font-size:52px;line-height:62px">${t}</div></div>` +
    `<div class="stk e6 frs" style="left:${px + wd - 140}px;top:2364px;width:150px;background:#fff;font-size:44px;line-height:64px;padding:0">free</div>`); px += wd + 40; });
})();
cam('s3', [
  [S3.setup, 700, 540, 1.1, 8, 16],
  [S3.setup + 14, 960, 540, 1.12, 8, -6, 'snapSettle'],
  [S3.key - 6, 990, 545, 1.16, 7, -6, 'cruise'],
  [S3.key + 6, 2600, 540, 1.14, 6, -8, 'whip'],
  [S3.scan - 6, 2630, 545, 1.16, 6, -8, 'cruise'],
  [S3.scan + 6, 4260, 600, 1.0, 6, -10, 'whip'],
  [S3.done + 2, 4270, 610, 1.04, 5, -9, 'cruise'],
  [S3.done + 10, 4250, 640, 1.10, 4, -6, 'snapSettle'],
  [S3.down - 4, 4250, 640, 1.12, 4, -6, 'cruise'],
  [S3.down + 8, 960, 1960, 1.1, 8, 6, 'whip'],
  [S3.free - 4, 980, 1980, 1.12, 8, 4, 'cruise'],
  [S3.free + 14, 960, 2180, .74, 14, -6, 'softLand'],
  [S3.talk, 960, 2200, .76, 13, -8, 'cruise'],
]);
/* One command. */
const tmEnd = typeFast('#tmCmd', S3.cmd - 4, { cpf: 3, caret: '#tmCaret' }); M.hide('#tmCaret', tmEnd + 3);
$$('.tmo').forEach((el, j) => { land(el, tmEnd + 4 + j * 5, { x: -40 }, 8); sfx(tmEnd + 4 + j * 5, 'tick: install step'); });
/* A free model key. (pasted in one go, then checked) */
stand('#setupW', S3.key - 10, { rx: -60, frames: 12 });
land('#keyTxt', S3.key + 6, { x: -20 }, 6); sfx(S3.key + 6, 'tick: paste');
land('#keyOk', F('key') + 6, { scale: .3 }, 9, 'popOver'); sfx(F('key') + 7, 'tick: key works');
push('#keySave', F('key') + 10, 8);
/* Scan a code. */
$$('.pc').forEach((el, j) => stand(el, S3.scan - 8 + j * 2, { rx: -80, frames: 9 }));
M.enter('#phone3', { at: S3.scan + 2, frames: 12, ease: 'softLand', from: { y: 700, rotation: 14 }, to: { rotation: 7 } });
land('#vfCode', F('code') + 4, { scale: 1.3 }, 7, 'snapSettle'); land('#vfOk', F('code') + 9, { scale: .3 }, 9, 'popOver'); sfx(F('code') + 10, 'tick: paired');
/* Done. */
slap('#doneStk', S3.done - 2, -6, 2.6, 12); sfx(S3.done, 'success: done');
/* And if a model goes down mid-sentence? The next one picks it right up. */
stand('#fbW', S3.down - 2, { rx: -50, frames: 10 });
land('#chipG', S3.down + 2, { y: -40, rotation: -6 }, 10);
(() => {
  const n1 = 54, N = [...$$('#strm')[0].textContent].length, ev = [];
  let s = 0, fr = 0; while (s < n1) { s = Math.min(n1, s + 2); ev.push([fr++, s]); }
  fr = Math.max(fr + 1, S3.picks - (S3.down + 6));
  while (s < N) { s = Math.min(N, s + 2); ev.push([fr++, s]); }
  M.type('#strm', { at: S3.down + 6, events: ev, caret: '#strmC', caretGap: 8 });
})();
M.show('#chipGx', S3.downW, S3.next + 2); M.hide('#chipG', S3.downW);
M.kf('#chipGx', 'rotation', [[S3.downW, 0], [S3.downW + 2, -9, 'glide'], [S3.downW + 4, 7, 'glide'], [S3.downW + 6, -4, 'glide'], [S3.downW + 9, -3, 'glide']]);
M.show('#downTx', S3.downW + 2, S3.next + 2); sfx(S3.downW, 'snap: model down');
M.kf('#chipGx', 'x', [[S3.next, 0], [S3.next + 8, 420, 'accelExit']]);
M.enter('#chipQ', { at: S3.next + 2, frames: 11, ease: 'snapSettle', from: { x: -420, rotation: -16, scale: 1.3 }, to: { rotation: -3 } }); sfx(S3.next + 4, 'pop: next model');
/* All on free tiers. */
$$('.prv').forEach((el, j) => stand(el, S3.free - 4 + j * 3, { rx: -80, frames: 10 }));
$$('.frs').forEach((el, j) => slap(el, F('free', 1) + 2 + j * 3, j % 2 ? 7 : -6, 2.2, 10));

/* ===================================================================================================================
   SCENE 4: I talk to them like a team. "Hey Research, what's new in solar batteries?" Sources and all. Mimo's the leader.
   It hands the work to whoever fits. Stuck on an idea? They argue it out! Everyone picks a side.
   And when I need real numbers, Data writes actual Python. No guessing.
   =================================================================================================================== */
const S4 = { talk: F('i talk to them'), hey: F('hey research'), batt: F('batteries'), src: F('sources and all'), leader: F("mimo's the leader"),
  hands: F('it hands the work'), stuck: F('stuck on an idea'), argue: F('they argue it'), side: F('everyone picks a side'),
  nums: F('and when i need real'), data: F('data writes'), guess: F('no guessing'), fun: F('now the fun part') };
(() => {
  const w = shot('s4');
  put(w, winH('chat4', 260, 110, 1400, 880, 'Chat', NB.sky,
    ['mimo', 'research', 'code', 'writer', 'data'].map((k, j) => avH(k, 34, 108 + j * 124, 100, 'rail' + j)).join('') +
    `<i style="left:168px;top:74px;width:5px;height:801px;background:${INK}"></i>` +
    `<div class="bub e6" id="myQ" style="left:520px;top:104px;background:${NB.purple};color:#fff;border-radius:26px 26px 6px 26px">@Research what's new in solar batteries?</div>` +
    avH('research', 206, 246, 92, 'rAv') +
    `<div class="bub e6" id="rAns" style="left:316px;top:240px;background:#fff;border-radius:26px 26px 26px 6px;font-size:36px;line-height:50px">Sodium-ion packs are reaching home storage,\nand prices kept falling again this year.</div>` +
    ['iea.org', 'nature.com', 'pv-magazine.com'].map((t, j) => `<div class="slab e6 srcC" style="left:${316 + [0, 250, 540][j]}px;top:420px;width:${[230, 270, 360][j]}px;height:80px;background:${NB.yellow};border-radius:18px"><div class="tx" style="left:22px;top:16px;font-size:34px;line-height:44px">↗ ${t}</div></div>`).join('') +
    `<div class="fld e6" style="left:210px;top:740px;width:1150px;height:104px"></div>` +
    `<div class="tx" id="cmp" style="left:244px;top:766px;font-size:40px;line-height:52px">@Research what's new in solar batteries?</div><i id="cmpC" style="left:244px;top:768px;width:6px;height:50px;background:${NB.purple}"></i>` +
    `<div class="btn3 e6" id="sendB" style="left:1210px;top:756px;width:130px;height:72px;font-size:30px;line-height:62px;background:${NB.purple};color:#fff">Send</div>`));
  // the leader hands out the work
  put(w, tileH('mimo', 960, 1800, 330, 't4mimo', { e: 'e16' }) +
    `<div class="stk e8" id="leadStk" style="left:1060px;top:1600px;width:250px;background:${NB.lime};font-size:56px;line-height:80px">Leader</div>` +
    tileH('writer', 420, 2210, 230, 't4writer') + tileH('data', 960, 2290, 230, 't4data') + tileH('code', 1500, 2210, 230, 't4code'));
  [['Write the summary', 420, 2030, NB.yellow], ['Chart the prices', 960, 2108, NB.teal], ['Update the page', 1500, 2030, NB.orange]].forEach(([t, x, y, c], j) =>
    put(w, `<div class="slab e8 task" id="task${j}" style="left:${x - 200}px;top:${y - 44}px;width:400px;height:88px;background:${c};border-radius:18px"><div class="tx" style="left:0;top:16px;width:390px;text-align:center;font-size:38px;line-height:50px">${t}</div></div>`));
  // they argue it out
  put(w, `<div class="slab e12" id="idea" style="left:2520px;top:1460px;width:1160px;height:150px;background:${NB.cream};border-radius:30px"><div class="hd" style="left:0;top:34px;width:1150px;text-align:center;font-size:66px;line-height:76px">Launch on Friday or Monday?</div></div>`);
  const ARG = [['spark', 'Friday. Ride the buzz.', 0], ['planner', 'Monday. Fix the bugs first.', 1], ['writer', 'Friday. The post is ready.', 0], ['halo', 'Monday is safer.', 1]];
  ARG.forEach(([k, t, side], j) => { const y = 1690 + j * 140;
    put(w, `<div id="arg${j}" style="left:${side ? 3020 : 2540}px;top:${y}px;width:640px;height:120px">` + avH(k, side ? 520 : 0, 6, 104, '', { e: 'e6' }) +
      `<div class="bub e6" style="${side ? 'right:136px' : 'left:136px'};top:10px;font-size:36px;line-height:46px;padding:16px 26px;background:${side ? NB.sky : NB.yellow};border-radius:${side ? '24px 24px 6px 24px' : '24px 24px 24px 6px'}">${t}</div></div>`); });
  put(w, `<i id="argLine" style="left:3094px;top:1650px;width:12px;height:610px;background:${INK};border-radius:6px"></i>` +
    `<div class="stk e8" id="sideF" style="left:2560px;top:2280px;width:280px;background:${NB.yellow};font-size:60px;line-height:84px">Friday</div>` +
    `<div class="stk e8" id="sideM" style="left:3360px;top:2280px;width:300px;background:${NB.sky};font-size:60px;line-height:84px">Monday</div>`);
  // Data writes actual Python
  put(w, tileH('data', 2250, 600, 290, 't4d2', { e: 'e12' }) +
    winH('py', 2440, 220, 1000, 620, 'analysis.py', NB.teal,
      `<div class="cd" id="pyCode" style="left:46px;top:120px;font-size:38px;line-height:62px;color:#FFFDF5"><span style="position:static;color:${NB.pink}">import</span> pandas <span style="position:static;color:${NB.pink}">as</span> pd
df = pd.read_csv(<span style="position:static;color:${NB.yellow}">"prices.csv"</span>)
by_year = df.groupby(<span style="position:static;color:${NB.yellow}">"year"</span>).kwh.mean()
by_year.plot.bar()</div><i id="pyC" style="left:46px;top:124px;width:20px;height:50px;background:${NB.lime}"></i>` +
      `<div class="cd" id="pyOut" style="left:46px;top:410px;font-size:34px;line-height:50px;color:${NB.lime}">✓ ran in 0.4 s, 2,160 rows</div>`, { fill: '#1C1926' }) +
    `<div class="slab e12" id="chart" style="left:3520px;top:220px;width:640px;height:620px;background:#fff"><div class="tl" style="left:36px;top:30px;font-size:32px;line-height:40px">Average price per kWh</div>` +
    [312, 268, 226, 190, 152].map((h, j) => `<div class="slab bar" style="left:${44 + j * 114}px;top:${548 - h}px;width:84px;height:${h}px;border-radius:12px;background:${j === 4 ? NB.lime : NB.teal};border-width:4px;transform-origin:50% 100%"></div>`).join('') +
    ['2020', '2021', '2022', '2023', '2024'].map((t, j) => `<div class="tl" style="left:${36 + j * 114}px;top:560px;width:100px;text-align:center;font-size:26px;line-height:34px">${t}</div>`).join('') +
    `<div class="hd" id="barV" style="left:372px;top:318px;width:260px;text-align:center;font-size:52px;line-height:60px">$118</div></div>`);
})();
cam('s4', [
  [S4.talk, 720, 560, 1.06, 6, 16],
  [S4.talk + 14, 960, 550, 1.12, 6, -6, 'snapSettle'],
  [S4.hey - 4, 960, 560, 1.14, 6, -6, 'cruise'],
  [S4.hey + 14, 930, 640, 1.2, 5, -4, 'softLand'],
  [S4.batt + 10, 935, 645, 1.22, 5, -4, 'cruise'],
  [S4.src - 6, 960, 470, 1.24, 5, -5, 'softInOut'],
  [S4.leader - 6, 960, 476, 1.26, 5, -5, 'cruise'],
  [S4.leader + 8, 960, 2000, .98, 12, 6, 'whip'],
  [S4.stuck - 6, 960, 2010, 1.0, 12, 5, 'cruise'],
  [S4.stuck + 8, 3100, 1880, 1.0, 9, -8, 'whip'],
  [S4.side + 12, 3100, 1900, 1.02, 9, -6, 'cruise'],
  [S4.nums - 2, 3100, 1890, 1.02, 9, -6, 'cruise'],
  [S4.nums + 12, 3160, 540, .92, 10, 6, 'whip'],
  [S4.guess - 6, 3200, 545, .95, 9, 4, 'cruise'],
  [S4.guess + 8, 3640, 545, 1.18, 6, -8, 'softLand'],
  [S4.fun, 3660, 545, 1.2, 6, -8, 'cruise'],
]);
/* I talk to them like a team. */
for (let j = 0; j < 5; j++) land('#rail' + j, S4.talk + 2 + j * 3, { x: -60, scale: .7 }, 9, 'popOver');
/* "Hey Research, what's new in solar batteries?" */
const cmpEnd = typeSpoken('#cmp', "hey research what's new in solar batteries", { map: [1, 2, 3, 4, 5, 6], caret: '#cmpC', early: 2 });
push('#sendB', cmpEnd + 6, 6);
M.hide('#cmp', cmpEnd + 8); M.hide('#cmpC', cmpEnd + 8);
land('#myQ', cmpEnd + 8, { y: 560, scale: .9 }, 10);
/* Sources and all. */
land('#rAv', S4.src - 12, { scale: .4 }, 9, 'popOver'); stand('#rAns', S4.src - 10, { rx: -70, frames: 10, origin: '0% 100%' });
$$('.srcC').forEach((el, j) => slap(el, S4.src + j * 4, [-4, 3, -2][j], 1.8, 9));
/* Mimo's the leader. It hands the work to whoever fits. */
stand('#t4mimo', S4.leader + 2, { rx: -70, frames: 11 }); slap('#leadStk', F('leader') + 2, 8, 2.4);
['#t4writer', '#t4data', '#t4code'].forEach((s, j) => stand(s, S4.hands - 6 + j * 3, { rx: -80, frames: 10 }));
[[420, 2030], [960, 2108], [1500, 2030]].forEach(([x, y], j) => { const a = S4.hands + 6 + j * 6, b = a + 14;
  M.show('#task' + j, a);
  M.kf('#task' + j, 'x', [[a, 960 - x], [b, 0, 'whip']]); M.kf('#task' + j, 'y', [[a, 1800 - y], [b, 0, 'whip']]);
  M.kf('#task' + j, 'scale', [[a, .3], [b, 1, 'whip']]); M.kf('#task' + j, 'rotation', [[a, (j - 1) * -20], [b, (j - 1) * 4, 'whip']]);
  hop(['#t4writer img', '#t4data img', '#t4code img'][j], b, 26, 12); sfx(b, 'pop: handed over'); });
/* Stuck on an idea? They argue it out! Everyone picks a side. */
stand('#idea', S4.stuck, { rx: -70, frames: 11 });
[0, 1, 2, 3].forEach(j => { const a = S4.argue - 4 + j * 8; M.enter('#arg' + j, { at: a, frames: 9, ease: 'snapSettle', from: { scale: .5, rotation: j % 2 ? 5 : -5 } }); sfx(a + 1, 'pop: an opinion'); });
M.enter('#argLine', { at: S4.side - 2, frames: 10, ease: 'softLand', from: { scaleY: .03 }, to: { scaleY: 1 } });
[0, 1, 2, 3].forEach(j => M.kf('#arg' + j, 'x', [[S4.side, 0], [S4.side + 10, j % 2 ? 60 : -60, 'softLand']]));
slap('#sideF', S4.side + 4, -5, 2); slap('#sideM', S4.side + 8, 5, 2);
/* And when I need real numbers, Data writes actual Python. No guessing. */
stand('#t4d2', S4.nums + 4, { rx: -80, frames: 10 }); stand('#py', S4.nums + 6, { rx: -60, frames: 11 });
const pyEnd = typeFast('#pyCode', S4.data - 10, { cpf: 3, caret: '#pyC', nl: true }); M.hide('#pyC', pyEnd + 2);
land('#pyOut', pyEnd + 3, { x: -30 }, 8); sfx(pyEnd + 3, 'tick: ran');
stand('#chart', pyEnd - 6, { rx: -70, frames: 11 });
$$('.bar').forEach((el, j) => M.enter(el, { at: pyEnd + 2 + j * 3, frames: 10, ease: 'softLand', from: { scaleY: .05 }, to: { scaleY: 1 } }));
land('#barV', S4.guess - 4, { y: 30 }, 8); M.count('#barV', { at: S4.guess - 4, from: 300, to: 118, frames: 16, round: true, format: v => '$' + v });
sfx(S4.guess + 12, 'tick: the number');
