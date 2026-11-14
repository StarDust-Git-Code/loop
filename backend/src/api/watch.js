// Jarvis mode: the leader keeps watch and reaches the owner when something matters.
// watches  users/{uid}/watches/{id} = { kind: runs|calendar|topic|github, label, config, everyMinutes, enabled, lastCheckedAt, lastDigest }
// alerts   users/{uid}/alerts/{key}  = { key, source, title, detail, score 1-5, delivered: digest|notify|call|held, at, url }
// Every event is scored, then delivered on a ladder:
//   1-2 inbox + the daily briefing · 3 a message · 4 a message with a call link · 5 a voice call
// Calls are capped per day and respect quiet hours (only score 5 breaks through, if the owner allows it).
// Watches are scheduled through the shared `jobs` index (sched.js), so one query finds everything due.
import { createHash } from 'node:crypto';
import { db, userCol } from './db.js';
import { now, env } from '../lib/env.js';
import { chat, extractJson } from './llm.js';
import { getSettings } from './settings.js';
import { notify, isQuiet } from './notify.js';
import { createCall, listCalls } from './calls.js';
import { loadRoster } from './roster.js';
import { githubTokenFor } from './github.js';

export const WATCH_KINDS = ['runs', 'calendar', 'topic', 'github', 'feed', 'home'];
const MIN_EVERY = { runs: 5, calendar: 5, topic: 60, github: 15, feed: 30, home: 2 };
const jobs = db.collection('jobs');
const jobKey = (uid, id) => `${uid}_watch_${id}`;
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const hash = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 32);

/* ---------- scheduling (crud hook for the watches collection) ---------- */
export async function watchHook(uid, id, doc, op) {
  const key = jobKey(uid, id);
  if (op === 'delete' || !doc || doc.enabled === false || !WATCH_KINDS.includes(doc.kind)) return void jobs.doc(key).delete().catch(() => {});
  const every = Math.max(MIN_EVERY[doc.kind] ?? 15, Number(doc.everyMinutes) || 0) * 60_000;
  const last = Date.parse(doc.lastCheckedAt ?? '') || 0;
  await jobs.doc(key).set({ uid, kind: 'watch', refId: id, title: doc.label ?? doc.kind, nextAt: Math.max(Date.now() + 5_000, last + every), every });
}
/** The runs and calendar watches exist for everyone (cheap, no model calls); created on first use. */
export async function ensureDefaultWatches(uid) {
  const col = userCol(uid, 'watches'); const have = (await col.limit(100).get()).docs.map((d) => d.data().kind);
  for (const [kind, label] of [['runs', 'Runs and approvals'], ['calendar', 'Deadlines and calendar']]) {
    if (have.includes(kind)) continue;
    const ref = col.doc(); const doc = { kind, label, config: {}, everyMinutes: 5, enabled: true, createdAt: now(), updatedAt: now(), createdBy: 'default' };
    await ref.set(doc); await watchHook(uid, ref.id, doc, 'set');
  }
  // The nightly review is on by default too: make sure its job exists (without resetting a postponed one).
  if (!(await jobs.doc(`${uid}_reflect_daily`).get()).exists) await (await import('./reflect.js')).reflectHook(uid).catch(() => {});
}
export async function addWatch(uid, { kind, label, config = {}, everyMinutes, by = 'owner' }) {
  if (!WATCH_KINDS.includes(kind)) throw Object.assign(new Error(`kind must be one of ${WATCH_KINDS.join(', ')}`), { tool: true, statusCode: 400 });
  const need = (ok, m) => { if (!ok) throw Object.assign(new Error(m), { tool: true, statusCode: 400 }); };
  need(kind !== 'topic' || clip(config.query, 200), 'A topic watch needs a query');
  need(kind !== 'feed' || /^https?:\/\//.test(clip(config.url, 500)), 'A feed watch needs the feed url');
  need(kind !== 'home' || /^[a-z_]+\.[a-z0-9_]+$/.test(clip(config.entity, 120)), 'A home watch needs an entity id like binary_sensor.front_door');
  const ref = userCol(uid, 'watches').doc();
  const cfg = {
    ...(config.query ? { query: clip(config.query, 200) } : {}), ...(config.repo ? { repo: clip(config.repo, 120) } : {}), ...(config.url ? { url: clip(config.url, 500) } : {}),
    ...(config.entity ? { entity: clip(config.entity, 120) } : {}), ...(config.state ? { state: clip(config.state, 60) } : {}),
    ...(Number.isFinite(Number(config.above)) && config.above !== '' && config.above != null ? { above: Number(config.above) } : {}), ...(Number.isFinite(Number(config.below)) && config.below !== '' && config.below != null ? { below: Number(config.below) } : {}),
    ...(Number(config.forMinutes) > 0 ? { forMinutes: Math.min(1440, Number(config.forMinutes)) } : {}), ...(config.score ? { score: Math.min(5, Math.max(1, Number(config.score) || 3)) } : {}),
  };
  const auto = kind === 'topic' ? `News: ${clip(config.query, 60)}` : kind === 'feed' ? `Feed: ${clip(config.url, 60)}` : kind === 'home' ? `Home: ${clip(config.entity, 60)}${cfg.state ? ` is ${cfg.state}` : ''}` : kind;
  const doc = { kind, label: clip(label, 80) || auto, config: cfg, everyMinutes: Math.max(MIN_EVERY[kind], Number(everyMinutes) || MIN_EVERY[kind] * (kind === 'topic' ? 3 : 1)), enabled: true, createdAt: now(), updatedAt: now(), createdBy: by };
  await ref.set(doc); await watchHook(uid, ref.id, doc, 'set');
  return { id: ref.id, ...doc };
}

/* ---------- raising and delivering ---------- */
/** Score an event the rules cannot (topic news, GitHub activity) with the fast model. */
async function llmScore(uid, settings, ev) {
  try {
    const r = await chat(uid, { model: settings.fastModel || '', json: true, temperature: 0, maxTokens: 120, effort: 'low', messages: [
      { role: 'system', content: 'You decide how urgently a personal assistant should tell its owner about an event. Reply JSON only: {"score":1-5,"why":"one short reason"}. 1 = trivia, 2 = worth a daily digest, 3 = tell them today, 4 = tell them now, 5 = phone them now (money, safety, a hard deadline within the hour, something the owner explicitly asked to be called about).' },
      { role: 'user', content: `Owner's interests (from their watch): ${ev.context ?? ''}\nEvent: ${ev.title}\n${clip(ev.detail, 1200)}` }] });
    const j = extractJson(r.text); const s = Math.round(Number(j?.score));
    return s >= 1 && s <= 5 ? s : 2;
  } catch { return 2; }
}

/** Ring the owner through the leader. Returns 'call' or 'held' (and why). */
async function ring(uid, settings, { reason, goal = '', questions = [], urgent = false, mate = '' }) {
  if (isQuiet(settings) && !(urgent && settings.urgentBreaksQuiet !== false)) return { delivered: 'held', why: 'quiet hours' };
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const today = (await listCalls(uid, 30)).filter((c) => c.createdAt > since && c.source === 'watch').length;
  if (today >= (settings.maxCallsPerDay ?? 3)) return { delivered: 'held', why: `already ${today} calls today` };
  const site = (env('DASHBOARD_URL') || env('ALLOWED_ORIGINS').split(',')[0] || '').trim().replace(/\/$/, '');
  const call = await createCall(uid, { mate, goal: goal || reason, reason, questions, topic: reason.toLowerCase().slice(0, 60) });
  await userCol(uid, 'calls').doc(call.id).set({ source: 'watch' }, { merge: true });
  const link = site ? `${site}/call?mate=${encodeURIComponent(call.mate)}&call=${call.id}&reason=${encodeURIComponent(reason)}` : '';
  await notify(uid, `${call.mateName} is calling: ${reason}${link ? `\nTap to answer: ${link}` : ''}`, { title: `${call.mateName} is calling`, url: link || '/call', tag: 'call', urgent: true, kind: 'call' });
  return { delivered: 'call', callId: call.id };
}

/**
 * Raise one event: { key, source, title, detail, score?, url?, context?, questions? }.
 * Deduplicated by key (forever for runs/calendar, 3 days for news). Returns the alert, or null if it was seen before.
 */
export async function raise(uid, ev, { settings, watchId = '' } = {}) {
  settings ??= await getSettings(uid);
  const ref = userCol(uid, 'alerts').doc(hash(ev.key));
  const prev = (await ref.get()).data();
  if (prev && (ev.source !== 'topic' || Date.parse(prev.at) > Date.now() - 3 * 86_400_000)) return null;
  const score = Math.min(5, Math.max(1, Math.round(ev.score ?? await llmScore(uid, settings, ev))));
  const ro = await loadRoster(uid); const lead = ro.name(ro.leader);
  let delivered = 'digest', extra = {};
  const text = `${ev.title}${ev.detail ? `\n${clip(ev.detail, 600)}` : ''}`;
  if (score === 3) { delivered = (await notify(uid, text, { title: `${lead}: ${clip(ev.title, 60)}`, url: ev.url || '/', kind: 'note' })) ? 'notify' : 'digest'; }
  else if (score === 4) {
    const site = (env('DASHBOARD_URL') || '').replace(/\/$/, '');
    const callLink = site ? `\nWant me to call you about it? ${site}/call?mate=${encodeURIComponent(ro.leader)}&reason=${encodeURIComponent(clip(ev.title, 120))}` : '';
    delivered = (await notify(uid, `${text}${callLink}`, { title: `${lead}: ${clip(ev.title, 60)}`, url: ev.url || '/', kind: 'note', urgent: !isQuiet(settings) })) ? 'notify' : 'digest';
  } else if (score === 5) {
    const r = await ring(uid, settings, { reason: clip(ev.title, 200), goal: `Tell the owner about this and ask what to do:\n${text}`, questions: ev.questions ?? [], urgent: true, mate: ro.leader });
    delivered = r.delivered; extra = r.callId ? { callId: r.callId } : { why: r.why };
    if (delivered === 'held') { await notify(uid, `${text}\n(I would have called: ${r.why}.)`, { title: `${lead}: urgent`, url: ev.url || '/', kind: 'note', urgent: true }); delivered = 'notify'; }
  }
  const doc = { key: clip(ev.key, 300), source: ev.source, title: clip(ev.title, 200), detail: clip(ev.detail, 1200), score, delivered, url: ev.url ?? '', watchId, at: now(), read: false, ...extra };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

/* ---------- the watchers ---------- */
const since = (w) => Date.parse(w.lastCheckedAt ?? '') || Date.now() - 30 * 60_000;
const W = {
  async runs(uid, w) {
    const runs = (await userCol(uid, 'runs').limit(200).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const out = []; const from = since(w);
    for (const r of runs) {
      const upd = Date.parse(r.updatedAt ?? '') || 0;
      if (r.status === 'failed' && upd > from) out.push({ key: `run:${r.id}:failed`, source: 'runs', title: `Run failed: ${r.title}`, detail: r.error || r.failure?.summary || '', score: 4, url: `/run?id=${r.id}` });
      else if (r.status === 'done' && upd > from) out.push({ key: `run:${r.id}:done`, source: 'runs', title: `Run finished: ${r.title}`, detail: String(r.report ?? '').slice(0, 300), score: 2, url: `/run?id=${r.id}` });
      else if (r.status === 'running' && Date.now() - upd > 30 * 60_000) out.push({ key: `run:${r.id}:stuck:${r.updatedAt}`, source: 'runs', title: `Run looks stuck: ${r.title}`, detail: 'No progress for 30 minutes.', score: 4, url: `/run?id=${r.id}` });
      for (const a of r.approvals ?? []) if (a.status === 'pending' && Date.now() - (Date.parse(a.at ?? a.createdAt ?? r.updatedAt) || 0) > 15 * 60_000) out.push({ key: `approval:${r.id}:${a.id}`, source: 'runs', title: `Waiting for your approval: ${a.text ?? r.title}`, detail: `In run "${r.title}" for over 15 minutes.`, score: 3, url: `/run?id=${r.id}` });
    }
    return out;
  },
  async calendar(uid) {
    const t = Date.now(); const out = [];
    const tasks = (await userCol(uid, 'tasks').limit(300).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    for (const k of tasks) {
      if (k.status === 'done' || !k.dueAt) continue; const due = Date.parse(k.dueAt);
      if (due > t && due - t < 60 * 60_000) out.push({ key: `task:${k.id}:soon`, source: 'calendar', title: `Due within the hour: ${k.title}`, detail: k.detail ?? '', score: 4, url: '/tasks' });
      else if (due < t && t - due < 7 * 86_400_000) out.push({ key: `task:${k.id}:overdue`, source: 'calendar', title: `Overdue: ${k.title}`, detail: `Was due ${k.dueAt.slice(0, 16).replace('T', ' ')}.`, score: 3, url: '/tasks' });
    }
    const evs = (await userCol(uid, 'events').limit(300).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    for (const e of evs) { const s = Date.parse(e.start); if (e.kind === 'event' && s > t && s - t < 60 * 60_000) out.push({ key: `event:${e.id}:soon`, source: 'calendar', title: `Coming up: ${e.title}`, detail: `Starts ${e.start.slice(11, 16)}.`, score: 2, url: '/schedule' }); }
    return out;
  },
  async topic(uid, w, settings) {
    const { TOOLS } = await import('./tools.js');
    const results = await TOOLS.web_search.run({ uid, settings }, { query: w.config?.query ?? '' }).catch((e) => `Search failed: ${e.message}`);
    const r = await chat(uid, { model: settings.fastModel || '', json: true, temperature: 0, maxTokens: 400, effort: 'low', messages: [
      { role: 'system', content: 'You watch a topic for the owner. Compare the new search results with what was already reported. Reply JSON only: {"new":true|false,"headline":"one line, the most important new thing","detail":"2-3 sentences with the source","digest":"one paragraph summary of everything known now"}. Only report real news, not reworded old items.' },
      { role: 'user', content: `Topic: ${w.config?.query}\n\nAlready reported:\n${w.lastDigest || '(nothing yet)'}\n\nNew results:\n${clip(results, 5000)}` }] }).catch(() => null);
    const j = extractJson(r?.text) ?? {};
    if (j.digest) await userCol(uid, 'watches').doc(w.id).set({ lastDigest: clip(j.digest, 1500) }, { merge: true });
    return j.new && j.headline ? [{ key: `topic:${w.id}:${clip(j.headline, 120)}`, source: 'topic', title: clip(j.headline, 200), detail: clip(j.detail, 800), context: `news about ${w.config?.query}` }] : [];
  },
  async github(uid, w) {
    const tok = await githubTokenFor(uid).catch(() => ''); if (!tok) return [];
    const repos = w.config?.repo ? [w.config.repo] : env('GITHUB_REPOS').split(',').map((s) => s.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')).filter(Boolean).slice(0, 5);
    const gh = (p) => fetch(`https://api.github.com${p}`, { headers: { authorization: `Bearer ${tok}`, 'user-agent': 'loopmates', accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const from = new Date(since(w)).toISOString(); const out = [];
    for (const repo of repos) {
      for (const i of (await gh(`/repos/${repo}/issues?state=open&since=${from}&per_page=10`)) ?? []) {
        if (Date.parse(i.created_at) < Date.parse(from)) continue;
        const urgent = (i.labels ?? []).some((l) => /bug|urgent|critical|security|p0/i.test(l.name ?? ''));
        out.push({ key: `gh:${repo}:${i.number}`, source: 'github', title: `${i.pull_request ? 'New PR' : 'New issue'} in ${repo}: ${i.title}`, detail: clip(i.body, 400), score: urgent ? 4 : 2, url: i.html_url });
      }
      for (const r of (await gh(`/repos/${repo}/actions/runs?status=failure&per_page=5`))?.workflow_runs ?? []) {
        if (Date.parse(r.updated_at) < Date.parse(from)) continue;
        out.push({ key: `ci:${repo}:${r.id}`, source: 'github', title: `CI failed in ${repo}: ${r.name} on ${r.head_branch}`, detail: clip(r.display_title, 200), score: ['main', 'master'].includes(r.head_branch) ? 4 : 3, url: r.html_url });
      }
    }
    return out;
  },
  /** New items in an RSS/Atom feed, scored for relevance by the fast model (the first check only remembers what is there). */
  async feed(uid, w) {
    const { readFeed } = await import('../integrations/feeds.js');
    const f = await readFeed(w.config?.url); const seenIds = new Set(w.seen ?? []);
    const fresh = f.items.filter((i) => !seenIds.has(i.id || i.link)).slice(0, 5);
    await userCol(uid, 'watches').doc(w.id).set({ seen: [...f.items.map((i) => i.id || i.link), ...(w.seen ?? [])].slice(0, 300) }, { merge: true });
    if (!w.seen) return []; // first look: everything is "old"
    return fresh.map((i) => ({ key: `feed:${w.id}:${i.id || i.link}`, source: 'topic', title: `${f.title ? `${clip(f.title, 40)}: ` : ''}${clip(i.title, 150)}`, detail: `${clip(i.summary, 500)}\n${i.link}`, url: i.link, context: `new item in the feed "${w.label}"` }));
  },
  /** A Home Assistant device reaching a state or crossing a number, optionally for some minutes (door open > 10 min). */
  async home(uid, w) {
    const { haFetch, homeReady } = await import('../integrations/home.js'); if (!homeReady()) return [];
    const c = w.config ?? {}; const s = await haFetch(`/states/${c.entity}`);
    const v = Number(s.state);
    const hit = (c.state && String(s.state).toLowerCase() === c.state.toLowerCase()) || (c.above !== undefined && Number.isFinite(v) && v > c.above) || (c.below !== undefined && Number.isFinite(v) && v < c.below);
    if (!hit) return [];
    const forMs = (c.forMinutes ?? 0) * 60_000, since = Date.parse(s.last_changed) || Date.now();
    if (forMs && Date.now() - since < forMs) return []; // only wait when asked (clocks can differ a little)
    const name = s.attributes?.friendly_name ?? c.entity;
    const what = c.state ? `is ${s.state}` : `is at ${s.state}${s.attributes?.unit_of_measurement ? ` ${s.attributes.unit_of_measurement}` : ''}`;
    return [{ key: `home:${w.id}:${s.last_changed}`, source: 'home', title: `${name} ${what}${forMs ? ` for over ${c.forMinutes} min` : ''}`, detail: `Since ${String(s.last_changed).slice(11, 16)} UTC. Watch: ${w.label}.`, score: c.score ?? 3, url: '/' }];
  },
};

/** Run one watch now. Returns the alerts it raised. */
export async function runWatch(uid, id) {
  const ref = userCol(uid, 'watches').doc(id); const w = (await ref.get()).data();
  if (!w || w.enabled === false) return [];
  const settings = await getSettings(uid);
  let evs = [];
  try { evs = await W[w.kind]?.(uid, { id, ...w }, settings) ?? []; } catch (e) { console.error('watch failed', w.kind, e.message); }
  await ref.set({ lastCheckedAt: now(), updatedAt: now() }, { merge: true });
  const raised = [];
  for (const ev of evs.slice(0, 10)) { const a = await raise(uid, ev, { settings, watchId: id }); if (a) raised.push(a); }
  return raised;
}

/* ---------- the daily briefing ---------- */
export async function briefingHook(uid, settings) {
  const key = `${uid}_briefing_daily`;
  if (!settings.briefingOn) return void jobs.doc(key).delete().catch(() => {});
  const { nextRun } = await import('../lib/cron.js');
  const [h, m] = String(settings.briefingAt || '08:00').split(':').map(Number);
  const at = nextRun({ kind: 'daily', time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }, Date.now(), settings.timezone);
  if (at) await jobs.doc(key).set({ uid, kind: 'briefing', refId: 'daily', title: 'Daily briefing', nextAt: at });
}
export async function sendBriefing(uid) {
  const settings = await getSettings(uid); const ro = await loadRoster(uid);
  const t = Date.now(); const dayEnd = t + 18 * 3_600_000;
  const evs = (await userCol(uid, 'events').limit(300).get()).docs.map((d) => d.data()).filter((e) => { const s = Date.parse(e.start); return s >= t && s <= dayEnd; }).sort((a, b) => a.start.localeCompare(b.start));
  const tasks = (await userCol(uid, 'tasks').limit(300).get()).docs.map((d) => d.data()).filter((k) => k.status !== 'done');
  const overdue = tasks.filter((k) => k.dueAt && Date.parse(k.dueAt) < t);
  const alerts = (await userCol(uid, 'alerts').limit(200).get()).docs.map((d) => ({ ref: d.ref, ...d.data() })).filter((a) => a.delivered === 'digest' && !a.briefed);
  const dayAgo = new Date(t - 20 * 3_600_000).toISOString();
  const review = (await userCol(uid, 'reflections').limit(60).get()).docs.map((d) => d.data()).filter((r) => r.at > dayAgo && (r.lessons || r.skills)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  const facts = `Today's calendar:\n${evs.map((e) => `- ${e.start.slice(11, 16)} ${e.title}`).join('\n') || '(nothing)'}\n\nOpen tasks: ${tasks.length}; overdue:\n${overdue.map((k) => `- ${k.title}`).join('\n') || '(none)'}\n\nSince the last briefing:\n${alerts.map((a) => `- ${a.title}`).join('\n') || '(nothing new)'}${review ? `\n\nThe team's overnight review: ${clip(review.summary, 600)}` : ''}`;
  let text = facts;
  try { const r = await chat(uid, { model: settings.fastModel || '', maxTokens: 400, temperature: 0.3, effort: 'low', messages: [{ role: 'system', content: `You are ${ro.name(ro.leader)}, the owner's chief of staff. Write a morning briefing: 3-6 short lines, most important first, then one suggested focus for the day. Plain text, no preamble.` }, { role: 'user', content: facts }] }); if (r.text?.trim()) text = r.text.trim(); } catch { /* the facts are enough */ }
  for (const a of alerts) await a.ref.set({ briefed: true }, { merge: true }).catch(() => {});
  if (settings.briefingCall) { const r = await ring(uid, settings, { reason: 'Your morning briefing', goal: `Give the owner this briefing in your own words, then ask if anything should change today:\n${text}`, mate: ro.leader }); if (r.delivered === 'call') return { delivered: 'call', text }; }
  await notify(uid, text, { title: `${ro.name(ro.leader)}: your briefing`, url: '/', kind: 'note' });
  return { delivered: 'notify', text };
}

/* ---------- the weekly team stand-up ---------- */
export async function standupHook(uid, settings) {
  const key = `${uid}_standup_weekly`;
  if (!settings.standupOn) return void jobs.doc(key).delete().catch(() => {});
  const { nextRun } = await import('../lib/cron.js');
  const at = nextRun({ kind: 'weekly', days: [Number(settings.standupDay ?? 1)], time: settings.standupAt || '09:00' }, Date.now(), settings.timezone);
  if (at) await jobs.doc(key).set({ uid, kind: 'standup', refId: 'weekly', title: 'Weekly team stand-up', nextAt: at });
}

/** What each agent did in the last `days` days: chat replies and finished run steps. */
export async function teamActivity(uid, days = 7) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString(); const act = {};
  const add = (k, field, title) => { const a = (act[k] ??= { replies: 0, steps: 0, titles: [] }); a[field]++; if (title && a.titles.length < 4 && !a.titles.includes(title)) a.titles.push(title); };
  for (const d of (await userCol(uid, 'conversations').limit(200).get()).docs) {
    const c = d.data(); for (const m of c.messages ?? []) if (m.role === 'mate' && m.mate && String(m.at) >= since) add(m.mate, 'replies', clip(c.title, 60));
  }
  for (const d of (await userCol(uid, 'runs').limit(200).get()).docs) {
    const r = d.data(); if (String(r.updatedAt ?? '') < since) continue;
    for (const s of r.steps ?? []) if (s.mate && s.status === 'done') add(s.mate, 'steps', clip(r.title, 60));
  }
  return act;
}

/** Each busy agent writes one line in its own voice; the leader sends the round-up. Falls back to plain facts without a model. */
export async function runStandup(uid) {
  const settings = await getSettings(uid); const ro = await loadRoster(uid); const lead = ro.name(ro.leader);
  const act = await teamActivity(uid, 7);
  const busy = Object.entries(act).filter(([k]) => ro.has(k)).sort((a, b) => (b[1].replies + b[1].steps * 3) - (a[1].replies + a[1].steps * 3)).slice(0, 6);
  const { briefPersona } = await import('./prompt.js');
  const lines = [];
  for (const [k, a] of busy) {
    const facts = `${a.replies} chat repl${a.replies === 1 ? 'y' : 'ies'}, ${a.steps} run step${a.steps === 1 ? '' : 's'} this week. Topics: ${a.titles.join('; ') || 'various'}.`;
    let line = '';
    try {
      const r = await chat(uid, { model: settings.fastModel || '', maxTokens: 90, temperature: 0.6, effort: 'low', messages: [
        { role: 'system', content: `${briefPersona(k, ro.cfgs[k] ?? {}, ro.byKey[k])}\n\nThis is the team's weekly stand-up for the owner. Write ONE line (at most 25 words), in your own voice, about what you did this week and one thing you could do next. Only use the facts given. No greeting, no name prefix.` },
        { role: 'user', content: facts }] });
      line = String(r.text ?? '').trim().split('\n')[0].replace(/^["“]|["”]$/g, '');
    } catch { /* no model: use the facts */ }
    lines.push({ mate: k, name: ro.name(k), line: clip(line || facts, 240) });
  }
  const text = lines.length ? `Weekly stand-up from the team:\n${lines.map((l) => `• ${l.name}: ${l.line}`).join('\n')}` : 'Quiet week: none of the agents worked on anything. Ask me if you want something started.';
  await userCol(uid, 'standups').doc().set({ at: now(), lines, text, leader: ro.leader });
  await notify(uid, text, { title: `${lead}: weekly stand-up`, url: '/', kind: 'note' });
  return { text, lines };
}

/* ---------- leader tools ---------- */
const bad = (m) => Object.assign(new Error(m), { tool: true });
export const WATCH_TOOLS = {
  watch_add: { group: 'Delegation', write: true, desc: 'Keep watch on something for the owner and tell them (or call them) when it matters. kinds: topic (news or keywords, needs query), feed (an RSS/Atom or YouTube channel feed, needs url), home (a Home Assistant device reaching a state or number, needs entity plus state/above/below, optional forMinutes and score 1-5), github (a repo, optional), runs, calendar. Use when the owner says "keep an eye on…", "tell me if…", "watch…".', args: '{"kind": "topic|feed|home|github|runs|calendar", "query?": "for topic", "url?": "feed address", "entity?": "e.g. cover.garage_door", "state?": "e.g. open", "above?": "number", "below?": "number", "forMinutes?": "only after this long", "score?": "1-5, how urgent (5 rings)", "repo?": "owner/name for github", "label?": "short name", "everyMinutes?": "how often (topic min 60, feed 30)"}', run: async (c, a) => {
    const w = await addWatch(c.uid, { kind: String(a.kind ?? ''), label: a.label, config: { query: a.query, repo: a.repo, url: a.url, entity: a.entity, state: a.state, above: a.above, below: a.below, forMinutes: a.forMinutes, score: a.score }, everyMinutes: a.everyMinutes, by: c.mate ?? '' }).catch((e) => { throw bad(e.message); });
    return `Watching "${w.label}" every ${w.everyMinutes} minutes (watch ${w.id}). I will message you about important news and call only for urgent things.`;
  } },
  watch_list: { group: 'Delegation', desc: 'What you are keeping watch on for the owner, and the latest alerts.', args: '{}', run: async (c) => {
    const ws = (await userCol(c.uid, 'watches').limit(50).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const al = (await userCol(c.uid, 'alerts').limit(200).get()).docs.map((d) => d.data()).sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 8);
    return `${ws.map((w) => `- ${w.id} | ${w.kind} | ${w.label} | every ${w.everyMinutes} min | ${w.enabled === false ? 'paused' : 'on'}`).join('\n') || 'No watches.'}\n\nLatest alerts:\n${al.map((x) => `- [${x.score}] ${x.title} (${x.delivered})`).join('\n') || '(none)'}`;
  } },
  team_standup: { group: 'Delegation', write: true, desc: 'Run the team stand-up now: every agent that worked this week writes one line in its own voice, and the round-up is sent to the owner. Use when the owner asks "what has the team been doing?".', args: '{}', run: async (c) => (await runStandup(c.uid)).text },
  watch_remove: { group: 'Delegation', write: true, desc: 'Stop a watch (by id, or part of its label).', args: '{"match": "id or label text"}', run: async (c, a) => {
    const m = String(a.match ?? '').toLowerCase(); if (!m) throw bad('match is required');
    const d = (await userCol(c.uid, 'watches').limit(50).get()).docs.find((x) => x.id === a.match || String(x.data().label ?? '').toLowerCase().includes(m));
    if (!d) throw bad('No watch matches that.');
    await d.ref.delete(); await watchHook(c.uid, d.id, null, 'delete');
    return `Stopped watching "${d.data().label}".`;
  } },
};
export { ring };
