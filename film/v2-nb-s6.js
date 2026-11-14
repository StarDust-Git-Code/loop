/* ===================================================================================================================
   SCENE 6: And they don't just talk. They do things. Eighty-six tools! Search the web, read my files, set a reminder,
   kick off a run. Browser opens a real browser, reads the page, fills in the form... and stops dead at the password field.
   That one's mine. Same job every week? I describe it in one sentence, and Flow draws the whole pipeline. Drag a step.
   Swap a Mate. Save. Every Monday, nine sharp, it just runs. Missing a tool? Plug in an MCP server. Same Mates, brand new hands.
   =================================================================================================================== */
const S6 = { talk: F("and they don't just"), doW: F('they do things'), t86: F('eighty-six'), search: F('search the web'), read: F('read my files'),
  remind: F('set a reminder'), kick: F('kick off a run'), browser: F('browser opens'), reads: F('reads the page'), fills: F('fills in the form'),
  stops: F('and stops dead'), pw: F('password field'), mine: F("that one's mine"), same: F('same job every'), desc: F('i describe it'),
  flowW: F('and flow draws'), pipe: F('pipeline'), drag: F('drag a step'), swap: F('swap a mate'), save: F('save'), monday: F('every monday'),
  nine: F('nine sharp'), runs: F('it just runs'), missing: F('missing a tool'), plug: F('plug in an'), mcp: F('mcp'), hands: F('same mates brand'),
  what: F('what did i decide') };
const TOOLS = ['Search the web', 'Open a page', 'Click', 'Fill a form', 'Read a file', 'Write a file', 'List files', 'Run a command', 'Run Python', 'Search Knowledge',
  'Remember', 'Recall', 'Add an event', 'Read my calendar', 'Set a reminder', 'Start a run', 'Pause a run', 'Stop a run', 'Ask a Mate', 'Keep watch',
  'Post in Slack', 'Draft an email', 'Add a to-do', 'Open an issue', 'Make a playlist', 'Read a feed', 'Get a transcript', 'Sleep summary', 'Lights', 'Garage door'];
const TCOL = [NB.yellow, NB.sky, NB.pink, NB.mint, NB.violet, NB.orange, NB.blue, NB.peach, NB.teal];
(() => {
  const w = shot('s6');
  // they talk...
  [['mimo', 'Sure, on it.'], ['writer', 'Good idea!'], ['research', 'Let me look.']].forEach(([k, t], j) => put(w,
    `<div id="tb${j}" style="left:${560 + j * 120}px;top:${330 + j * 150}px;width:700px;height:130px">` + avH(k, 0, 8, 110, '', { e: 'e6' }) +
    `<div class="bub e6" style="left:140px;top:10px;font-size:44px;line-height:56px;background:${[NB.sky, NB.yellow, '#fff'][j]};border-radius:26px 26px 26px 6px">${t}</div></div>`));
  // ...they do things: a wall of 86 tools
  let wall = '';
  for (let i = 0; i < 86; i++) { const c = i % 10, r = Math.floor(i / 10), t = TOOLS[(i * 7) % TOOLS.length];
    wall += `<div class="slab e4 tch" style="left:${70 + c * 182}px;top:${150 + r * 92}px;width:166px;height:74px;border-width:4px;border-radius:14px;background:${TCOL[(i * 5) % TCOL.length]}"><div class="tx" style="left:0;top:20px;width:158px;text-align:center;font-size:20px;line-height:26px;overflow:hidden">${t}</div></div>`; }
  put(w, `<div id="wall" style="left:0;top:0;width:1920px;height:1080px">${wall}</div>` +
    `<div class="stk e16" id="n86" style="left:1380px;top:740px;width:330px;background:${NB.lime};font-size:150px;line-height:200px">86</div>`);
  [['Search the web', '12 results, 3 read', NB.yellow], ['Read my files', 'notes/launch.md', NB.sky], ['Set a reminder', 'Friday, 6:00 pm', NB.pink], ['Kick off a run', 'Run started', NB.mint]].forEach(([t, d, c], j) =>
    put(w, `<div class="slab e12 big4" id="big${j}" style="left:${[180, 1000, 180, 1000][j]}px;top:${[200, 200, 560, 560][j]}px;width:740px;height:300px;background:${c};border-radius:32px">` +
      `<div class="hd" style="left:44px;top:50px;font-size:76px;line-height:88px">${t}</div><div class="tx" style="left:46px;top:170px;font-size:42px;line-height:54px;color:#3A3644">${d}</div>` + okH(610, 168, 86, '', 'bk4') + `</div>`));
  // Browser opens a real browser
  put(w, tileH('browser', 2480, 1840, 240, 't6br', { e: 'e12' }) +
    `<div class="slab e16" id="brW" style="left:2660px;top:1300px;width:1500px;height:1000px;background:#fff">` +
    `<div style="left:0;top:0;width:1490px;height:96px;border-bottom:5px solid ${INK};border-radius:22px 22px 0 0;background:${NB.peach}"></div>` +
    [0, 1, 2].map(j => `<div style="left:${30 + j * 44}px;top:32px;width:30px;height:30px;border-radius:50%;border:4px solid ${INK};background:#fff"></div>`).join('') +
    `<div class="fld" style="left:180px;top:20px;width:1260px;height:58px;border-radius:29px"></div><div class="cd" id="url6" style="left:216px;top:28px;font-size:30px;line-height:40px">courts.cityleisure.org/book</div>` +
    `<div class="hd" style="left:0;top:136px;width:1490px;text-align:center;font-size:62px;line-height:72px">Book a tennis court</div>` +
    ['Courts open 7 am to 10 pm. Bring your own racket.', 'Members book up to 7 days ahead.', 'Cancel free until 2 hours before.'].map((t, j) =>
      `<div class="tx rd6" style="left:0;top:${236 + j * 54}px;width:1490px;text-align:center;font-size:34px;line-height:44px;color:#4A4652">${t}</div>`).join('') +
    `<div id="scan6" style="left:245px;top:226px;width:1000px;height:64px;background:${NB.lime};opacity:.55;border-radius:10px"></div>` +
    [['Name', 'Alex Rivera'], ['Email', 'alex@rivera.me'], ['Date', 'Saturday, 10:00']].map(([l, v], j) =>
      `<div class="tl" style="left:60px;top:${430 + j * 128}px;font-size:30px;line-height:40px">${l}</div><div class="fld" style="left:280px;top:${414 + j * 128}px;width:820px;height:84px"></div>` +
      `<div class="tx ff6" id="ff${j}" style="left:310px;top:${434 + j * 128}px;font-size:38px;line-height:46px">${v}</div>`).join('') +
    `<div class="tl" style="left:60px;top:${430 + 3 * 128}px;font-size:30px;line-height:40px">Password</div><div class="fld" id="pwF" style="left:280px;top:${414 + 3 * 128}px;width:820px;height:84px"></div>` +
    `<div class="tx" id="pwDots" style="left:310px;top:${430 + 3 * 128}px;font-size:46px;line-height:52px;letter-spacing:6px">••••••••••</div>` +
    `<div class="stk e10" id="pwStk" style="left:1130px;top:770px;width:330px;background:${NB.yellow};font-size:46px;line-height:70px;transform-origin:0 50%">Your turn.</div></div>` +
    `<svg id="brCur" style="left:0;top:0;width:52px;height:70px;overflow:visible;z-index:50" viewBox="0 0 46 62"><path d="M3 3v44l12-11 8 19 8-4-8-18h17z" fill="${NB.peach}" stroke="#14121A" stroke-width="4" stroke-linejoin="round"/></svg>` + curH('cur6'));
})();
cam('s6', [
  [S6.talk, 760, 560, 1.06, 6, 16],
  [S6.talk + 14, 960, 560, 1.1, 6, -6, 'snapSettle'],
  [S6.doW - 4, 965, 560, 1.12, 6, -6, 'cruise'],
  [S6.doW + 12, 960, 600, .94, 14, -8, 'softLand'],
  [S6.search - 8, 960, 600, .96, 12, -6, 'cruise'],
  [S6.search + 6, 960, 560, 1.02, 6, -4, 'softInOut'],
  [S6.browser - 6, 965, 560, 1.03, 6, -4, 'cruise'],
  [S6.browser + 8, 3260, 1800, .98, 8, -8, 'whip'],
  [S6.reads + 4, 3330, 1720, .98, 6, -6, 'softInOut'],
  [S6.fills - 2, 3330, 1725, 1.0, 6, -6, 'cruise'],
  [S6.fills + 10, 3300, 1880, 1.08, 6, -4, 'softInOut'],
  [S6.mine + 10, 3300, 1900, 1.12, 6, -4, 'cruise'],
  [S6.same, 3320, 1905, 1.14, 6, -4, 'cruise'],
]);
/* And they don't just talk. */
[0, 1, 2].forEach(j => { land('#tb' + j, S6.talk + j * 5, { scale: .5, rotation: -6 }, 9, 'popOver'); sfx(S6.talk + 1 + j * 5, 'pop: talk'); });
[0, 1, 2].forEach(j => M.exit('#tb' + j, { at: S6.doW - 2 + j * 2, frames: 9, to: { x: -1400, rotation: -14 } }));
/* They do things. Eighty-six tools! */
$$('.tch').forEach((el, i) => { const c = i % 10, r = Math.floor(i / 10); stand(el, S6.doW + 2 + Math.round((r * 10 + c) * .38), { rx: -88, frames: 8 }); });
for (let k = 0; k < 86; k += 9) sfx(S6.doW + 2 + Math.round(k * .38), 'tick: a tool');
slap('#n86', S6.t86 - 2, -6, 2.8, 12); M.count('#n86', { at: S6.doW + 2, from: 1, to: 86, frames: S6.t86 + 8 - S6.doW, round: true });
sfx(S6.t86 + 8, 'success: 86');
/* Search the web, read my files, set a reminder, kick off a run. (the wall steps back; each one is used as it is named) */
M.kf('#wall', 'opacity', [[S6.search - 6, 1], [S6.search + 2, 0, 'glide']]); M.hide('#wall', S6.search + 2);
M.exit('#n86', { at: S6.search - 6, frames: 8, to: { x: 300, rotation: 20 } });
[S6.search, S6.read, S6.remind, S6.kick].forEach((q, j) => { stand('#big' + j, q - 4, { rx: -80, frames: 10 }); land($$('.bk4')[j], q + 10, { scale: .3 }, 8, 'popOver'); sfx(q + 10, 'tick: done'); });
/* Browser opens a real browser, reads the page, fills in the form... */
stand('#t6br', S6.browser - 2, { rx: -80, frames: 10 }); stand('#brW', S6.browser + 2, { rx: -50, frames: 12 });
typeFast('#url6', S6.browser + 8, { cpf: 2 });
M.show('#scan6', S6.reads - 2, S6.fills - 2); M.kf('#scan6', 'y', [[S6.reads - 2, 0], [S6.fills - 4, 108, 'cruise']]);
const ffAt = [S6.fills, S6.fills + 12, F('form') + 8];
$$('.ff6').forEach((el, j) => typeFast(el, ffAt[j], { cpf: 2 }));
M.cursor('#brCur', { keys: [[S6.fills - 10, 3700, 2400, 1.8, -10], [ffAt[0] - 2, 3240, 1748, 1, 0], [ffAt[1] - 2, 3240, 1876, 1, 0], [ffAt[2] - 2, 3240, 2004, 1, 0],
  [S6.stops - 2, 3250, 2010, 1, 0], [S6.pw - 4, 3236, 2130, 1, 0], [S6.pw + 2, 3240, 2134, 1, 0], [S6.pw + 6, 3206, 2160, 1, -8], [S6.mine - 2, 3196, 2172, 1, -10]], ease: 'glide' });
/* ...and stops dead at the password field. */
M.kf('#pwF', 'borderColor', [[S6.pw + 2, INK], [S6.pw + 3, '#E0392B'], [S6.mine - 4, '#E0392B'], [S6.mine - 3, INK]]);
M.kf('#pwF', 'x', [[S6.pw + 2, 0], [S6.pw + 4, -10, 'glide'], [S6.pw + 6, 9, 'glide'], [S6.pw + 8, -5, 'glide'], [S6.pw + 11, 0, 'glide']]);
sfx(S6.pw + 3, 'snap: stops dead');
slap('#pwStk', F('field') + 4, -4, 2.2, 10);
/* That one's mine. (my cursor types it) */
M.cursor('#cur6', { keys: [[S6.mine - 14, 2900, 2500, 2.2, -14], [S6.mine - 2, 3330, 2132, 1, 0], [S6.same, 3334, 2136, 1, 0]], ease: 'glide' });
M.press('#cur6', '#pwF', { at: S6.mine, frames: 3, cursorDepth: .8, targetDepth: 1, lag: 1, release: true });
M.type('#pwDots', { at: S6.mine + 3, events: Array.from({ length: 10 }, (_, k) => [k, k + 1]) });
for (let k = 0; k < 10; k += 3) sfx(S6.mine + 3 + k, 'tick: typing');

/* ---------- Flow: one sentence becomes a pipeline ---------- */
const NODES6 = [['', 'Every Monday', '9:00', NB.yellow], ['scout', 'Scout', 'Check my repos', NB.mint], ['writer', 'Writer', 'Write a summary', NB.blue], ['', 'Send it to me', 'on Telegram', NB.pink]];
const NX = j => 90 + j * 400, NY = 330;
(() => {
  const w = shot('s6b');
  let inner = `<div class="fld e6" style="left:60px;top:110px;width:1340px;height:110px"></div><div class="tx" id="fPrompt" style="left:96px;top:138px;font-size:40px;line-height:52px">Every Monday at 9, check my repos and send me a summary.</div><i id="fC" style="left:96px;top:140px;width:6px;height:50px;background:${NB.purple}"></i>` +
    `<div class="btn3 e8" id="fSave" style="left:1440px;top:118px;width:200px;height:90px;font-size:42px;line-height:80px;background:${NB.lime}">Save</div>`;
  NODES6.forEach(([k, t, d, c], j) => { inner += `<div class="slab e10 nd6" id="nd${j}" style="left:${NX(j)}px;top:${NY}px;width:330px;height:250px;background:${c};border-radius:30px">` +
    (k ? avH(k, 24, 24, 96, 'ndav' + j, { e: 'e4' }) + (j === 2 ? avH('luna', 24, 24, 96, 'ndavS', { e: 'e4' }) : '') : `<div class="hd" style="left:28px;top:30px;font-size:58px;line-height:64px">${j ? '→' : '◷'}</div>`) +
    `<div class="hd" id="ndt${j}" style="left:28px;top:132px;font-size:40px;line-height:46px">${t}</div>` + (j === 2 ? `<div class="hd" id="ndtS" style="left:28px;top:132px;font-size:40px;line-height:46px">Luna</div>` : '') +
    `<div class="tx" style="left:28px;top:184px;font-size:30px;line-height:40px;color:#3A3644">${d}</div>` + okH(232, 24, 72, 'ndok' + j) + `</div>`;
    if (j) inner += `<i class="cn6" id="cn${j}" style="left:${NX(j) - 70}px;top:${NY + 116}px;width:70px;height:16px;background:${INK};border-radius:8px;transform-origin:0 50%"></i>`; });
  inner += `<div class="slab e10" id="ndNew" style="left:${NX(3)}px;top:${NY}px;width:330px;height:250px;background:${NB.yellow};border-radius:30px">` + avH('research', 24, 24, 96, '', { e: 'e4' }) +
    `<div class="hd" style="left:28px;top:132px;font-size:40px;line-height:46px">Research</div><div class="tx" style="left:28px;top:184px;font-size:30px;line-height:40px;color:#3A3644">Add the news</div>` + okH(232, 24, 72, 'ndokN') + `</div>` +
    `<i id="cn4" style="left:${NX(4) - 70}px;top:${NY + 116}px;width:70px;height:16px;background:${INK};border-radius:8px;transform-origin:0 50%"></i>` +
    `<div class="tl" style="left:60px;top:650px;font-size:32px;line-height:42px">Steps</div>` +
    `<div class="slab e6" id="tray0" style="left:60px;top:700px;width:280px;height:96px;background:${NB.yellow};border-radius:20px"><div class="hd" style="left:24px;top:22px;font-size:38px;line-height:46px">+ Research</div></div>` +
    `<div class="slab e6" style="left:370px;top:700px;width:300px;height:96px;background:#fff;border-radius:20px"><div class="hd" style="left:24px;top:22px;font-size:38px;line-height:46px">+ Ask me first</div></div>` +
    `<div class="slab e6" style="left:700px;top:700px;width:260px;height:96px;background:#fff;border-radius:20px"><div class="hd" style="left:24px;top:22px;font-size:38px;line-height:46px">+ Wait a day</div></div>` +
    `<div id="tok" style="left:${NX(0) + 140}px;top:${NY + 98}px;width:52px;height:52px;border-radius:50%;background:${NB.lime};border:6px solid ${INK}"></div>`;
  put(w, winH('studio', 110, 120, 2140, 860, 'Studio', NB.violet, inner) + tileH('flow', 2380, 300, 230, 't6flow', { e: 'e12' }));
  // a week strip: Monday, 9 sharp
  put(w, `<div class="slab e10" id="week" style="left:300px;top:1050px;width:1300px;height:170px;background:#fff">` +
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, j) => `<div class="hd" style="left:${30 + j * 180}px;top:52px;width:160px;text-align:center;font-size:52px;line-height:62px;color:${j ? '#9A96A3' : INK}">${d}</div>`).join('') +
    `<div id="monRing" style="left:34px;top:26px;width:152px;height:112px;border:7px solid ${NB.purple};border-radius:28px"></div></div>` +
    `<div class="stk e10" id="nineStk" style="left:300px;top:930px;width:240px;background:${NB.yellow};font-size:72px;line-height:100px">9:00</div>`);
  // tools panel with a missing tool, then an MCP server plugged in
  put(w, `<div class="slab e16" id="toolsP" style="left:2700px;top:200px;width:1300px;height:760px;background:#fff"><div class="wh" style="background:${NB.mint}">${mk(mkid())}<b>Tools</b></div>` +
    tileH('code', 190, 300, 220, 't6code', { e: 'e10' }) + tileH('writer', 190, 560, 220, 't6wr', { e: 'e10' }) +
    ['Search the web', 'Read a file', 'Run Python'].map((t, j) => `<div class="slab e6" style="left:340px;top:${130 + j * 100}px;width:340px;height:80px;background:${TCOL[j]};border-radius:18px"><div class="tx" style="left:22px;top:16px;font-size:34px;line-height:44px">${t}</div></div>`).join('') +
    `<div id="slot6" style="left:340px;top:430px;width:340px;height:80px;border:6px dashed ${INK};border-radius:18px"><div class="hd" style="left:0;top:10px;width:328px;text-align:center;font-size:46px;line-height:54px">?</div></div>` +
    `<div class="slab e8" id="sock" style="left:1060px;top:260px;width:180px;height:260px;background:${NB.violet};border-radius:30px"><div style="left:96px;top:80px;width:66px;height:22px;border-radius:6px;background:${INK}"></div><div style="left:96px;top:146px;width:66px;height:22px;border-radius:6px;background:${INK}"></div></div>` +
    ['Design files', 'Issues', 'Database', 'Invoices'].map((t, j) => `<div class="slab e6 newT" style="left:${340 + (j % 2) * 330}px;top:${560 + Math.floor(j / 2) * 96}px;width:310px;height:80px;background:${NB.lime};border-radius:18px"><div class="tx" style="left:22px;top:16px;font-size:34px;line-height:44px">${t}</div></div>`).join('') +
    `</div><div class="slab e12" id="plug" style="left:3934px;top:491px;width:420px;height:200px;background:${NB.orange};border-radius:30px"><div class="hd" style="left:40px;top:58px;font-size:60px;line-height:72px">MCP server</div>` +
    `<div style="left:-64px;top:52px;width:70px;height:26px;border-radius:6px;background:${INK}"></div><div style="left:-64px;top:118px;width:70px;height:26px;border-radius:6px;background:${INK}"></div></div>` + curH('cur6b'));
})();
cam('s6b', [
  [S6.same, 800, 560, 1.06, 6, 16],
  [S6.same + 14, 1180, 520, 1.0, 6, -6, 'snapSettle'],
  [S6.desc - 4, 1180, 520, 1.0, 6, -6, 'cruise'],
  [S6.desc + 8, 900, 300, 1.3, 4, -4, 'softLand'],
  [S6.flowW - 6, 920, 305, 1.32, 4, -4, 'cruise'],
  [S6.flowW + 8, 1180, 560, .9, 10, -6, 'softInOut'],
  [S6.drag - 8, 1180, 570, .92, 10, -6, 'cruise'],
  [S6.drag + 4, 1180, 640, .96, 8, -4, 'softInOut'],
  [S6.swap - 6, 1180, 640, .96, 8, -4, 'cruise'],
  [S6.swap + 4, 1100, 560, 1.18, 6, -2, 'softInOut'],
  [S6.save - 4, 1120, 540, 1.18, 6, -2, 'cruise'],
  [S6.save + 6, 1480, 360, 1.24, 6, -6, 'softInOut'],
  [S6.monday - 6, 1480, 370, 1.24, 6, -6, 'cruise'],
  [S6.monday + 8, 980, 950, .95, 10, 4, 'whip'],
  [S6.runs - 6, 990, 900, .9, 10, 2, 'cruise'],
  [S6.runs + 6, 1180, 600, .86, 10, -6, 'softInOut'],
  [S6.missing - 6, 1180, 600, .86, 10, -6, 'cruise'],
  [S6.missing + 8, 3420, 600, .96, 8, -8, 'whip'],
  [S6.plug + 14, 3560, 600, .9, 10, -10, 'softInOut'],
  [S6.what, 3500, 600, .94, 8, -8, 'cruise'],
]);
/* Same job every week? I describe it in one sentence, */
stand('#t6flow', S6.same + 4, { rx: -80, frames: 10 });
const fpEnd = typeFast('#fPrompt', S6.desc - 2, { cpf: 2, caret: '#fC' }); M.hide('#fC', fpEnd + 4);
/* and Flow draws the whole pipeline. */
hop('#t6flow img', S6.flowW, 30, 12);
[0, 1, 2, 3].forEach(j => { const a = S6.flowW + 4 + j * 7; stand('#nd' + j, a, { rx: -84, frames: 10 }); sfx(a + 2, 'pop: a step');
  if (j) M.enter('#cn' + j, { at: a - 3, frames: 6, ease: 'softLand', from: { scaleX: .05 }, to: { scaleX: 1 } }); });
/* Drag a step. (a Research step comes up from the tray; Send makes room) */
const dr = S6.drag;
const P6 = (x, y) => [115 + x, 125 + y];                      // studio window content -> table coordinates
M.cursor('#cur6b', { keys: [[dr - 16, 900, 1300, 2, -12], [dr - 4, ...P6(190, 740), 1, 0], [dr, ...P6(194, 744), 1, 0], [dr + 14, ...P6(NX(3) + 190, NY + 120), 1, 0], [S6.swap - 4, ...P6(NX(3) + 196, NY + 126), 1, 0],
  [S6.swap + 2, ...P6(NX(2) + 66, NY + 66), 1, 0], [S6.save - 6, ...P6(NX(2) + 70, NY + 70), 1, 0], [S6.save, ...P6(1530, 156), 1, 0], [S6.monday - 2, ...P6(1534, 160), 1, 0], [S6.monday + 8, 1900, 1300, 2, 10]], ease: 'glide' });
M.hide('#cur6b', S6.monday + 8);
M.show('#ndNew', dr);
M.kf('#ndNew', 'x', [[dr, -NX(3) + 60 - 25], [dr + 14, 0, 'softInOut']]); M.kf('#ndNew', 'y', [[dr, 700 - NY - 77], [dr + 14, 0, 'softInOut']]);
M.kf('#ndNew', 'scale', [[dr, .85], [dr + 4, 1.06, 'glide'], [dr + 14, 1, 'softInOut']]); M.kf('#ndNew', 'rotation', [[dr, 0], [dr + 6, -5, 'glide'], [dr + 14, 0, 'softInOut']]);
M.kf('#tray0', 'opacity', [[dr, 1], [dr + 1, .35]]);
M.kf('#nd3', 'x', [[dr + 4, 0], [dr + 14, 400, 'softInOut']]);
M.enter('#cn4', { at: dr + 12, frames: 6, ease: 'softLand', from: { scaleX: .05 }, to: { scaleX: 1 } });
sfx(dr + 14, 'snap: step dropped');
/* Swap a Mate. (Writer turns over; Luna is on the other side) */
const sw = S6.swap + 2;
M.kf('#ndav2', 'scaleX', [[sw, 1], [sw + 4, .02, 'gentleIn']]); M.hide('#ndav2', sw + 4); M.hide('#ndt2', sw + 4);
M.show('#ndavS', sw + 4); M.show('#ndtS', sw + 4); M.kf('#ndavS', 'scaleX', [[sw + 4, .02], [sw + 9, 1, 'softLand']]);
M.kf('#nd2', 'backgroundColor', [[sw + 4, NB.blue], [sw + 5, NB.orange]]);
sfx(sw + 4, 'switch: swap');
/* Save. */
M.press('#cur6b', '#fSave', { at: S6.save, frames: 3, cursorDepth: .8, targetDepth: 1, lag: 1, release: true }); push('#fSave', S6.save + 1, 8);
/* Every Monday, nine sharp, it just runs. */
stand('#week', S6.monday - 2, { rx: -70, frames: 10 }); land('#monRing', F('monday') + 2, { scale: 1.5 }, 9, 'snapSettle');
slap('#nineStk', S6.nine - 2, -7, 2.6, 11);
const tokAt = [S6.runs - 4, S6.runs + 4, S6.runs + 12, S6.runs + 20, S6.runs + 28];
M.show('#tok', tokAt[0]); M.kf('#tok', 'x', [[tokAt[0], 0]].concat(tokAt.slice(1).map((a, j) => [a, (j + 1) * 400, 'softInOut'])));
['#ndok0', '#ndok1', '#ndok2', '#ndokN', '#ndok3'].forEach((s, j) => { land(s, tokAt[j] + 2, { scale: .3 }, 8, 'popOver'); sfx(tokAt[j] + 2, 'tick: step done'); });
M.hide('#tok', tokAt[4] + 6);
/* Missing a tool? Plug in an MCP server. Same Mates, brand new hands. */
M.kf('#slot6', 'rotation', [[S6.missing + 6, 0], [S6.missing + 8, -4, 'glide'], [S6.missing + 10, 4, 'glide'], [S6.missing + 13, 0, 'glide']]);
M.kf('#plug', 'x', [[S6.plug - 6, 760], [S6.mcp + 4, 50, 'softInOut'], [S6.mcp + 8, 0, 'whip']]);
M.kf('#plug', 'rotation', [[S6.plug - 6, 10], [S6.mcp + 4, 3, 'softInOut'], [S6.mcp + 8, 0, 'whip']]);
M.kf('#sock', 'scale', [[S6.mcp + 8, 1], [S6.mcp + 10, .94, 'glide'], [S6.mcp + 16, 1, 'glide']]); sfx(S6.mcp + 8, 'snap: plugged in');
M.hide('#slot6', S6.hands - 4);
$$('.newT').forEach((el, j) => { M.enter(el, { at: S6.hands - 4 + j * 4, frames: 11, ease: 'snapSettle', from: { x: 600 - (j % 2) * 330, y: -200 - Math.floor(j / 2) * 96, scale: .4, rotation: 20 }, to: { rotation: [-3, 2, 3, -2][j] } }); sfx(S6.hands - 2 + j * 4, 'pop: new tool'); });
hop('#t6code img', F('hands') - 2, 30, 12); hop('#t6wr img', F('hands') + 2, 30, 12);
