/* hard cuts between the shots, always on a word, and the page's ready hook */
(() => {
  const CUTS = [['#s2', CUT2], ['#s2l', S2.lives], ['#s3', S3.setup], ['#s4', S4.talk], ['#s5', S5.fun], ['#s6', S6.talk], ['#s6b', S6.same],
    ['#s7', S7.what], ['#s8', S8.notall], ['#s9', S9.love], ['#s10', S10.last], ['#s11', S11.friday], ['#s12', S12.models]];
  let prev = '#stage1';
  CUTS.forEach(([sel, f]) => { M.cut(f, { hide: [prev], show: [sel], label: sel.slice(1) }); prev = sel; });
})();
window.__ready = Motion.loaded().then(() => { if (/selftest/.test(location.search)) Motion.selfTest(M, { samples: 24 }); });
