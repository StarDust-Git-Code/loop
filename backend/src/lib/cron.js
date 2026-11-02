// Minimal 5-field cron + daily/weekly schedule maths, evaluated in a given IANA timezone.
const fmtCache = new Map();
function parts(ms, tz) {
  let f = fmtCache.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' }); fmtCache.set(tz, f); }
  const o = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { min: +o.minute, hour: +o.hour, dom: +o.day, mon: +o.month, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
}

function field(src, lo, hi) {
  const set = new Set();
  for (const part of src.split(',')) {
    const [range, stepS] = part.split('/');
    const step = stepS ? Number(stepS) : 1;
    if (!(step >= 1)) throw new Error(`bad cron step "${part}"`);
    let a = lo, b = hi;
    if (range !== '*') { const [x, y] = range.split('-'); a = Number(x); b = y === undefined ? (stepS ? hi : a) : Number(y); }
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < lo || b > hi || a > b) throw new Error(`bad cron field "${part}"`);
    for (let v = a; v <= b; v += step) set.add(v);
  }
  return set;
}

export function parseCron(expr) {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) throw new Error('cron needs 5 fields: minute hour day-of-month month day-of-week');
  const dow = field(f[4].replace(/7/g, '0'), 0, 6);
  return { min: field(f[0], 0, 59), hour: field(f[1], 0, 23), dom: field(f[2], 1, 31), mon: field(f[3], 1, 12), dow, domStar: f[2] === '*', dowStar: f[4] === '*' };
}

function matches(c, p) {
  if (!c.min.has(p.min) || !c.hour.has(p.hour) || !c.mon.has(p.mon)) return false;
  const d = c.dom.has(p.dom), w = c.dow.has(p.dow);
  return c.domStar && c.dowStar ? true : c.domStar ? w : c.dowStar ? d : d || w;
}

/** Next run strictly after `from` (ms) or null (manual, invalid, or nothing within 62 days). */
export function nextRun(schedule, from, tz = 'UTC') {
  if (!schedule || schedule.kind === 'manual') return null;
  let c;
  try {
    if (schedule.kind === 'cron') c = parseCron(schedule.cron || '');
    else {
      const [h, m] = (schedule.time || '09:00').split(':').map(Number);
      if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) return null;
      c = { min: new Set([m]), hour: new Set([h]), dom: new Set(), mon: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), dow: new Set(schedule.kind === 'weekly' ? (schedule.days?.length ? schedule.days : [1]) : [0, 1, 2, 3, 4, 5, 6]), domStar: true, dowStar: false };
    }
  } catch { return null; }
  let t = Math.floor(from / 60000) * 60000 + 60000;
  for (let i = 0; i < 62 * 24 * 60; i++, t += 60000) if (matches(c, parts(t, tz))) return t;
  return null;
}

export const validTz = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
