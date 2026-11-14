/* ===================================================================================================================
   SCENE 10 (night): Last night. 11 p.m. I'm already in bed. The garage door? Wide open. I completely forgot. But Mimo didn't.
   It's been watching the house through Home Assistant. My phone rings. "Hey, your garage is still open. Want me to close it?"
   Yes, please. "Lights off too?" Yes. Door's shut. House is dark. I never left the bed.
   =================================================================================================================== */
const S10 = { last: F('last night'), pm: F('11'), bed: F("i'm already in bed"), garage: F('the garage door'), wide: F('wide open'), forgot: F('i completely forgot'),
  but: F("but mimo didn't"), watching: F("it's been watching"), ha: F('home assistant'), rings: F('my phone rings'), hey: F('hey your garage'),
  close: F('want me to close'), yesP: F('yes please'), lights: F('lights off too'), yes2: F('yes', 1), shut: F("door's shut"), dark: F('house is dark'),
  never: F('i never left'), friday: F('and every friday') };
const NIGHT = { wall: '#F4E3C3', roof: '#E8604C', lit: '#FFD84A', dark: '#3B3F7A' };
(() => {
  const w = shot('s10', true);
  // a house in section: my bedroom on the left, the garage on the right
  put(w, `<div style="left:-400px;top:960px;width:3600px;height:600px;background:#232758;border-top:6px solid ${INK}"></div>` +
    `<div style="left:2120px;top:200px;width:130px;height:130px;border-radius:50%;background:${NB.yellow};border:6px solid ${INK}"></div>` +
    `<svg style="left:560px;top:150px;width:1400px;height:330px;overflow:visible" viewBox="0 0 1400 330"><polygon points="40,320 700,30 1360,320" fill="${NIGHT.roof}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/></svg>` +
    `<div class="slab e16" style="left:640px;top:470px;width:1240px;height:500px;background:${NIGHT.wall};border-radius:12px"></div>` +
    `<i style="left:1220px;top:475px;width:12px;height:490px;background:${INK}"></i>` +
    // bedroom: window, lamp light, bed with me in it
    `<div id="bedLit" style="left:650px;top:480px;width:565px;height:480px;background:${NIGHT.lit};opacity:.42"></div>` +
    `<div class="slab" id="win10" style="left:720px;top:540px;width:200px;height:170px;background:${NIGHT.lit};border-radius:10px"><i style="left:93px;top:0;width:6px;height:160px;background:${INK}"></i></div>` +
    `<div class="slab" style="left:760px;top:800px;width:400px;height:110px;background:#fff;border-radius:18px"></div>` +
    `<div class="slab" style="left:780px;top:742px;width:130px;height:84px;background:#fff;border-radius:40px"></div>` +
    `<div class="slab" id="head10" style="left:800px;top:700px;width:96px;height:96px;background:#C98C5E;border-radius:50%"></div>` +
    `<div class="slab" style="left:870px;top:770px;width:300px;height:110px;background:${NB.purple};border-radius:30px 40px 20px 20px"></div>` +
    `<div class="slab" style="left:1100px;top:800px;width:96px;height:160px;background:#B07A45;border-radius:10px"></div>` +
    `<div class="slab" id="nPhone" style="left:1118px;top:762px;width:60px;height:40px;background:#14121A;border-radius:8px"></div>` +
    // garage: the door rolls up and down; the light inside spills out when it is open
    `<div id="garIn" style="left:1300px;top:600px;width:520px;height:360px;background:${NIGHT.lit}"></div>` +
    `<div style="left:1300px;top:600px;width:520px;height:370px;overflow:hidden"><div class="slab" id="door10" style="left:0;top:-300px;width:520px;height:370px;border-radius:6px;background:` +
    `repeating-linear-gradient(180deg, #CFD6E6 0 48px, ${INK} 48px 54px)"></div></div>` +
    `<div class="slab" style="left:1290px;top:590px;width:540px;height:20px;background:${INK};border-radius:4px"></div>` +
    `<div id="spill10" style="left:1300px;top:960px;width:520px;height:220px;background:linear-gradient(180deg, rgba(255,216,74,.55), rgba(255,216,74,0));clip-path:polygon(0 0,100% 0,120% 100%,-20% 100%)"></div>` +
    `<div id="glow10" style="left:640px;top:470px;width:1240px;height:500px;background:#0D0F2B;opacity:0"></div>`);
  // the 11 p.m. clock
  put(w, `<div class="slab e12" id="clk10" style="left:100px;top:180px;width:440px;height:200px;background:#14121A;border-radius:34px">` +
    `<div class="hd" id="ck10a" style="left:0;top:36px;width:430px;text-align:center;font-size:110px;line-height:120px;color:#FFFDF5">10:59</div>` +
    `<div class="hd" id="ck10b" style="left:0;top:36px;width:430px;text-align:center;font-size:110px;line-height:120px;color:${NB.lime}">11:00</div>` +
    `<div class="tx" style="left:372px;top:132px;font-size:30px;line-height:40px;color:#B9BDF0">pm</div></div>`);
  // Home Assistant, watched by Mimo
  put(w, winH('ha10', 2100, 380, 980, 620, 'Home Assistant', NB.sky,
    [['Garage door', 'Open', 'Closed', NB.red], ['Porch light', 'On', 'Off', NB.yellow], ['Living room', 'On', 'Off', NB.yellow]].map(([t, a, b, c], j) =>
      `<div class="slab e6" style="left:40px;top:${110 + j * 160}px;width:890px;height:130px;background:#fff;border-radius:22px"><div class="hd" style="left:30px;top:34px;font-size:52px;line-height:62px">${t}</div>` +
      `<div class="stk" id="hs${j}a" style="right:24px;top:22px;font-size:46px;line-height:76px;background:${c};border-width:4px">${a}</div>` +
      `<div class="stk" id="hs${j}b" style="right:24px;top:22px;font-size:46px;line-height:76px;background:${j ? '#C9C6D3' : NB.lime};border-width:4px">${b}</div></div>`).join(''), { fill: '#FFFDF5' }) +
    tileH('mimo', 2950, 320, 220, 't10mimo', { e: 'e12' }));
  // my phone rings, the call
  put(w, `<div class="slab e16" id="ph10" style="left:120px;top:300px;width:420px;height:800px;border-radius:60px;background:#14121A"><div style="left:18px;top:18px;width:374px;height:754px;border-radius:44px;background:${NB.sky};overflow:hidden">` +
    avH('mimo', 112, 90, 150, '', { e: 'e6' }) + `<div class="hd" style="left:0;top:262px;width:374px;text-align:center;font-size:50px;line-height:60px">Mimo</div>` +
    waveH('pw10', 60, 360, 14, INK, 56, 18, 9) + `</div></div>`);
  [['b10a', 'Hey, your garage is still open.\nWant me to close it?', 0], ['b10b', 'Yes, please.', 1], ['b10c', 'Lights off too?', 0], ['b10d', 'Yes.', 1]].forEach(([id, t, me], j) =>
    put(w, `<div class="bub e8" id="${id}" style="left:${me ? 980 : 600}px;top:${[1080, 1240, 1080, 1240][j]}px;background:${me ? NB.purple : '#fff'};color:${me ? '#fff' : INK};font-size:46px;line-height:60px;border-radius:${me ? '28px 28px 8px 28px' : '28px 28px 28px 8px'}">${t}</div>`));
  put(w, `<div class="hd zz10" style="left:960px;top:640px;font-size:60px;line-height:60px;color:${NB.purple}">z</div><div class="hd zz10" style="left:1000px;top:590px;font-size:74px;line-height:74px;color:${NB.purple}">z</div>`);
})();
cam('s10', [
  [S10.last, 1100, 600, .78, 8, 14],
  [S10.last + 16, 1180, 600, .8, 10, -6, 'snapSettle'],
  [S10.pm - 6, 1170, 600, .8, 10, -6, 'cruise'],
  [S10.pm + 6, 420, 330, 1.5, 6, -4, 'softInOut'],
  [S10.bed - 8, 430, 335, 1.52, 6, -4, 'cruise'],
  [S10.bed + 6, 960, 720, 1.5, 6, 4, 'softInOut'],
  [S10.garage - 6, 965, 722, 1.52, 6, 4, 'cruise'],
  [S10.garage + 8, 1560, 760, 1.5, 6, -4, 'softInOut'],
  [S10.wide + 10, 1560, 820, 1.7, 5, -4, 'softLand'],
  [S10.forgot - 4, 1560, 820, 1.72, 5, -4, 'cruise'],
  [S10.forgot + 10, 1180, 640, .82, 10, -6, 'softInOut'],
  [S10.but - 4, 1190, 640, .84, 10, -6, 'cruise'],
  [S10.but + 8, 2560, 640, 1.0, 8, -8, 'whip'],
  [S10.rings - 6, 2570, 650, 1.02, 8, -8, 'cruise'],
  [S10.rings + 8, 1060, 800, .82, 10, 4, 'whip'],
  [S10.yesP - 4, 1080, 820, .84, 10, 2, 'cruise'],
  [S10.yesP + 10, 1300, 800, .78, 10, -4, 'softInOut'],
  [S10.shut - 4, 1300, 790, .8, 10, -4, 'cruise'],
  [S10.shut + 8, 1560, 800, 1.3, 6, -4, 'softInOut'],
  [S10.dark - 4, 1560, 800, 1.32, 6, -4, 'cruise'],
  [S10.dark + 8, 1240, 700, .86, 10, -6, 'softInOut'],
  [S10.never + 4, 960, 760, 1.4, 6, 4, 'softInOut'],
  [S10.friday, 950, 770, 1.46, 6, 4, 'cruise'],
]);
/* Last night. 11 p.m. */
M.kf('#ck10a', 'y', [[S10.pm - 4, 0], [S10.pm + 2, -110, 'gentleIn']]); M.hide('#ck10a', S10.pm + 2); land('#ck10b', S10.pm - 1, { y: 110 }, 9); sfx(S10.pm, 'tick: 11 pm');
/* I'm already in bed. The garage door? Wide open. I completely forgot. */
M.kf('#head10', 'rotation', [[S10.bed, 0], [S10.bed + 10, -12, 'softInOut']]);
M.kf('#spill10', 'opacity', [[S10.garage, .7], [S10.wide, 1, 'glide'], [S10.wide + 30, .8, 'softInOut']]);
/* But Mimo didn't. It's been watching the house through Home Assistant. */
stand('#t10mimo', S10.but - 2, { rx: -80, frames: 10 }); stand('#ha10', S10.watching - 4, { rx: -50, frames: 12 });
['#hs0b', '#hs1b', '#hs2b'].forEach(s => M.hide(s, 0));
M.kf('#hs0a', 'scale', [[S10.ha, 1], [S10.ha + 3, 1.18, 'glide'], [S10.ha + 10, 1, 'glide']]); sfx(S10.ha + 1, 'pop: garage open');
/* My phone rings. */
M.exit('#clk10', { at: S10.rings - 2, frames: 8, to: { y: -300, rotation: -10 } });
M.kf('#nPhone', 'x', [[S10.rings, 0], [S10.rings + 2, -5], [S10.rings + 4, 5], [S10.rings + 6, -4], [S10.rings + 8, 4], [S10.rings + 10, 0]]);
M.enter('#ph10', { at: S10.rings + 2, frames: 12, ease: 'softLand', from: { y: 900, rotation: -12 }, to: { rotation: -4 } }); sfx(S10.rings + 4, 'chime: phone rings');
M.show('.pw10', S10.hey - 2); wave('.pw10', S10.hey - 2, S10.yes2 + 10, 4);
/* "Hey, your garage is still open. Want me to close it?" Yes, please. */
stand('#b10a', S10.hey - 2, { rx: -70, frames: 10, origin: '0% 100%' });
M.exit('#b10a', { at: S10.yesP - 4, frames: 6, to: { y: -40, opacity: 0 } });
stand('#b10b', S10.yesP - 2, { rx: -70, frames: 10, origin: '100% 100%' }); M.exit('#b10b', { at: S10.lights - 4, frames: 6, to: { y: -40, opacity: 0 } });
const shut10 = S10.yesP + 10;                                     // the garage door rolls down
M.kf('#door10', 'y', [[shut10, 0], [shut10 + 26, 300, 'softInOut']]); sfx(shut10, 'fill: door closing'); sfx(shut10 + 26, 'snap: door shut');
M.kf('#spill10', 'opacity', [[shut10, .8], [shut10 + 24, 0, 'softInOut']]);
M.show('#hs0b', shut10 + 26); M.hide('#hs0a', shut10 + 26);
/* "Lights off too?" Yes. */
stand('#b10c', S10.lights - 2, { rx: -70, frames: 10, origin: '0% 100%' }); M.exit('#b10c', { at: S10.yes2 - 4, frames: 6, to: { y: -40, opacity: 0 } });
stand('#b10d', S10.yes2 - 2, { rx: -70, frames: 10, origin: '100% 100%' }); M.exit('#b10d', { at: S10.shut - 6, frames: 6, to: { y: -40, opacity: 0 } });
const off10 = S10.yes2 + 8;
M.kf('#bedLit', 'opacity', [[off10, .42], [off10 + 3, 0, 'glide']]); M.kf('#win10', 'backgroundColor', [[off10, NIGHT.lit], [off10 + 1, NIGHT.dark]]);
M.kf('#garIn', 'backgroundColor', [[off10, NIGHT.lit], [off10 + 1, '#2A2D5E']]);
M.kf('#glow10', 'opacity', [[off10, 0], [off10 + 4, .45, 'glide']]); sfx(off10, 'switch: lights off');
['#hs1', '#hs2'].forEach(s => { M.show(s + 'b', off10 + 1); M.hide(s + 'a', off10 + 1); });
M.exit('#ph10', { at: S10.shut - 8, frames: 10, to: { y: 900, rotation: 8 } });
/* Door's shut. House is dark. I never left the bed. */
$$('.zz10').forEach((el, j) => { const a = S10.never - 4 + j * 6; M.show(el, a); M.kf(el, 'opacity', [[a, 0], [a + 5, 1, 'glide']]); M.kf(el, 'y', [[a, 16], [S10.friday + 4, -30, 'cruise']]); });

/* ===================================================================================================================
   SCENE 11: And every Friday? Team stand-up. Each Mate gives one line, in its own voice. They find me anywhere. Telegram.
   Slack. WhatsApp. My phone. They plug into everything I already use. Got a small team? Everyone gets the bot, and
   everyone sees only their own work.
   =================================================================================================================== */
const S11 = { friday: F('and every friday'), standup: F('team stand-up'), eachM: F('each mate gives'), voice: F('own voice'), anywhere: F('they find me'),
  tg: F('telegram'), slack: F('slack'), wa: F('whatsapp'), phone: F('my phone', 1), plug: F('they plug into'), team: F('got a small team'),
  everyone: F('everyone gets'), sees: F('everyone sees'), models: F('my models') };
const SU = [['code', 'Dark mode shipped.', NB.orange], ['research', 'Three new battery sources.', NB.yellow], ['writer', 'Reports are half as long.', NB.blue], ['ops', 'Builds green all week.', NB.mint], ['halo', 'Stopped one risky push.', NB.pink]];
(() => {
  const w = shot('s11');
  put(w, winH('su11', 260, 90, 1400, 940, 'Stand-up, Friday 10:00', NB.yellow,
    SU.map(([k, t, c], j) => `<div id="su${j}" style="left:40px;top:${110 + j * 160}px;width:1310px;height:140px">` + avH(k, 0, 10, 120, '', { e: 'e6', bg: c }) +
      `<div class="bub e6" id="sub${j}" style="left:150px;top:18px;font-size:46px;line-height:58px;padding:16px 28px;background:#fff;border-radius:24px 24px 24px 6px">${t}</div>` +
      waveH('suw' + j, 1060, 46, 10, INK, 46, 18, 8) + `</div>`).join('')));
  // the same message, everywhere
  const APPS = [['Telegram', '#5AB8F0', '#E8F6FF'], ['Slack', '#7B3F86', '#F6EEF8'], ['WhatsApp', '#3CCB72', '#ECFBF1'], ['My phone', '#14121A', NB.cream]];
  APPS.forEach(([t, c, bg], j) => put(w, `<div class="slab e16 app11" id="app${j}" style="left:${330 + j * 330}px;top:1300px;width:620px;height:700px;background:${bg}">` +
    `<div style="left:0;top:0;width:610px;height:96px;border-bottom:5px solid ${INK};border-radius:22px 22px 0 0;background:${c}"></div><div class="hd" style="left:30px;top:18px;font-size:48px;line-height:58px;color:#fff">${t}</div>` +
    avH('mimo', 30, 140, 96, '', { e: 'e4' }) +
    `<div class="bub e6" style="left:146px;top:140px;background:#fff;font-size:36px;line-height:48px;padding:14px 24px;border-radius:22px 22px 22px 6px">Morning! Your summary\nis ready.</div></div>`));
  put(w, `<div class="bub e10" id="msg11" style="left:780px;top:1560px;background:#fff;font-size:56px;line-height:70px;border-radius:30px 30px 30px 8px;padding:22px 36px">Morning! Your summary\nis ready.</div>` + avH('mimo', 620, 1570, 130, 'msgAv', { e: 'e8' }));
  // connections
  const CON = ['Telegram', 'Slack', 'WhatsApp', 'Google Calendar', 'Gmail', 'Notion', 'Obsidian', 'Spotify', 'Home Assistant', 'Todoist', 'Linear', 'GitHub'];
  put(w, winH('con11', 2500, 1180, 1500, 960, 'Connections', NB.mint,
    CON.map((t, j) => { const c = j % 2, r = Math.floor(j / 2);
      return `<div class="tx" style="left:${50 + c * 720}px;top:${130 + r * 130}px;font-size:44px;line-height:56px">${t}</div>` +
        `<div class="slab" style="left:${520 + c * 720}px;top:${122 + r * 130}px;width:140px;height:72px;border-radius:36px;background:#E4E1EA;border-width:4px"></div>` +
        `<div class="slab tgOn" style="left:${520 + c * 720}px;top:${122 + r * 130}px;width:140px;height:72px;border-radius:36px;background:${NB.lime};border-width:4px"></div>` +
        `<div class="slab tgK" style="left:${528 + c * 720}px;top:${130 + r * 130}px;width:56px;height:56px;border-radius:50%;background:#fff;border-width:4px"></div>`; }).join('')));
  // a small team: everyone sees only their own work
  const PPL = [['Asha', NB.pink, ['Ship the pricing page', 'Reply to the investor']], ['Sam', NB.sky, ['Fix the login bug', 'Review PR #42']], ['Jon', NB.yellow, ['Book the venue', 'Order the badges']]];
  PPL.forEach(([n, c, tasks], j) => put(w, `<div class="slab e12 ppl" id="ppl${j}" style="left:${2440 + j * 560}px;top:140px;width:520px;height:760px;background:#fff">` +
    `<div class="slab" style="left:30px;top:30px;width:120px;height:120px;border-radius:50%;background:${c}"><div class="hd" style="left:0;top:26px;width:110px;text-align:center;font-size:56px;line-height:62px">${n[0]}</div></div>` +
    `<div class="hd" style="left:176px;top:56px;font-size:58px;line-height:66px">${n}</div>` + avH('mimo', 30, 190, 84, '', { e: 'e4' }) +
    `<div class="tl" style="left:132px;top:212px;font-size:30px;line-height:40px">Mimo, just for ${n}</div>` +
    tasks.map((t, k) => `<div class="slab e6" style="left:30px;top:${310 + k * 130}px;width:450px;height:104px;background:${c};border-radius:20px"><div class="tx" style="left:24px;top:28px;font-size:34px;line-height:44px">${t}</div></div>`).join('') +
    (j ? `<div class="slab hide11" style="left:22px;top:300px;width:470px;height:270px;border-radius:22px;background:repeating-linear-gradient(135deg,#E9E6EF 0 18px,#FFFFFF 18px 36px)"><div class="hd" style="left:0;top:90px;width:460px;text-align:center;font-size:44px;line-height:52px">Not yours</div></div>` : '') + `</div>`));
})();
cam('s11', [
  [S11.friday, 760, 560, 1.0, 6, 16],
  [S11.friday + 14, 960, 560, 1.0, 6, -6, 'snapSettle'],
  [S11.eachM - 4, 965, 560, 1.02, 6, -6, 'cruise'],
  [S11.voice + 6, 970, 560, 1.04, 6, -4, 'cruise'],
  [S11.anywhere + 6, 1180, 1640, 1.0, 10, -6, 'whip'],
  [S11.tg + 4, 1300, 1650, .9, 10, -6, 'softInOut'],
  [S11.phone + 10, 1310, 1660, .92, 10, -4, 'cruise'],
  [S11.plug + 4, 3250, 1660, .9, 8, -8, 'whip'],
  [S11.team - 4, 3260, 1670, .92, 8, -8, 'cruise'],
  [S11.team + 8, 3280, 520, .9, 10, 6, 'whip'],
  [S11.sees - 6, 3290, 530, .92, 10, 4, 'cruise'],
  [S11.sees + 10, 2700, 530, 1.18, 6, -4, 'softInOut'],
  [S11.models, 2710, 535, 1.2, 6, -4, 'cruise'],
]);
/* And every Friday? Team stand-up. Each Mate gives one line, in its own voice. */
stand('#su11', S11.friday + 2, { rx: -50, frames: 12 });
SU.forEach((s, j) => { stand('#su' + j, S11.friday + 10 + j * 3, { rx: -84, frames: 9, origin: '0% 100%' });
  const a = S11.standup + 6 + j * 10; land('#sub' + j, a, { scale: .4, x: -60 }, 9, 'popOver'); M.show('.suw' + j, a + 1, a + 34); wave('.suw' + j, a + 1, a + 28, j); sfx(a + 1, 'pop: a line'); });
/* They find me anywhere. Telegram. Slack. WhatsApp. My phone. (one message, four places) */
[S11.tg, S11.slack, S11.wa, S11.phone].forEach((q, j) => { M.enter('#app' + j, { at: q - 4, frames: 11, ease: 'snapSettle', from: { y: 500, rotation: 20, scale: .8 }, to: { rotation: (j - 1.5) * 5 } }); sfx(q - 2, 'pop: ' + ['Telegram', 'Slack', 'WhatsApp', 'my phone'][j]); });
land('#msgAv', S11.anywhere + 4, { scale: .4 }, 9, 'popOver'); land('#msg11', S11.anywhere + 6, { scale: .5, x: -80 }, 10, 'popOver'); sfx(S11.anywhere + 6, 'pop: message');
M.exit('#msg11', { at: S11.tg - 6, frames: 8, to: { scale: .3, y: -80, opacity: 0 } }); M.exit('#msgAv', { at: S11.tg - 6, frames: 8, to: { scale: .3, y: -80, opacity: 0 } });
/* They plug into everything I already use. */
$$('.tgOn').forEach((el, j) => { const a = S11.plug + 8 + j * 3; M.show(el, a); M.kf($$('.tgK')[j], 'x', [[a - 1, 0], [a + 4, 68, 'softLand']]); if (j % 2 === 0) sfx(a, 'switch: connect'); });
/* Got a small team? Everyone gets the bot, and everyone sees only their own work. */
$$('.ppl').forEach((el, j) => stand(el, S11.team + 2 + j * 4, { rx: -80, frames: 10 }));
$$('.hide11').forEach((el, j) => { const a = S11.sees + 6 + j * 4; M.enter(el, { at: a, frames: 9, ease: 'snapSettle', from: { scale: 1.3, rotation: -6 } }); sfx(a + 1, 'snap: not yours'); });
