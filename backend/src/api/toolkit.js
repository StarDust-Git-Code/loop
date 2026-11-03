// The smart-harness toolkit: pure utilities, web depth, files, memory upkeep, notes and delegation.
// Utilities are granted to every Mate; Delegation to the coordinating Mates (see EXTRA_GROUPS in tools.js).
import crypto from 'node:crypto';
import { env, now } from '../lib/env.js';
import { userCol } from './db.js';
import { hooks } from './toolhooks.js';
import { getFileStream } from './files.js';
import { indexKnowledge } from './knowledge.js';

const bad = (m) => Object.assign(new Error(m), { tool: true });
const str = (v, n = 20_000) => String(v ?? '').slice(0, n);
const num = (v, label = 'value') => { const n = Number(v); if (!Number.isFinite(n)) throw bad(`${label} must be a number`); return n; };
const round = (n, d = 4) => Number.isFinite(n) ? String(Math.round(n * 10 ** d) / 10 ** d) : 'n/a';
const textOf = (h) => h.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const terms = (q) => (String(q).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).slice(0, 10);
const list = (v) => { if (Array.isArray(v)) return v; try { const j = JSON.parse(v); if (Array.isArray(j)) return j; } catch { /* not json */ } return String(v ?? '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean); };

/** Walk a path like a.b[0].c through parsed JSON. */
export function jsonPath(data, path) {
  let cur = data;
  for (const part of String(path ?? '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) {
    if (cur == null || typeof cur !== 'object') throw bad(`Nothing at "${part}"`);
    if (part === '*' && Array.isArray(cur)) continue;
    cur = cur[part];
  }
  return cur;
}
const parseJson = (s) => { try { return JSON.parse(s); } catch (e) { throw bad(`Not valid JSON: ${e.message.slice(0, 80)}`); } };
const pretty = (v) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));

/* ---------- unit conversion ---------- */
const UNITS = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nm: 1852 },
  mass: { kg: 1, g: 0.001, mg: 1e-6, lb: 0.45359237, oz: 0.028349523125, t: 1000 },
  volume: { l: 1, ml: 0.001, gal: 3.785411784, qt: 0.946352946, pt: 0.473176473, cup: 0.2365882365, floz: 0.0295735295625, tbsp: 0.01478676478125, tsp: 0.00492892159375 },
  data: { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776 },
  time: { s: 1, ms: 0.001, min: 60, h: 3600, d: 86400, wk: 604800 },
  speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, kn: 0.514444 },
  area: { 'm2': 1, 'km2': 1e6, 'ha': 1e4, 'ft2': 0.09290304, 'acre': 4046.8564224 },
};
function convertUnit(v, from, to) {
  const f = from.toLowerCase().replace('°', ''), t = to.toLowerCase().replace('°', '');
  const temp = { c: (x) => x, f: (x) => (x - 32) * 5 / 9, k: (x) => x - 273.15 }, fromC = { c: (x) => x, f: (x) => x * 9 / 5 + 32, k: (x) => x + 273.15 };
  if (temp[f] && fromC[t]) return fromC[t](temp[f](v));
  for (const table of Object.values(UNITS)) if (table[f] != null && table[t] != null) return v * table[f] / table[t];
  throw bad(`Cannot convert ${from} to ${to}. Known: ${Object.values(UNITS).flatMap((t) => Object.keys(t)).join(', ')}, c, f, k`);
}

/* ---------- cron ---------- */
function cronField(spec, min, max) {
  const out = new Set();
  for (const part of spec.split(',')) {
    const [range, stepS] = part.split('/'); const step = stepS ? num(stepS, 'cron step') : 1;
    let lo = min, hi = max;
    if (range !== '*') { const [a, b] = range.split('-'); lo = num(a, 'cron field'); hi = b != null ? num(b, 'cron field') : stepS ? max : lo; }
    for (let i = lo; i <= hi; i += step) out.add(i);
  }
  return out;
}
function cronNext(expr, from = new Date(), count = 3) {
  const f = expr.trim().split(/\s+/); if (f.length !== 5) throw bad('Use 5 fields: minute hour day-of-month month day-of-week');
  const [mi, ho, dm, mo, dw] = [cronField(f[0], 0, 59), cronField(f[1], 0, 23), cronField(f[2], 1, 31), cronField(f[3], 1, 12), cronField(f[4], 0, 7)];
  const out = []; const t = new Date(from); t.setUTCSeconds(0, 0); t.setUTCMinutes(t.getUTCMinutes() + 1);
  for (let i = 0; i < 527_040 && out.length < count; i++, t.setUTCMinutes(t.getUTCMinutes() + 1)) {
    const dowOk = dw.has(t.getUTCDay()) || (t.getUTCDay() === 0 && dw.has(7)), domOk = dm.has(t.getUTCDate());
    const dayOk = f[2] !== '*' && f[4] !== '*' ? domOk || dowOk : domOk && dowOk;
    if (mi.has(t.getUTCMinutes()) && ho.has(t.getUTCHours()) && mo.has(t.getUTCMonth() + 1) && dayOk) out.push(t.toISOString());
  }
  return out;
}

/* ---------- small line diff (LCS) ---------- */
function lineDiff(a, b) {
  const x = a.split('\n').slice(0, 400), y = b.split('\n').slice(0, 400);
  const dp = Array.from({ length: x.length + 1 }, () => new Uint16Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < x.length && j < y.length) { if (x[i] === y[j]) { i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(`- ${x[i++]}`); else out.push(`+ ${y[j++]}`); }
  while (i < x.length) out.push(`- ${x[i++]}`); while (j < y.length) out.push(`+ ${y[j++]}`);
  return out;
}

/* ---------- csv ---------- */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
const summarize = (xs) => {
  const s = [...xs].sort((a, b) => a - b), n = s.length, mean = s.reduce((a, b) => a + b, 0) / n;
  const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2, sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const pct = (p) => s[Math.min(n - 1, Math.floor(p * n))];
  return { n, sum: s.reduce((a, b) => a + b, 0), mean, median: med, min: s[0], max: s[n - 1], sd, p90: pct(0.9) };
};

/* ---------- web helpers (set by tools.js so SSRF protection is shared) ---------- */
let web = null;
export const bindWeb = (w) => { web = w; };
const get = async (url, as = 'text') => {
  const res = await web.safeFetch(url); if (!res.ok) throw bad(`That page answered ${res.status}`);
  const body = (await res.text()).slice(0, 600_000); return as === 'json' ? parseJson(body) : body;
};
const tag = (xml, name) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml); return m ? textOf(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')) : ''; };

const findFile = async (uid, q) => {
  const files = (await userCol(uid, 'files').limit(300).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const low = String(q ?? '').toLowerCase(); if (!low) throw bad('name is required');
  return files.find((f) => f.id === q) ?? files.find((f) => f.name?.toLowerCase() === low) ?? files.find((f) => f.name?.toLowerCase().includes(low));
};
const scratchRef = (c) => { const key = c.convId || c.runId; if (!key) throw bad('No chat or run is open'); return userCol(c.uid, 'scratch').doc(String(key).slice(0, 80)); };

const T = (group, desc, args, run, more = {}) => ({ group, desc, args, run, ...more });
const U = (desc, args, run, more) => T('Utilities', desc, args, run, more);
const W = (desc, args, run, more) => T('Web Search', desc, args, run, { net: true, ...more });

export const TOOLKIT = {
  /* ===== Utilities (every Mate) ===== */
  text_stats: U('Count words, characters, lines, sentences and reading time of a text.', '{"text": "text"}', (_c, a) => {
    const t = str(a.text, 200_000); const words = t.match(/\S+/g) ?? [];
    return `words ${words.length} | chars ${t.length} | lines ${t ? t.split('\n').length : 0} | sentences ${(t.match(/[.!?]+(\s|$)/g) ?? []).length} | reading time ~${Math.max(1, Math.round(words.length / 220))} min`;
  }),
  json_query: U('Extract a value from JSON using a path like data.items[0].name (use * to list array items).', '{"json": "JSON text", "path": "a.b[0].c"}', (_c, a) => {
    const data = parseJson(str(a.json, 400_000)); const p = String(a.path ?? '');
    if (p.includes('*')) { const [head, ...rest] = p.split('.*'); const arr = jsonPath(data, head); if (!Array.isArray(arr)) throw bad('* needs an array'); return pretty(arr.map((x) => (rest.join('.*').replace(/^\./, '') ? jsonPath(x, rest.join('.*').replace(/^\./, '')) : x))); }
    return pretty(jsonPath(data, p));
  }),
  json_format: U('Validate JSON and pretty-print or minify it.', '{"json": "JSON text", "minify?": "yes to minify"}', (_c, a) => { const v = parseJson(str(a.json, 400_000)); return a.minify ? JSON.stringify(v) : JSON.stringify(v, null, 2); }),
  regex_test: U('Test a regular expression against text and list the matches and groups.', '{"pattern": "regex source", "text": "text", "flags?": "e.g. gi"}', (_c, a) => {
    const p = str(a.pattern, 300); let re; try { re = new RegExp(p, str(a.flags, 6).replace(/[^dgimsuy]/g, '').replace(/g?$/, 'g')); } catch (e) { throw bad(`Bad pattern: ${e.message.slice(0, 80)}`); }
    const out = []; for (const m of str(a.text, 30_000).matchAll(re)) { out.push(`@${m.index}: ${m[0].slice(0, 100)}${m.length > 1 ? ` | groups ${JSON.stringify(m.slice(1))}` : ''}`); if (out.length >= 30) break; }
    return out.length ? `${out.length} match(es):\n${out.join('\n')}` : 'No matches.';
  }),
  text_diff: U('Line-by-line diff of two texts (- removed, + added).', '{"a": "old text", "b": "new text"}', (_c, a) => { const d = lineDiff(str(a.a, 40_000), str(a.b, 40_000)); return d.length ? d.join('\n') : 'Identical.'; }),
  csv_stats: U('Summarise CSV text: columns, row count, and stats for numeric columns.', '{"csv": "CSV text with a header row"}', (_c, a) => {
    const rows = parseCsv(str(a.csv, 400_000)); if (rows.length < 2) throw bad('Need a header row and at least one data row');
    const [head, ...body] = rows;
    return `${body.length} rows, ${head.length} columns\n` + head.map((h, i) => {
      const col = body.map((r) => r[i] ?? ''); const nums = col.map((v) => Number(v.replace(/[$,%\s]/g, ''))).filter((n, k) => col[k].trim() !== '' && Number.isFinite(n));
      if (nums.length >= col.length * 0.7 && nums.length) { const s = summarize(nums); return `- ${h} (number): n ${s.n}, sum ${round(s.sum)}, mean ${round(s.mean)}, median ${round(s.median)}, min ${s.min}, max ${s.max}`; }
      const counts = new Map(); for (const v of col) counts.set(v, (counts.get(v) ?? 0) + 1);
      return `- ${h} (text): ${counts.size} distinct; top: ${[...counts].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([v, n]) => `${v.slice(0, 30)} x${n}`).join(', ')}`;
    }).join('\n');
  }),
  stats_calc: U('Descriptive statistics for a list of numbers (comma or space separated).', '{"numbers": "1, 2, 3"}', (_c, a) => {
    const xs = (String(a.numbers ?? '').match(/-?\d+(\.\d+)?(e-?\d+)?/gi) ?? []).map(Number); if (!xs.length) throw bad('No numbers found');
    const s = summarize(xs); return Object.entries(s).map(([k, v]) => `${k} ${round(v)}`).join(' | ');
  }),
  percent_calc: U('Percentage maths. op: of (a% of b) | change (from a to b) | is (a is what % of b).', '{"op": "of|change|is", "a": 10, "b": 200}', (_c, a) => {
    const x = num(a.a, 'a'), y = num(a.b, 'b');
    if (a.op === 'of') return `${x}% of ${y} = ${round(x * y / 100)}`;
    if (a.op === 'change') return `From ${x} to ${y} is ${y >= x ? '+' : ''}${round((y - x) / x * 100, 2)}%`;
    if (a.op === 'is') return `${x} is ${round(x / y * 100, 2)}% of ${y}`;
    throw bad('op must be of, change or is');
  }),
  unit_convert: U('Convert between units of length, mass, volume, data, time, speed, area and temperature.', '{"value": 5, "from": "km", "to": "mi"}', (_c, a) => `${a.value} ${a.from} = ${round(convertUnit(num(a.value), str(a.from, 12), str(a.to, 12)), 6)} ${a.to}`),
  date_math: U('Add or subtract time from a date, or find the gap between two dates. add looks like "3d 2h -30m" (units: w d h m).', '{"date?": "ISO date, default now", "add?": "3d 2h", "until?": "second ISO date for the gap"}', (_c, a) => {
    const d = a.date ? Date.parse(a.date) : Date.now(); if (!Number.isFinite(d)) throw bad('date must be ISO like 2026-11-05T09:00:00+05:30');
    if (a.until) { const e = Date.parse(a.until); if (!Number.isFinite(e)) throw bad('until must be an ISO date'); const ms = e - d, s = Math.abs(ms) / 1000; return `${ms >= 0 ? 'in' : 'ago'}: ${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600)}h ${Math.floor(s % 3600 / 60)}m (${round(ms / 86400000, 2)} days)`; }
    let t = d; for (const m of String(a.add ?? '').matchAll(/(-?\d+(?:\.\d+)?)\s*([wdhm])/gi)) t += Number(m[1]) * { w: 604800000, d: 86400000, h: 3600000, m: 60000 }[m[2].toLowerCase()];
    const dt = new Date(t); return `${dt.toISOString()} (${dt.toUTCString().slice(0, 3)})`;
  }),
  tz_convert: U('Show a moment in several timezones. time is ISO with offset, or "now".', '{"time": "now or ISO", "zones": "comma list of IANA names, e.g. Asia/Kolkata, America/New_York"}', (_c, a) => {
    const t = a.time && a.time !== 'now' ? Date.parse(a.time) : Date.now(); if (!Number.isFinite(t)) throw bad('time must be ISO with an offset');
    return list(a.zones).slice(0, 8).map((z) => { try { return `${z}: ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: z }).format(t)}`; } catch { return `${z}: unknown zone`; } }).join('\n');
  }),
  cron_explain: U('Check a 5-field cron expression and list its next run times (UTC).', '{"expr": "*/15 9-17 * * 1-5"}', (_c, a) => { const n = cronNext(str(a.expr, 80)); return n.length ? `Next runs (UTC):\n${n.join('\n')}` : 'Never fires in the next year.'; }),
  loan_calc: U('Monthly payment, total paid and interest for a loan.', '{"principal": 100000, "rate": 9.5, "years": 5}', (_c, a) => {
    const P = num(a.principal, 'principal'), r = num(a.rate, 'rate') / 1200, n = Math.round(num(a.years, 'years') * 12); if (n <= 0) throw bad('years must be positive');
    const m = r ? P * r / (1 - (1 + r) ** -n) : P / n; return `Monthly ${round(m, 2)} | total ${round(m * n, 2)} | interest ${round(m * n - P, 2)} over ${n} months`;
  }),
  compound_calc: U('Future value with compound interest and optional monthly deposits.', '{"principal": 10000, "rate": 8, "years": 10, "monthly?": 500}', (_c, a) => {
    const P = num(a.principal, 'principal'), r = num(a.rate, 'rate') / 1200, n = Math.round(num(a.years, 'years') * 12), d = a.monthly ? num(a.monthly, 'monthly') : 0;
    const fv = r ? P * (1 + r) ** n + d * (((1 + r) ** n - 1) / r) : P + d * n; const paid = P + d * n; return `Future value ${round(fv, 2)} | paid in ${round(paid, 2)} | growth ${round(fv - paid, 2)}`;
  }),
  base64: U('Encode or decode Base64.', '{"text": "text", "mode": "encode|decode"}', (_c, a) => (a.mode === 'decode' ? Buffer.from(str(a.text, 200_000), 'base64').toString('utf8') : Buffer.from(str(a.text, 200_000)).toString('base64'))),
  hash_text: U('Hash text with sha256, sha1, md5 or sha512.', '{"text": "text", "algo?": "sha256|sha1|md5|sha512"}', (_c, a) => crypto.createHash(['sha1', 'md5', 'sha512'].includes(a.algo) ? a.algo : 'sha256').update(str(a.text, 1_000_000)).digest('hex')),
  uuid_gen: U('Generate UUIDs.', '{"n?": 1}', (_c, a) => Array.from({ length: Math.min(Math.max(Number(a.n) || 1, 1), 20) }, () => crypto.randomUUID()).join('\n')),
  random_pick: U('Pick random items from a list, or a random integer between min and max.', '{"items?": "comma or line separated list", "count?": 1, "min?": 1, "max?": 100}', (_c, a) => {
    if (a.items) { const xs = list(a.items); if (!xs.length) throw bad('items is empty'); return [...xs].sort(() => crypto.randomInt(3) - 1).slice(0, Math.min(Number(a.count) || 1, xs.length)).join('\n'); }
    const lo = Math.ceil(Number(a.min ?? 1)), hi = Math.floor(Number(a.max ?? 100)); if (!(hi >= lo)) throw bad('max must be at least min'); return String(crypto.randomInt(lo, hi + 1));
  }),
  url_parse: U('Split a URL into protocol, host, path, query parameters and hash.', '{"url": "https://..."}', (_c, a) => { let u; try { u = new URL(str(a.url, 2000)); } catch { throw bad('Not a valid URL'); } return `protocol ${u.protocol} | host ${u.hostname}${u.port ? `:${u.port}` : ''} | path ${u.pathname} | hash ${u.hash || '-'}\nquery: ${[...u.searchParams].map(([k, v]) => `${k}=${v.slice(0, 80)}`).join(', ') || '-'}`; }),
  jwt_decode: U('Decode (not verify) the header and payload of a JWT.', '{"token": "eyJ..."}', (_c, a) => {
    const p = str(a.token, 8000).split('.'); if (p.length < 2) throw bad('Not a JWT'); const dec = (s) => parseJson(Buffer.from(s, 'base64url').toString('utf8'));
    const pay = dec(p[1]); return `header ${JSON.stringify(dec(p[0]))}\npayload ${JSON.stringify(pay)}${pay.exp ? `\nexpires ${new Date(pay.exp * 1000).toISOString()}` : ''}\n(signature NOT verified)`;
  }),
  color_convert: U('Convert a colour between hex, rgb and hsl.', '{"color": "#6A4DF4 or rgb(1,2,3) or hsl(250,90%,60%)"}', (_c, a) => {
    const s = str(a.color, 40).trim().toLowerCase(); let r, g, b;
    let m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
    if (m) { const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1]; [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
    else if ((m = /^rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*\)$/.exec(s))) [r, g, b] = m.slice(1).map(Number);
    else if ((m = /^hsl\(\s*(\d+)[ ,]+(\d+)%?[ ,]+(\d+)%?\s*\)$/.exec(s))) { const h = +m[1] / 360, sa = +m[2] / 100, l = +m[3] / 100, q = l < 0.5 ? l * (1 + sa) : l + sa - l * sa, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; [r, g, b] = [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((x) => Math.round(x * 255)); }
    else throw bad('Use #hex, rgb(r,g,b) or hsl(h,s%,l%)');
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
    const sa = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); const h = d === 0 ? 0 : mx === r / 255 ? ((g - b) / 255 / d + 6) % 6 : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')} | rgb(${r}, ${g}, ${b}) | hsl(${Math.round(h * 60)}, ${Math.round(sa * 100)}%, ${Math.round(l * 100)}%)`;
  }),
  text_transform: U('Transform text. op: upper, lower, title, slug, snake, camel, sort_lines, unique_lines, reverse_lines, number_lines, trim_lines.', '{"text": "text", "op": "upper|lower|title|slug|snake|camel|sort_lines|unique_lines|reverse_lines|number_lines|trim_lines"}', (_c, a) => {
    const t = str(a.text, 200_000), lines = t.split('\n'), words = t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const ops = { upper: () => t.toUpperCase(), lower: () => t.toLowerCase(), title: () => t.toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()), slug: () => words.join('-'), snake: () => words.join('_'), camel: () => words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join(''), sort_lines: () => [...lines].sort((x, y) => x.localeCompare(y)).join('\n'), unique_lines: () => [...new Set(lines)].join('\n'), reverse_lines: () => [...lines].reverse().join('\n'), number_lines: () => lines.map((l, i) => `${i + 1}. ${l}`).join('\n'), trim_lines: () => lines.map((l) => l.trim()).filter(Boolean).join('\n') };
    if (!ops[a.op]) throw bad(`op must be one of ${Object.keys(ops).join(', ')}`); return ops[a.op]();
  }),
  extract_entities: U('Pull emails, URLs, phone numbers, dates and amounts out of a text.', '{"text": "text"}', (_c, a) => {
    const t = str(a.text, 200_000); const f = (re) => [...new Set(t.match(re) ?? [])].slice(0, 20);
    const rows = { emails: f(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g), urls: f(/https?:\/\/[^\s)"'<>]+/g), phones: f(/\+?\d[\d\s().-]{8,}\d/g), dates: f(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g), amounts: f(/(?:[$€£₹]\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|INR|GBP))/g) };
    return Object.entries(rows).map(([k, v]) => `${k}: ${v.join(' | ') || '-'}`).join('\n');
  }),
  scratch_write: U('Keep a private working note for THIS chat or run (it survives long conversations). Use it for intermediate findings, decisions and TODOs.', '{"key": "short name", "text": "note"}', async (c, a) => {
    const ref = scratchRef(c); const cur = (await ref.get()).data() ?? { notes: {} }; const key = str(a.key, 40).trim() || 'note';
    if (Object.keys(cur.notes).length >= 30 && !(key in cur.notes)) throw bad('Too many notes; overwrite or reuse a key');
    await ref.set({ notes: { ...cur.notes, [key]: str(a.text, 4000) }, updatedAt: now() }); return `Noted "${key}".`;
  }, { write: true }),
  scratch_read: U('Read the working notes saved for THIS chat or run (optionally one key).', '{"key?": "note name"}', async (c, a) => {
    const n = (await scratchRef(c).get()).data()?.notes ?? {}; const rows = Object.entries(n).filter(([k]) => !a.key || k === a.key);
    return rows.length ? rows.map(([k, v]) => `## ${k}\n${v}`).join('\n\n') : 'No notes yet.';
  }),
  checklist: U('A step list for THIS chat or run. action: set (replace with items), tick (mark item number done), show.', '{"action": "set|tick|show", "items?": "list of steps, one per line", "index?": 1}', async (c, a) => {
    const ref = scratchRef(c); const cur = (await ref.get()).data() ?? { notes: {} }; let items = cur.checklist ?? [];
    if (a.action === 'set') items = list(a.items).slice(0, 30).map((t) => ({ t: String(t).slice(0, 200), done: false }));
    else if (a.action === 'tick') { const i = num(a.index, 'index') - 1; if (!items[i]) throw bad('No such item'); items[i].done = true; }
    else if (a.action !== 'show') throw bad('action must be set, tick or show');
    if (a.action !== 'show') await ref.set({ ...cur, checklist: items, updatedAt: now() });
    return items.length ? items.map((x, i) => `${i + 1}. [${x.done ? 'x' : ' '}] ${x.t}`).join('\n') + `\n${items.filter((x) => x.done).length}/${items.length} done` : 'Checklist is empty.';
  }, { write: true, props: { items: { type: 'array', items: { type: 'string' } } } }),

  /* ===== Web depth ===== */
  fetch_many: W('Read several public web pages at once (max 4). Faster than calling fetch_url repeatedly.', '{"urls": "list of URLs"}', async (_c, a) => {
    const urls = list(a.urls).slice(0, 4); if (!urls.length) throw bad('urls is empty');
    const out = await Promise.all(urls.map(async (u) => { try { return `# ${u}\n${textOf(await get(u)).slice(0, 2500)}`; } catch (e) { return `# ${u}\n(failed: ${e.tool ? e.message : 'error'})`; } })); return out.join('\n\n');
  }, { props: { urls: { type: 'array', items: { type: 'string' } } } }),
  extract_links: W('List the links on a public web page.', '{"url": "https://..."}', async (_c, a) => {
    const base = new URL(str(a.url, 2000)); const html = await get(a.url); const seen = new Set(); const out = [];
    for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) { let h; try { h = new URL(m[1], base).toString(); } catch { continue; } if (!/^https?:/.test(h) || seen.has(h)) continue; seen.add(h); out.push(`${textOf(m[2]).slice(0, 60) || '(no text)'} -> ${h}`); if (out.length >= 40) break; }
    return out.join('\n') || 'No links found.';
  }),
  page_meta: W('Read a page\'s title, description and Open Graph tags without loading the whole text.', '{"url": "https://..."}', async (_c, a) => {
    const html = (await get(a.url)).slice(0, 80_000); const meta = (n) => { const m = new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]+content=["']([^"']*)["']`, 'i').exec(html) ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${n}["']`, 'i').exec(html); return m ? textOf(m[1]) : ''; };
    return `title: ${tag(html, 'title')}\ndescription: ${meta('description') || meta('og:description')}\nog:title: ${meta('og:title')}\nog:type: ${meta('og:type')}\nauthor: ${meta('author')}`;
  }),
  rss_read: W('Read the latest items of an RSS or Atom feed.', '{"url": "feed URL", "limit?": 8}', async (_c, a) => {
    const xml = await get(a.url); const items = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].slice(0, Math.min(Number(a.limit) || 8, 15));
    if (!items.length) throw bad('No feed items found'); return `${tag(xml, 'title')}\n` + items.map((m) => { const x = m[0]; const link = /<link[^>]*href=["']([^"']+)["']/i.exec(x)?.[1] ?? tag(x, 'link'); return `- ${tag(x, 'title')} (${tag(x, 'pubDate') || tag(x, 'updated') || tag(x, 'published')})\n  ${link}\n  ${tag(x, 'description').slice(0, 200) || tag(x, 'summary').slice(0, 200)}`; }).join('\n');
  }),
  github_read: W('Read public GitHub data. kind: readme, tree (files in a folder), file (needs path), issues, prs, commits.', '{"repo": "owner/name", "kind": "readme|tree|file|issues|prs|commits", "path?": "folder or file path"}', async (_c, a) => {
    const repo = str(a.repo, 100); if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw bad('repo must look like owner/name'); const api = `https://api.github.com/repos/${repo}`; const p = str(a.path, 200).replace(/^\/+/, '');
    if (a.kind === 'readme') return textOf(await get(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`)).slice(0, 5000);
    if (a.kind === 'file') { if (!p) throw bad('path is required'); return (await get(`https://raw.githubusercontent.com/${repo}/HEAD/${p}`)).slice(0, 8000); }
    if (a.kind === 'tree') { const r = await get(`${api}/contents/${p}`, 'json'); return (Array.isArray(r) ? r : [r]).slice(0, 80).map((x) => `${x.type === 'dir' ? '[dir] ' : ''}${x.path}${x.size ? ` (${x.size}b)` : ''}`).join('\n'); }
    if (a.kind === 'issues' || a.kind === 'prs') { const r = await get(`${api}/${a.kind === 'prs' ? 'pulls' : 'issues'}?per_page=15&state=open`, 'json'); return r.filter((x) => a.kind === 'prs' || !x.pull_request).map((x) => `#${x.number} ${x.title} (${x.user?.login})`).join('\n') || 'None open.'; }
    if (a.kind === 'commits') return (await get(`${api}/commits?per_page=10`, 'json')).map((x) => `${x.sha.slice(0, 7)} ${x.commit.message.split('\n')[0].slice(0, 90)} (${x.commit.author?.name})`).join('\n');
    throw bad('kind must be readme, tree, file, issues, prs or commits');
  }),
  npm_info: W('Look up an npm package: latest version, description, license, links.', '{"name": "package name"}', async (_c, a) => {
    const n = str(a.name, 100); if (!/^(@[\w.-]+\/)?[\w.-]+$/.test(n)) throw bad('Invalid package name'); const r = await get(`https://registry.npmjs.org/${n.replace('/', '%2F')}`, 'json'); const v = r['dist-tags']?.latest;
    return `${r.name}@${v}\n${r.description ?? ''}\nlicense ${r.license ?? '?'} | modified ${r.time?.modified ?? '?'}\nhome ${r.homepage ?? '-'}`;
  }),
  wikipedia: W('Summary of a Wikipedia topic.', '{"query": "topic"}', async (_c, a) => {
    const q = str(a.query, 120); const s = await get(`https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&format=json&search=${encodeURIComponent(q)}`, 'json'); const title = s[1]?.[0]; if (!title) return 'No Wikipedia article found.';
    const r = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, 'json'); return `${r.title}: ${r.extract}\n${r.content_urls?.desktop?.page ?? ''}`;
  }),
  weather: W('Current weather and a 3-day forecast for a place.', '{"place": "city name"}', async (_c, a) => {
    const g = (await get(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(str(a.place, 80))}`, 'json')).results?.[0]; if (!g) throw bad('Place not found');
    const w = await get(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=3`, 'json'); const c = w.current;
    return `${g.name}, ${g.country}: ${c.temperature_2m}°C (feels ${c.apparent_temperature}°C), humidity ${c.relative_humidity_2m}%, wind ${c.wind_speed_10m} km/h, rain ${c.precipitation} mm\n` + w.daily.time.map((d, i) => `${d}: ${w.daily.temperature_2m_min[i]} to ${w.daily.temperature_2m_max[i]}°C, rain ${w.daily.precipitation_sum[i]} mm`).join('\n');
  }),
  currency_convert: W('Convert money between currencies at the latest reference rate.', '{"amount": 100, "from": "USD", "to": "INR"}', async (_c, a) => {
    const f = str(a.from, 3).toUpperCase(), t = str(a.to, 3).toUpperCase(), amt = num(a.amount, 'amount'); const r = await get(`https://api.frankfurter.app/latest?amount=${amt}&from=${f}&to=${t}`, 'json'); return `${amt} ${f} = ${r.rates?.[t]} ${t} (rate date ${r.date})`;
  }),
  http_json: W('GET a public JSON API and optionally pick a field with a path (a.b[0].c).', '{"url": "https://...", "path?": "a.b[0]"}', async (_c, a) => { const j = await get(a.url, 'json'); return pretty(a.path ? jsonPath(j, a.path) : j).slice(0, 6000); }),

  /* ===== Files ===== */
  file_find: T('File System', 'Find files in the workspace by name.', '{"query": "part of a file name"}', async (c, a) => {
    const low = str(a.query, 80).toLowerCase(); const rows = (await userCol(c.uid, 'files').limit(300).get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((f) => !low || f.name?.toLowerCase().includes(low)).slice(0, 25);
    return rows.length ? rows.map((f) => `${f.id} | ${f.name} | ${f.size} bytes | ${f.mime}`).join('\n') : 'No matching files.';
  }),
  file_read: T('File System', 'Read a text file from the workspace (CSV, Markdown, code, JSON...). Pass its name or id.', '{"name": "file name or id", "offset?": 0}', async (c, a) => {
    const f = await findFile(c.uid, a.name); if (!f) throw bad('No such file');
    if (f.size > 3_000_000 || !/text|json|csv|xml|markdown|javascript|yaml/i.test(f.mime || '') && !/\.(txt|md|csv|json|js|ts|py|html|css|yml|yaml|xml|log|sql)$/i.test(f.name)) throw bad(`Cannot read ${f.mime || 'that type'} as text`);
    let body; try { ({ body } = await getFileStream(c.uid, f.id)); } catch (e) { throw bad(e.statusCode === 501 ? 'File storage is not configured' : 'Could not open that file'); }
    const chunks = []; for await (const ch of body) { chunks.push(Buffer.from(ch)); if (chunks.reduce((s, x) => s + x.length, 0) > 3_000_000) break; }
    const text = Buffer.concat(chunks).toString('utf8'); const off = Math.max(0, Number(a.offset) || 0); return `${f.name} (${text.length} chars)${off ? ` from ${off}` : ''}:\n${text.slice(off, off + 5500)}${text.length > off + 5500 ? `\n…[more: call again with offset ${off + 5500}]` : ''}`;
  }),
  file_search: T('File System', 'Search inside text files for words (finds which file and the matching lines).', '{"query": "words to find"}', async (c, a) => {
    const t = terms(a.query); if (!t.length) throw bad('query needs words of 3+ letters');
    const files = (await userCol(c.uid, 'files').limit(60).get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((f) => f.size < 500_000 && /\.(txt|md|csv|json|js|ts|py|html|css|yml|yaml|xml|log|sql)$/i.test(f.name));
    const hits = [];
    for (const f of files.slice(0, 25)) { try { const { body } = await getFileStream(c.uid, f.id); let s = ''; for await (const ch of body) s += Buffer.from(ch).toString('utf8'); const ls = s.split('\n'); ls.forEach((l, i) => { const sc = t.reduce((n, w) => n + (l.toLowerCase().includes(w) ? 1 : 0), 0); if (sc) hits.push({ sc, txt: `${f.name}:${i + 1}: ${l.trim().slice(0, 160)}` }); }); } catch { /* skip unreadable */ } }
    return hits.length ? hits.sort((x, y) => y.sc - x.sc).slice(0, 20).map((h) => h.txt).join('\n') : 'No matches in the files.';
  }),

  /* ===== Memory, knowledge, tasks upkeep ===== */
  memory_list: T('Memory', 'List saved memories (newest first), optionally by kind.', '{"kind?": "note|idea|decision|fact|journal|link", "limit?": 15}', async (c, a) => {
    const rows = (await userCol(c.uid, 'memories').limit(300).get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !a.kind || m.kind === a.kind).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))).slice(0, Math.min(Number(a.limit) || 15, 40));
    return rows.length ? rows.map((m) => `${m.id} | ${m.kind}${m.pinned ? ' | pinned' : ''} | ${m.text.slice(0, 160)}`).join('\n') : 'No memories.';
  }),
  memory_update: T('Memory', 'Edit the text of an existing memory (by id) when a fact changed.', '{"id": "memory id", "text": "new text"}', async (c, a) => {
    const ref = userCol(c.uid, 'memories').doc(str(a.id, 60)); const m = (await ref.get()).data(); if (!m) throw bad('No such memory'); const text = str(a.text, 2000).trim(); if (!text) throw bad('text is required');
    await ref.set({ ...m, text, updatedAt: now() }); return 'Memory updated.';
  }, { write: true }),
  memory_forget: T('Memory', 'Delete one memory by id (only when the owner asked or it is clearly wrong).', '{"id": "memory id"}', async (c, a) => {
    const ref = userCol(c.uid, 'memories').doc(str(a.id, 60)); if (!(await ref.get()).exists) throw bad('No such memory'); await ref.delete(); return 'Memory deleted.';
  }, { write: true, needsApproval: true }),
  knowledge_add: T('Vector Search', 'Save a note into the Knowledge library so it can be searched later.', '{"name": "title", "text": "content"}', async (c, a) => {
    const text = str(a.text, 50_000).trim(); if (!text) throw bad('text is required'); const ref = userCol(c.uid, 'knowledge').doc(); const ts = now();
    await ref.set({ kind: 'note', name: str(a.name, 120) || 'Note', text, size: text.length, status: 'pending', createdAt: ts, updatedAt: ts }); await indexKnowledge(c.uid, ref.id); return 'Added to Knowledge.';
  }, { write: true }),
  knowledge_read: T('Vector Search', 'Read the full text of one Knowledge item by (part of) its name.', '{"name": "item name", "offset?": 0}', async (c, a) => {
    const low = str(a.name, 100).toLowerCase(); const d = (await userCol(c.uid, 'knowledge').limit(300).get()).docs.find((x) => x.id === a.name || x.data().name?.toLowerCase().includes(low)); if (!d) throw bad('No such knowledge item');
    const k = d.data(); const off = Math.max(0, Number(a.offset) || 0); const t = k.text ?? ''; return `${k.name} (${t.length} chars):\n${t.slice(off, off + 5500)}${t.length > off + 5500 ? `\n…[more: offset ${off + 5500}]` : ''}`;
  }),
  task_update: T('Calendar', 'Change a task: status (todo|doing|done), title or due date.', '{"match": "id or title text", "status?": "todo|doing|done", "title?": "new title", "dueAt?": "ISO date"}', async (c, a) => {
    const q = str(a.match, 100).toLowerCase(); const docs = (await userCol(c.uid, 'tasks').limit(300).get()).docs.filter((d) => d.id === a.match || d.data().title?.toLowerCase().includes(q));
    if (!docs.length) throw bad('No matching task'); if (docs.length > 1) throw bad(`Several match: ${docs.slice(0, 5).map((d) => d.data().title).join(' | ')}`);
    const t = { ...docs[0].data(), updatedAt: now() }; if (['todo', 'doing', 'done'].includes(a.status)) t.status = a.status; if (a.title) t.title = str(a.title, 200); if (a.dueAt) { const x = Date.parse(a.dueAt); if (!Number.isFinite(x)) throw bad('dueAt must be ISO'); t.dueAt = new Date(x).toISOString(); }
    await docs[0].ref.set(t); await hooks.tasks?.(c.uid, docs[0].id, t, 'set'); return `Updated "${t.title}" (${t.status}).`;
  }, { write: true }),
  calendar_delete: T('Calendar', 'Delete one calendar event or reminder (by id or title text).', '{"match": "id or title text"}', async (c, a) => {
    const q = str(a.match, 100).toLowerCase(); const docs = (await userCol(c.uid, 'events').limit(300).get()).docs.filter((d) => d.id === a.match || d.data().title?.toLowerCase().includes(q));
    if (!docs.length) throw bad('No matching event'); if (docs.length > 1) throw bad(`Several match: ${docs.slice(0, 5).map((d) => d.data().title).join(' | ')}`);
    const e = docs[0].data(); await docs[0].ref.delete(); await hooks.events?.(c.uid, docs[0].id, e, 'delete'); return `Deleted "${e.title}".`;
  }, { write: true, needsApproval: true }),

  /* ===== Delegation (planner, ops, halo, flow, research, spark) ===== */
  ask_mate: T('Delegation', 'Ask another Mate a focused question and get their answer (they can think but not use tools). Use it for a second opinion or a specialist view.', '{"mate": "mate key from mates_list", "question": "self-contained question with the needed context"}', async (c, a) => {
    if (!hooks.ask) throw bad('Delegation is unavailable'); if (c.depth) throw bad('A Mate that was asked cannot ask further Mates'); if (a.mate === c.mate) throw bad('Pick a different Mate');
    return hooks.ask(c.uid, str(a.mate, 30), str(a.question, 4000));
  }),
  spawn_run: T('Delegation', 'Start a background run (a multi-step task executed by the team) and return its id. Check on it with run_status.', '{"goal": "clear description of the task and the expected result", "title?": "short title"}', async (c, a) => {
    if (!hooks.startRun) throw bad('Runs are unavailable'); if (c.depth) throw bad('Not allowed here'); const goal = str(a.goal, 6000).trim(); if (goal.length < 12) throw bad('goal needs more detail');
    const r = await hooks.startRun(c.uid, { prompt: goal, title: a.title ? str(a.title, 80) : undefined, unattended: !!c.unattended }); return `Started run ${r.id} ("${r.title}"). Check it with run_status.`;
  }, { write: true }),
  run_steer: T('Delegation', 'Send a new instruction to a run that is in progress.', '{"id": "run id", "text": "what to change or focus on"}', async (c, a) => {
    if (!hooks.steer) throw bad('Run control is unavailable'); try { hooks.steer(c.uid, str(a.id, 60), str(a.text, 2000)); } catch (e) { throw bad(e.message); } return `Sent to ${a.id}.`;
  }, { write: true }),
  notify_me: T('Utilities', 'Send the owner a short Telegram message (needs Telegram linked). Use sparingly, for results or things needing a decision.', '{"text": "message, under 500 characters"}', async (c, a) => {
    if (!hooks.notify) throw bad('Notifications are unavailable'); const n = await hooks.notify(c.uid, `🔔 ${str(a.text, 500)}`); return n ? `Sent to ${n} chat(s).` : 'Not delivered: Telegram is not linked, so tell the owner in this chat instead.';
  }, { write: true }),
  call_me: T('Utilities', 'Ring the owner for a voice call about something important or urgent (sends a Telegram message with a tap-to-call link). Say why in one sentence.', '{"reason": "why you are calling, one sentence"}', async (c, a) => {
    if (!hooks.notify) throw bad('Notifications are unavailable'); const site = (env('DASHBOARD_URL') || env('ALLOWED_ORIGINS').split(',')[0] || '').trim().replace(/\/$/, '');
    if (!site) throw bad('The dashboard address is not configured (DASHBOARD_URL)');
    const reason = str(a.reason, 300).trim(); if (!reason) throw bad('reason is required');
    const link = `${site}/call?mate=${encodeURIComponent(c.mate ?? 'mimo')}&reason=${encodeURIComponent(reason)}`;
    const n = await hooks.notify(c.uid, `📞 ${c.mate ?? 'A Mate'} wants to talk: ${reason}\nTap to answer: ${link}`);
    return n ? 'Ringing: the owner got a Telegram message with a tap-to-call link.' : 'Could not ring: Telegram is not linked. Tell the owner in this chat instead.';
  }, { write: true }),
};
