// Deep research harness: long, careful jobs on primary technical sources (datasheets and application notes, patents,
// and claims in general), supervised the way the coding harness supervises a coder. A run step of kind "research":
//   1. brief    the Research Mate writes the question, what counts as an answer, the subjects (part or patent numbers),
//               the comparison parameters, the claims to test and the web searches to run
//   2. collect  the owner's uploaded files first, then addresses named in the job, patent pages and PDFs found by search;
//               each is downloaded into the step's folder with where it came from, robots.txt and a per-site pace are
//               respected, and byte-identical copies (revisions served twice) are dropped
//   3. extract  PDFs page by page with pdf.js (local and free); lines are rebuilt from positions and wide gaps become
//               " | " so table columns survive. Patent pages become metadata plus a claim tree
//   4. analyse  datasheets: every parameter with value, unit, test conditions, page, table and an exact quote;
//               patents: independent claims split into elements, a claim chart against the target, a priority timeline;
//               claims: supported / partly supported / unsupported / contradicted, each with citations
//   5. review   the PROGRAM checks every quote against its page (normalised spacing only). What is not found goes back
//               to the model with the reason, up to 3 rounds; still missing = dropped and listed. Then a second model
//               pass with Halo's eye flags overreach, which goes into the report as open questions
//   6. report   the answer first, then tables built by the program from verified values only (so no number is rounded
//               or converted on the way), the claim chart, open questions and the sources with page references
// Not legal advice: patent reports say infringement and validity need a patent attorney.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { dir } from '../lib/paths.js';
import { now } from '../lib/env.js';

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const MAX_DOCS = 8, MAX_PAGES = 200, MAX_BYTES = 25 * 1024 * 1024, ROUNDS = 3;
export const RESEARCH_MODES = ['datasheet', 'patent', 'claims', 'general'];

/* ---------- web access, bound by tools.js (one SSRF guard and one search for everything) ---------- */
let web = { safeFetch: null, search: null };
export const bindResearch = (w) => { web = { ...web, ...w }; };

/* ---------- text helpers ---------- */
const decode = (s) => String(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
export const htmlText = (h) => decode(String(h).replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim();
/** Spacing, dashes, quotes and table separators normalised, so a quote copied from a page matches it. */
export const norm = (s) => String(s ?? '').toLowerCase().replace(/ \| /g, ' ').replace(/[‐-―−]/g, '-').replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/µ/g, 'μ').replace(/\s+/g, ' ').trim();
const termsOf = (s) => [...new Set((String(s).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []))].slice(0, 30);

/* ---------- extract: PDFs ---------- */
/** Rebuild lines from pdf.js text items: same baseline = same line; wide gaps become " | " (table columns). */
export function linesFromItems(items) {
  const its = items.filter((it) => it.str && it.str.trim()).map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || it.str.length * 5, h: Math.abs(it.transform[3]) || it.height || 10 }));
  its.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of its) { const r = rows.at(-1); if (r && Math.abs(r.y - it.y) <= Math.max(2, it.h * 0.4)) r.items.push(it); else rows.push({ y: it.y, items: [it] }); }
  return rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x); let line = '', end = null;
    for (const it of r.items) { const gap = end == null ? 0 : it.x - end; line += end == null ? it.s : gap > Math.max(12, it.h * 1.2) ? ` | ${it.s}` : gap > it.h * 0.15 || /\s$/.test(line) ? `${/\s$/.test(line) ? '' : ' '}${it.s}` : it.s; end = it.x + it.w; }
    return line.trim();
  }).filter(Boolean);
}
async function pdfWithPdfjs(buf) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(buf), disableFontFace: true, isEvalSupported: false, useSystemFonts: false, verbosity: 0, stopAtErrors: false });
  const pages = [];
  try {
    const doc = await task.promise;
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) { const p = await doc.getPage(i); pages.push(linesFromItems((await p.getTextContent()).items).join('\n')); p.cleanup(); }
    return { pages, total: doc.numPages };
  } finally { await Promise.resolve(task.destroy?.()).catch(() => {}); }
}
/** Fallback when pdf.js cannot read a file: poppler's pdftotext, if it is installed. */
function pdfWithPoppler(file) {
  return new Promise((done) => {
    const c = spawn('pdftotext', ['-layout', '-l', String(MAX_PAGES), file, '-'], { windowsHide: true }); let out = '';
    c.stdout.on('data', (d) => { if (out.length < 20_000_000) out += d; }); c.on('error', () => done(null));
    c.on('close', (code) => done(code === 0 ? { pages: out.split('\f').map((p) => p.replace(/ {3,}/g, ' | ').trim()).filter((p, i, a) => p || i < a.length - 1), total: null } : null));
  });
}
export async function pdfPages(buf, file = '') {
  try { return await pdfWithPdfjs(buf); }
  catch (e) { const p = file ? await pdfWithPoppler(file) : null; if (p?.pages.length) return p; throw new Error(`Could not read the PDF (${clip(e.message, 120)}).`); }
}
/** "Table 7-1. Electrical characteristics" captions on a page, for citations. */
export const tablesOn = (page) => [...String(page).matchAll(/^(Table\s+[\dA-Z][\w-]*(?:\.\w[\w-]*)*)[.:]?\s*(.*)$/gim)].map((m) => `${m[1]}${m[2] ? ` ${clip(m[2], 60)}` : ''}`);

/* ---------- extract: patents ---------- */
const PAT = /\b(US|EP|WO|CN|JP|KR|DE|GB|FR|CA|AU|IN|TW)[\s-]?((?:\d{4}\/)?\d{1,3}(?:[,.]?\d{3}){1,3}|\d{5,12})[\s-]?([ABCUESYT]\d?)?\b/g;
/** Patent numbers in free text, normalised the way Google Patents addresses them (US10123456B2). */
export const patentNumbers = (text) => [...new Set([...String(text).matchAll(PAT)].map((m) => `${m[1].toUpperCase()}${m[2].replace(/[,./]/g, '')}${(m[3] ?? '').toUpperCase()}`))].slice(0, 6);
const meta = (h, name) => decode(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]*)"`, 'i').exec(h)?.[1] ?? '').trim();
const prop = (h, p) => decode((new RegExp(`itemprop="${p}"[^>]*(?:datetime="([^"]+)"[^>]*)?>([^<]*)<`, 'i').exec(h) ?? []).slice(1).find(Boolean) ?? '').trim();
/** A Google Patents page: metadata, abstract, claims as a tree (dependent claims point at their parent), citations. */
export function parsePatentHtml(h, url = '') {
  const claimsSec = /<section[^>]*itemprop="claims"[\s\S]*?<\/section>/i.exec(h)?.[0] ?? '';
  const starts = [...claimsSec.matchAll(/<div[^>]*class="claim(?:-dependent)?"[^>]*num="(\d+)"[^>]*>|<div[^>]*num="(\d+)"[^>]*class="claim(?:-dependent)?"[^>]*>/gi)];
  const claims = [];
  starts.forEach((m, i) => {
    const num = Number(m[1] ?? m[2]); if (claims.some((c) => c.num === num)) return;
    const part = claimsSec.slice(m.index, starts[i + 1]?.index ?? claimsSec.length);
    const text = htmlText(part).replace(/^\d+\s*[.)]\s*/, '').replace(/\s+/g, ' ').trim();
    const ref = /claim-ref[^>]*idref="CLM-0*(\d+)"/i.exec(part)?.[1] ?? /\b(?:according to|as claimed in|as recited in|as defined in|of|in) claims? (\d+)\b/i.exec(text)?.[1];
    if (text) claims.push({ num, text, dependsOn: ref && Number(ref) !== num ? Number(ref) : null });
  });
  const cites = [...h.matchAll(/itemprop="backwardReferences(?:Orig|Family)?"[\s\S]*?itemprop="publicationNumber"[^>]*>([^<]+)</gi)].map((m) => m[1].trim());
  const citedBy = [...h.matchAll(/itemprop="forwardReferences(?:Orig|Family)?"[\s\S]*?itemprop="publicationNumber"[^>]*>([^<]+)</gi)].map((m) => m[1].trim());
  const family = [...h.matchAll(/itemprop="(?:docdbFamily|family)"[\s\S]*?itemprop="publicationNumber"[^>]*>([^<]+)</gi)].map((m) => m[1].trim());
  return {
    number: (meta(h, 'citation_patent_publication_number') || meta(h, 'citation_patent_number') || prop(h, 'publicationNumber') || patentNumbers(url)[0] || '').replace(/:/g, ''),
    title: meta(h, 'DC.title') || clip(htmlText(/<title>([\s\S]*?)<\/title>/i.exec(h)?.[1] ?? ''), 200),
    assignee: (/<meta[^>]+name="DC.contributor"[^>]+content="([^"]+)"[^>]+scheme="assignee"/i.exec(h)?.[1] ?? prop(h, 'assigneeCurrent') ?? prop(h, 'assigneeOriginal')).trim(),
    inventors: [...h.matchAll(/<meta[^>]+name="DC.contributor"[^>]+content="([^"]+)"[^>]+scheme="inventor"/gi)].map((m) => decode(m[1])).slice(0, 10),
    priorityDate: prop(h, 'priorityDate'), filingDate: prop(h, 'filingDate'), publicationDate: prop(h, 'publicationDate') || meta(h, 'DC.date'),
    status: prop(h, 'status') || prop(h, 'legalStatusIfi'), abstract: clip(htmlText(/<section[^>]*itemprop="abstract"[\s\S]*?<\/section>/i.exec(h)?.[0] ?? meta(h, 'DC.description')), 3000),
    claims, citations: [...new Set(cites)].slice(0, 40), citedBy: [...new Set(citedBy)].slice(0, 40), family: [...new Set(family)].slice(0, 40),
  };
}
/** The elements of an independent claim: the preamble, then each limitation (split on ";" after "comprising:"). */
export function claimElements(c) {
  const i = c.text.search(/\b(comprising|consisting of|including|wherein|characterized in that)\b[^:]*:/i);
  const colon = i >= 0 ? c.text.indexOf(':', i) : c.text.indexOf(':');
  const pre = colon > 0 ? c.text.slice(0, colon + 1).trim() : '';
  const body = colon > 0 ? c.text.slice(colon + 1) : c.text;
  const parts = body.split(/;\s*(?:and\s+)?/).map((s) => s.trim().replace(/[.;]$/, '')).filter((s) => s.length > 3);
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return [...(pre ? [{ id: `${c.num}pre`, text: pre }] : []), ...parts.slice(0, 26).map((t, k) => ({ id: `${c.num}${letters[k]}`, text: t }))];
}
/** A patent as pages for citation: p1 = bibliographic data and abstract, p2 = the claims (cited by claim number). */
const patentPages = (p) => [
  `${p.number} ${p.title}\nAssignee: ${p.assignee}\nInventors: ${p.inventors.join(', ')}\nPriority date: ${p.priorityDate}\nFiling date: ${p.filingDate}\nPublication date: ${p.publicationDate}\nStatus: ${p.status}\nAbstract: ${p.abstract}`,
  p.claims.map((c) => `${c.num}. ${c.text}`).join('\n'),
];

/* ---------- collect ---------- */
const hostTimes = new Map(); const robots = new Map();
async function pace(host) { const last = hostTimes.get(host) ?? 0; const wait = last + 1100 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); hostTimes.set(host, Date.now()); }
/** robots.txt for LoopmatesBot (or *): Disallow prefixes, longest Allow wins. Unknown or unreachable = allowed. */
export function robotsAllows(txt, path) {
  let applies = false, any = false; const rules = [];
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); const m = /^(user-agent|allow|disallow)\s*:\s*(.*)$/i.exec(line); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (any) { applies = false; any = false; } applies = applies || v === '*' || /loopmates/i.test(v); continue; }
    any = true; if (applies && v) rules.push({ allow: k === 'allow', p: v.replace(/\*$/, '') });
  }
  const hit = rules.filter((r) => path.startsWith(r.p)).sort((a, b) => b.p.length - a.p.length)[0];
  return !hit || hit.allow;
}
async function allowedByRobots(u) {
  if (!robots.has(u.host)) robots.set(u.host, await web.safeFetch(`${u.protocol}//${u.host}/robots.txt`).then((r) => (r.ok ? r.text() : '')).catch(() => ''));
  return robotsAllows(robots.get(u.host), u.pathname + u.search);
}
async function download(url) {
  if (!web.safeFetch) throw new Error('Web access is not available.');
  const u = new URL(url);
  if (!(await allowedByRobots(u))) throw new Error(`${u.host} asks bots not to fetch this page (robots.txt)`);
  await pace(u.host);
  const res = await web.safeFetch(u.toString(), { headers: { accept: 'application/pdf,text/html;q=0.9,*/*;q=0.5' } });
  if (!res.ok) throw new Error(`${u.host} answered ${res.status}`);
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('larger than 25 MB');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('larger than 25 MB');
  const type = res.headers.get('content-type') ?? '';
  return { buf, type: /pdf/i.test(type) || buf.subarray(0, 5).toString() === '%PDF-' ? 'pdf' : /html/i.test(type) ? 'html' : /text|json|xml/.test(type) ? 'text' : 'other' };
}
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

/* ---------- the harness ---------- */
const BRIEF = `You write the research brief for a deep technical research job on primary documents. Reply JSON only:
{"mode":"datasheet|patent|claims|general","question":"the question in one sentence","answer":"what a complete answer looks like","subjects":["part numbers, product names or patent numbers"],"parameters":["for datasheets: the exact parameters to compare"],"claims":["for claims: each claim to test, word for word"],"target":"for patents: the product or document to chart the claims against, or empty","searches":["up to 4 web searches that find PRIMARY documents (manufacturer datasheet PDFs, application notes, patent records, standards), not summaries"]}
Use "datasheet" for electrical/mechanical ratings and comparisons of parts, "patent" for patent claims, dates, families and claim charts, "claims" to check what a vendor, paper or patent claims against the evidence, "general" otherwise. Never invent part or patent numbers.`;
const EXTRACT = `You extract values from technical documents for a cited comparison. Use ONLY the pages given. Reply JSON only:
{"values":[{"subject":"part or document","parameter":"as named in the brief","value":"exactly as printed","unit":"exactly as printed","conditions":"test conditions exactly as printed, e.g. VIN = 3.3 V, TA = 25 C","kind":"min|typ|max|nominal|rating","page":7,"table":"Table 7-1 or empty","quote":"the exact text from that page that contains the value, copied character for character"}],"gaps":["requested parameters these pages do not give"],"notes":["contradictions or errata you noticed"]}
Rules: copy values, units and conditions exactly; never round, convert or combine. One entry per value (min, typ and max are separate entries). If a value is not on these pages, list it under gaps instead of guessing. The quote must be text that really appears on that page.`;
const VERDICTS = ['supported', 'partly supported', 'unsupported', 'contradicted'];
const JUDGE = `You check a claim against evidence from primary documents. Use ONLY the pages given. Reply JSON only:
{"verdict":"supported|partly supported|unsupported|contradicted","why":"one or two sentences","citations":[{"doc":"D1","page":3,"quote":"exact text copied from that page"}]}
"supported" needs direct evidence; "partly supported" when only part of the claim is backed or conditions differ; "unsupported" when the documents do not address it; "contradicted" when they say otherwise. Every citation quote must really appear on that page.`;
const CHART = `You build a patent claim chart: for each claim element, find where the target shows it. Use ONLY the pages given. Reply JSON only:
{"elements":[{"id":"1a","status":"found|partly|not found","explain":"one sentence","doc":"D2","page":4,"quote":"exact text copied from that page"}]}
This is an engineering comparison, not a legal opinion. "found" needs the element plainly present in the target's text.`;
const REVIEW = `You review a research analysis before it goes to the owner, the way a careful reviewer would. Look for overreach: a verdict stronger than its quotes, values whose conditions differ but are compared as equal, missing units, gaps that are not mentioned. Reply JSON only: {"ok":true|false,"issues":["one line each"]}`;
const ANSWER = `You write the answer section of a research report. Use ONLY the verified findings given; never add numbers that are not in them, and never round or convert. Lead with the direct answer in 2 to 5 sentences, then "Open questions" as bullets (gaps, contradictions, reviewer notes). Markdown, no title, no preface.`;

/**
 * Run one research step. opts: { uid, runId, idx, prompt, label, notes, mate, fileIds, config, settings, chat, persona(key),
 * getFile(id) -> {name, buf}, log(text), gate() (throws when the run is stopped) }.
 * Returns { report, summary, sources: [url], data, dropped }.
 */
export async function runResearch(o) {
  const { chat, log, gate = async () => {} } = o;
  const work = dir('research', `${o.runId}-${o.idx}`);
  const ask = async (sys, user, { persona = 'research', maxTokens = 1800 } = {}) => {
    const r = await chat({ model: o.settings.model || '', json: true, temperature: 0.1, maxTokens, effort: 'medium', messages: [{ role: 'system', content: `${sys}\n\nWho you are:\n${o.persona(persona)}` }, { role: 'user', content: user }] });
    const t = r.text.replace(/```(?:json)?/gi, ''); const s = t.indexOf('{'), e = t.lastIndexOf('}');
    try { return s >= 0 ? JSON.parse(t.slice(s, e + 1)) : {}; } catch { return {}; }
  };

  /* 1. brief */
  const cfg = o.config ?? {};
  const listOf = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/[\n;]+/)).map((x) => clip(x, 200)).filter(Boolean);
  const b = await ask(BRIEF, `Job:\n${clip(o.prompt, 4000)}\n\nThis step: ${o.label}${cfg.parameters ? `\nParameters asked for: ${listOf(cfg.parameters).join('; ')}` : ''}${cfg.target ? `\nTarget: ${clip(cfg.target, 300)}` : ''}${o.notes ? `\n\nNotes from earlier steps:\n${clip(o.notes, 2500)}` : ''}`);
  const brief = { mode: RESEARCH_MODES.includes(b.mode) ? b.mode : patentNumbers(o.prompt).length ? 'patent' : 'general', question: clip(b.question || o.label, 300), answer: clip(b.answer, 400),
    subjects: listOf(b.subjects).slice(0, 8), parameters: [...new Set([...listOf(cfg.parameters), ...listOf(b.parameters)])].slice(0, 20), claims: listOf(b.claims).slice(0, 8), target: clip(cfg.target || b.target, 300), searches: listOf(b.searches).slice(0, 4) };
  log(`Brief (${brief.mode}): ${brief.question}${brief.parameters.length ? ` Parameters: ${brief.parameters.join(', ')}.` : ''}${brief.claims.length ? ` ${brief.claims.length} claim(s) to test.` : ''}`);
  await gate();

  /* 2. collect */
  const docs = []; const seen = new Set(); const skipped = [];
  const keep = async ({ buf, type, name, url = '', from }) => {
    if (docs.length >= MAX_DOCS) return; const h = sha(buf); if (seen.has(h)) { skipped.push(`${name || url}: the same file as one already collected`); return; } seen.add(h);
    const id = `D${docs.length + 1}`; const file = join(work, `${id}.${type === 'pdf' ? 'pdf' : type === 'html' ? 'html' : 'txt'}`); await writeFile(file, buf);
    docs.push({ id, name: clip(name || url, 160), url, from, type, sha256: h, bytes: buf.length, file, fetchedAt: now() });
  };
  for (const id of (o.fileIds ?? []).slice(0, MAX_DOCS)) {
    try { const f = await o.getFile(id); const pdf = /\.pdf$/i.test(f.name) || f.buf.subarray(0, 5).toString() === '%PDF-'; await keep({ buf: f.buf, type: pdf ? 'pdf' : /\.html?$/i.test(f.name) ? 'html' : 'text', name: f.name, from: 'your upload' }); }
    catch (e) { skipped.push(`uploaded file ${id}: ${clip(e.message, 120)}`); }
  }
  const wanted = []; const want = (url, why) => { if (!wanted.some((w) => w.url === url)) wanted.push({ url, why }); };
  for (const u of [...listOf(cfg.sources), ...(String(o.prompt).match(URL_RE) ?? [])]) if (/^https?:\/\//.test(u)) want(u.replace(/[.,;]+$/, ''), 'named in the job');
  for (const pn of patentNumbers([o.prompt, ...brief.subjects, brief.target].join(' '))) want(`https://patents.google.com/patent/${pn}/en`, `patent ${pn}`);
  if (o.settings.allowNetwork !== false && web.search) {
    for (const q of brief.searches) {
      await gate();
      const res = await web.search(q).catch((e) => { skipped.push(`search "${clip(q, 60)}": ${clip(e.message, 100)}`); return ''; });
      const urls = [...new Set(String(res).match(URL_RE) ?? [])].map((u) => u.replace(/[.,;]+$/, ''));
      const ranked = [...urls.filter((u) => /\.pdf(\?|$)/i.test(u)), ...urls.filter((u) => /patents\.google\.com\/patent\//.test(u)), ...urls.filter((u) => !/\.pdf(\?|$)/i.test(u) && !/patents\.google/.test(u))];
      for (const u of ranked.slice(0, 2)) want(u, `search: ${clip(q, 60)}`);
    }
  }
  for (const w of wanted) {
    if (docs.length >= MAX_DOCS) break; await gate();
    if (o.settings.allowNetwork === false) { skipped.push(`${w.url}: network access is switched off`); continue; }
    try { const d = await download(w.url); if (d.type === 'other') { skipped.push(`${w.url}: not a document`); continue; } await keep({ ...d, name: '', url: w.url, from: w.why }); log(`Collected ${docs.at(-1)?.id ?? ''} from ${new URL(w.url).host}.`); }
    catch (e) { skipped.push(`${w.url}: ${clip(e.message, 120)}`); }
  }
  if (!docs.length) throw new Error(`No primary documents could be collected${skipped.length ? ` (${skipped.slice(0, 3).join('; ')})` : ''}. Upload the datasheets or patents to the run, or name their addresses.`);
  log(`Collected ${docs.length} document(s)${skipped.length ? `; skipped ${skipped.length}` : ''}.`);

  /* 3. extract */
  for (const d of docs) {
    await gate();
    try {
      const raw = await readFile(d.file);
      if (d.type === 'pdf') { const p = await pdfPages(raw, d.file); d.pages = p.pages; d.totalPages = p.total ?? p.pages.length; d.name ||= clip(p.pages[0]?.split('\n')[0], 120); }
      else if (d.type === 'html' && (/patents\.google\.com/.test(d.url) || /itemprop="claims"/.test(raw.toString('utf8', 0, 400_000)))) { d.patent = parsePatentHtml(raw.toString('utf8'), d.url); d.pages = patentPages(d.patent); d.name ||= `${d.patent.number} ${d.patent.title}`.trim(); }
      else { const t = d.type === 'html' ? htmlText(raw.toString('utf8')) : raw.toString('utf8'); d.pages = t.match(/[\s\S]{1,6000}(?=\s|$)/g) ?? [t]; d.name ||= clip(t.split('\n')[0], 120); }
      d.tables = d.pages.map(tablesOn);
    } catch (e) { d.error = clip(e.message, 200); d.pages = []; skipped.push(`${d.id}: ${d.error}`); }
  }
  const readable = docs.filter((d) => d.pages?.some((p) => p.trim()));
  if (!readable.length) throw new Error(`None of the documents had readable text (${skipped.slice(-2).join('; ')}). Scanned PDFs need OCR, which is not available yet.`);
  log(`Extracted ${readable.reduce((n, d) => n + d.pages.length, 0)} page(s) from ${readable.length} document(s).`);
  await writeFile(join(work, 'sources.json'), JSON.stringify(docs.map(({ pages, tables, file, ...d }) => d), null, 2));

  /* pages most relevant to some words, with page markers, within a character budget */
  const pick = (d, words, { n = 6, budget = 9000, always = [0] } = {}) => {
    const t = termsOf(words); const scored = d.pages.map((p, i) => ({ i, s: t.reduce((a, w) => a + (p.toLowerCase().includes(w) ? 1 : 0), 0) + (/electrical characteristics|absolute maximum|recommended operating|specifications/i.test(p) ? 2 : 0) }));
    const chosen = [...new Set([...always.filter((i) => i < d.pages.length), ...scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.i)])].slice(0, n).sort((a, b) => a - b);
    let out = ''; for (const i of chosen) { const block = `=== ${d.id} page ${i + 1} ===\n${d.pages[i]}\n`; if (out.length + block.length > budget) break; out += block; }
    return out;
  };
  /** Does `quote` appear on page `page` of doc `d`? (normalised spacing, dashes and quotes; table separators ignored) */
  const onPage = (d, page, quote) => { const q = norm(quote); return q.length >= 3 && !!d?.pages?.[Number(page) - 1] && norm(d.pages[Number(page) - 1]).includes(q); };
  const docOf = (id) => readable.find((d) => d.id === String(id ?? '').toUpperCase()) ?? null;
  const dropped = [];

  /* 4 + 5. analyse, with the quote check in rounds */
  const data = { brief, values: [], gaps: [], notes: [], verdicts: [], charts: [], patents: [] };
  if (brief.mode === 'datasheet' || (brief.mode === 'general' && brief.parameters.length)) {
    for (const d of readable) {
      if (d.patent) continue;
      await gate();
      const pages = pick(d, `${brief.parameters.join(' ')} ${brief.subjects.join(' ')}`, { n: 8, budget: 11000, always: [0, 1] });
      let todo = null; let round = 0;
      while (round++ < ROUNDS) {
        const msg = round === 1 ? `Brief: ${brief.question}\nParameters: ${brief.parameters.join('; ') || '(the key ratings)'}\nDocument ${d.id}: ${d.name}\n\n${pages}`
          : `These values could not be found on the page you cited. Copy the quote exactly from the page text, or move the value to gaps:\n${todo.map((v) => `- ${v.parameter} = ${v.value} ${v.unit} (page ${v.page}): quote "${clip(v.quote, 160)}" ${v.why}`).join('\n')}\n\nDocument ${d.id}: ${d.name}\n\n${pages}`;
        const j = await ask(EXTRACT, msg, { maxTokens: 2500 });
        const vals = (Array.isArray(j.values) ? j.values : []).slice(0, 60).map((v) => ({ doc: d.id, subject: clip(v.subject || brief.subjects[0] || d.name, 80), parameter: clip(v.parameter, 100), value: clip(v.value, 40), unit: clip(v.unit, 20), conditions: clip(v.conditions, 200), kind: clip(v.kind, 12), page: Number(v.page) || 0, table: clip(v.table, 60), quote: clip(v.quote, 400) })).filter((v) => v.parameter && v.value);
        if (round === 1) { data.gaps.push(...(Array.isArray(j.gaps) ? j.gaps : []).map((g) => `${d.id}: ${clip(g, 160)}`)); data.notes.push(...(Array.isArray(j.notes) ? j.notes : []).map((g) => `${d.id}: ${clip(g, 200)}`)); }
        const bad = [];
        for (const v of vals) {
          const why = !onPage(d, v.page, v.quote) ? '(the quote is not on that page)' : !norm(v.quote).includes(norm(v.value)) ? '(the value is not in the quote)' : '';
          if (why) bad.push({ ...v, why }); else if (!data.values.some((x) => x.doc === v.doc && x.parameter === v.parameter && x.value === v.value && x.kind === v.kind)) data.values.push(v);
        }
        if (!bad.length) { todo = null; break; }
        todo = bad; if (round < ROUNDS) log(`${d.id}: ${bad.length} value(s) did not match their page; checking again (round ${round + 1}/${ROUNDS}).`);
      }
      for (const v of todo ?? []) dropped.push(`${d.id} p.${v.page}: ${v.parameter} = ${v.value} ${v.unit} ${v.why}`);
    }
  }
  if (brief.mode === 'claims' || (brief.mode === 'general' && brief.claims.length)) {
    for (const claim of brief.claims) {
      await gate();
      const pages = readable.map((d) => pick(d, claim, { n: 3, budget: 4000 })).join('\n').slice(0, 12000);
      let j = await ask(JUDGE, `Claim: ${claim}\n\n${pages}`);
      let cites = (Array.isArray(j.citations) ? j.citations : []).map((c) => ({ doc: String(c.doc ?? '').toUpperCase(), page: Number(c.page) || 0, quote: clip(c.quote, 400) }));
      for (let round = 2; round <= ROUNDS && cites.some((c) => !onPage(docOf(c.doc), c.page, c.quote)); round++) {
        log(`Claim "${clip(claim, 50)}": a citation did not match its page; checking again (round ${round}/${ROUNDS}).`);
        j = await ask(JUDGE, `Claim: ${claim}\n\nYour citations ${cites.filter((c) => !onPage(docOf(c.doc), c.page, c.quote)).map((c) => `${c.doc} p.${c.page} "${clip(c.quote, 100)}"`).join('; ')} are not on those pages. Copy quotes exactly, or drop them.\n\n${pages}`);
        cites = (Array.isArray(j.citations) ? j.citations : []).map((c) => ({ doc: String(c.doc ?? '').toUpperCase(), page: Number(c.page) || 0, quote: clip(c.quote, 400) }));
      }
      const good = cites.filter((c) => onPage(docOf(c.doc), c.page, c.quote));
      for (const c of cites.filter((x) => !good.includes(x))) dropped.push(`claim "${clip(claim, 60)}": ${c.doc} p.${c.page} quote not found`);
      let verdict = VERDICTS.includes(j.verdict) ? j.verdict : 'unsupported';
      if (!good.length && verdict !== 'unsupported') { verdict = 'unsupported'; dropped.push(`claim "${clip(claim, 60)}": marked unsupported because no citation could be verified`); }
      data.verdicts.push({ claim, verdict, why: clip(j.why, 400), citations: good });
    }
  }
  if (brief.mode === 'patent' || readable.some((d) => d.patent)) {
    for (const d of readable.filter((x) => x.patent)) {
      const p = d.patent; const indep = p.claims.filter((c) => !c.dependsOn);
      const tree = p.claims.map((c) => ({ num: c.num, dependsOn: c.dependsOn }));
      const entry = { doc: d.id, number: p.number, title: p.title, assignee: p.assignee, priorityDate: p.priorityDate, filingDate: p.filingDate, publicationDate: p.publicationDate, status: p.status, family: p.family, citations: p.citations, citedBy: p.citedBy, claimCount: p.claims.length, independent: indep.map((c) => c.num), tree, elements: indep.slice(0, 3).map((c) => ({ num: c.num, elements: claimElements(c) })) };
      const targets = readable.filter((x) => x !== d && !x.patent);
      if (brief.target || targets.length) {
        for (const c of entry.elements) {
          await gate();
          const pages = targets.map((t) => pick(t, c.elements.map((e) => e.text).join(' '), { n: 3, budget: 4500 })).join('\n').slice(0, 12000);
          if (!pages) break;
          const j = await ask(CHART, `Patent ${p.number}, claim ${c.num}. Target: ${brief.target || targets.map((t) => t.name).join('; ')}\nElements:\n${c.elements.map((e) => `${e.id}: ${e.text}`).join('\n')}\n\n${pages}`, { maxTokens: 2500 });
          const rows = (Array.isArray(j.elements) ? j.elements : []).map((e) => ({ id: clip(e.id, 12), status: ['found', 'partly', 'not found'].includes(e.status) ? e.status : 'not found', explain: clip(e.explain, 300), doc: String(e.doc ?? '').toUpperCase(), page: Number(e.page) || 0, quote: clip(e.quote, 400) }));
          for (const r of rows) if (r.status !== 'not found' && !onPage(docOf(r.doc), r.page, r.quote)) { dropped.push(`claim ${c.num} element ${r.id}: ${r.doc} p.${r.page} quote not found, marked not found`); Object.assign(r, { status: 'not found', quote: '', explain: `${r.explain} (its quote could not be verified)` }); }
          data.charts.push({ patent: p.number, claim: c.num, rows: c.elements.map((e) => ({ ...e, ...(rows.find((r) => r.id === e.id) ?? { status: 'not found', explain: 'not addressed' }) })) });
        }
      }
      data.patents.push(entry);
    }
  }
  if (brief.mode === 'general' && !data.values.length && !data.verdicts.length && !data.patents.length) {
    // a plain question: test the brief's question itself as a claim to answer from the documents
    const pages = readable.map((d) => pick(d, brief.question, { n: 4, budget: 5000 })).join('\n').slice(0, 12000);
    const j = await ask(JUDGE, `Claim: ${brief.question}\n\n${pages}`);
    const good = (Array.isArray(j.citations) ? j.citations : []).map((c) => ({ doc: String(c.doc ?? '').toUpperCase(), page: Number(c.page) || 0, quote: clip(c.quote, 400) })).filter((c) => onPage(docOf(c.doc), c.page, c.quote));
    data.verdicts.push({ claim: brief.question, verdict: VERDICTS.includes(j.verdict) && good.length ? j.verdict : 'unsupported', why: clip(j.why, 400), citations: good });
  }
  log(`Verified ${data.values.length} value(s), ${data.verdicts.length} claim verdict(s), ${data.charts.length} claim chart(s)${dropped.length ? `; dropped ${dropped.length} that did not match their source` : ''}.`);

  /* 5b. a second pair of eyes */
  await gate();
  const findings = JSON.stringify({ values: data.values.map(({ quote, ...v }) => v), verdicts: data.verdicts.map((v) => ({ claim: v.claim, verdict: v.verdict, why: v.why, quotes: v.citations.map((c) => c.quote) })), charts: data.charts, gaps: data.gaps, notes: data.notes }).slice(0, 14000);
  const rv = await ask(REVIEW, `Question: ${brief.question}\n\nFindings:\n${findings}`, { persona: 'halo', maxTokens: 800 });
  data.review = { ok: rv.ok !== false, issues: (Array.isArray(rv.issues) ? rv.issues : []).map((x) => clip(x, 300)).slice(0, 10) };
  log(data.review.ok ? 'Reviewer: no overreach found.' : `Reviewer flagged ${data.review.issues.length} issue(s); they are listed in the report.`);

  /* 6. report */
  await gate();
  const ans = await chat({ model: o.settings.model || '', temperature: 0.2, maxTokens: 1200, effort: 'medium', messages: [{ role: 'system', content: `${ANSWER}\n\nWho you are:\n${o.persona('writer')}` }, { role: 'user', content: `Question: ${brief.question}\nA complete answer: ${brief.answer || '(not specified)'}\n\nVerified findings:\n${findings}\n\nReviewer notes: ${data.review.issues.join(' | ') || 'none'}\nDropped as unverifiable: ${dropped.length}` }] }).then((r) => r.text.trim()).catch(() => '');
  const report = renderReport({ brief, docs, readable, data, dropped, skipped, answer: ans });
  await writeFile(join(work, 'report.md'), report); await writeFile(join(work, 'data.json'), JSON.stringify({ ...data, dropped, skipped }, null, 2));
  const summary = `${ans || `Research on: ${brief.question}`}\n\n${data.values.length ? `${data.values.length} verified value(s) from ${readable.length} document(s). ` : ''}${data.verdicts.length ? `${data.verdicts.map((v) => `"${clip(v.claim, 60)}": ${v.verdict}`).join('; ')}. ` : ''}Full report with page references in the run files.`;
  return { report, summary: summary.slice(0, 4000), sources: docs.map((d) => d.url).filter(Boolean), data, dropped, folder: work };
}

/* ---------- the report (tables are built here, from verified values only) ---------- */
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';
export function renderReport({ brief, docs, readable, data, dropped, skipped, answer }) {
  const ref = (doc, page, table) => `${doc} p.${page}${table ? `, ${table}` : ''}`;
  const out = [`# ${brief.question}`, '', `*Deep research · ${brief.mode} · ${readable.length} document(s) · ${now().slice(0, 10)}*`, ''];
  out.push('## Answer', '', answer || '_The writer could not produce a summary; the verified tables below are complete._', '');
  if (data.values.length) {
    out.push('## Parameters (verified against their page)', '', '| Subject | Parameter | Value | Unit | Kind | Conditions | Source |', '|---|---|---|---|---|---|---|');
    for (const v of [...data.values].sort((a, b) => a.parameter.localeCompare(b.parameter) || a.subject.localeCompare(b.subject))) out.push(`| ${cell(v.subject)} | ${cell(v.parameter)} | ${cell(v.value)} | ${cell(v.unit)} | ${cell(v.kind)} | ${cell(v.conditions)} | ${ref(v.doc, v.page, v.table)} |`);
    out.push('', 'Values are copied exactly as printed, with their test conditions. Compare rows only when the conditions match.', '');
  }
  if (data.verdicts.length) {
    out.push('## Claims checked', '', '| Claim | Verdict | Why | Evidence |', '|---|---|---|---|');
    for (const v of data.verdicts) out.push(`| ${cell(v.claim)} | **${v.verdict}** | ${cell(v.why)} | ${v.citations.map((c) => `${c.doc} p.${c.page}: "${cell(clip(c.quote, 140))}"`).join('<br>') || '—'} |`);
    out.push('');
  }
  for (const p of data.patents) {
    out.push(`## Patent ${p.number}${p.title ? `: ${p.title}` : ''}`, '');
    out.push(`- **Assignee:** ${p.assignee || 'not shown'}`, `- **Priority date:** ${p.priorityDate || 'not shown'} · **Filed:** ${p.filingDate || 'not shown'} · **Published:** ${p.publicationDate || 'not shown'}`, `- **Status:** ${p.status || 'not shown'}`, `- **Claims:** ${p.claimCount} (independent: ${p.independent.join(', ') || 'none found'})`);
    if (p.family.length) out.push(`- **Family:** ${p.family.slice(0, 15).join(', ')}`);
    if (p.citations.length) out.push(`- **Cites:** ${p.citations.slice(0, 15).join(', ')}${p.citations.length > 15 ? ' …' : ''}`);
    if (p.citedBy.length) out.push(`- **Cited by:** ${p.citedBy.slice(0, 15).join(', ')}${p.citedBy.length > 15 ? ' …' : ''}`);
    const deps = p.tree.filter((c) => c.dependsOn);
    if (deps.length) out.push(`- **Claim tree:** ${p.independent.map((n) => `${n} ← ${deps.filter((c) => c.dependsOn === n).map((c) => c.num).join(', ') || '—'}`).join('; ')}`);
    out.push('');
    for (const e of p.elements) out.push(`**Claim ${e.num} elements:**`, '', ...e.elements.map((x) => `- **${x.id}** ${x.text}`), '');
  }
  for (const c of data.charts) {
    out.push(`## Claim chart: ${c.patent}, claim ${c.claim}`, '', '| Element | Claim text | In the target? | Evidence |', '|---|---|---|---|');
    for (const r of c.rows) out.push(`| ${cell(r.id)} | ${cell(clip(r.text, 220))} | **${r.status}** ${cell(r.explain)} | ${r.quote ? `${r.doc} p.${r.page}: "${cell(clip(r.quote, 140))}"` : '—'} |`);
    out.push('');
  }
  if (data.gaps.length || data.notes.length || data.review?.issues.length) {
    out.push('## Gaps and open questions', '', ...data.gaps.map((g) => `- Not in the documents: ${g}`), ...data.notes.map((g) => `- ${g}`), ...(data.review?.issues ?? []).map((g) => `- Reviewer: ${g}`), '');
  }
  if (dropped.length) out.push('## Dropped (could not be verified against the source)', '', ...dropped.slice(0, 40).map((d) => `- ${d}`), '');
  out.push('## Sources', '', ...docs.map((d) => `- **${d.id}** ${cell(d.name)}${d.url ? ` · ${d.url}` : ''} · ${d.from}${d.totalPages ? ` · ${d.totalPages} pages` : ''} · sha256 ${d.sha256.slice(0, 12)}${d.error ? ` · could not be read: ${d.error}` : ''}`), '');
  if (skipped.length) out.push('Not collected: ', ...skipped.slice(0, 12).map((s) => `- ${s}`), '');
  if (data.patents.length || data.charts.length) out.push('> **Not legal advice.** This is an engineering reading of public patent records. Infringement, validity and freedom to operate need a patent attorney.', '');
  return out.join('\n');
}
