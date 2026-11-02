// Observation + watchdog tools: what is running, what failed, logs, console, health. Read-only except the Run Control group.
import { env, now } from '../lib/env.js';
import { tail, counts } from '../lib/console.js';
import { db, userCol } from './db.js';
import { providerSummary } from './llm.js';
import { MATE_DEFS } from './mates.js';
import { hooks } from './toolhooks.js';

const bad = (m) => Object.assign(new Error(m), { tool: true });
const DONE = new Set(['done', 'failed', 'stopped']);
const mins = (iso) => Math.round((Date.now() - Date.parse(iso)) / 60_000);
const short = (r) => `${r.id} | ${r.status} | ${r.title}${r.updatedAt ? ` | updated ${mins(r.updatedAt)}m ago` : ''}${r.error ? ` | error: ${String(r.error).slice(0, 120)}` : ''}`;
const runs = async (uid, n = 120) => (await userCol(uid, 'runs').limit(n).get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
const ping = async (url) => {
  if (!url) return { ok: false, note: 'not configured' };
  const t = Date.now();
  try { const r = await fetch(`${url.replace(/\/$/, '')}/healthz`, { signal: AbortSignal.timeout(8000) }); return { ok: r.ok, note: `${r.status} in ${Date.now() - t}ms` }; }
  catch (e) { return { ok: false, note: e.name === 'TimeoutError' ? 'timed out (may be waking up)' : 'unreachable' }; }
};

export const MONITOR_TOOLS = {
  time_now: { group: '*', desc: 'Current date and time, optionally in a timezone.', args: '{"timezone": "optional IANA name like Asia/Kolkata"}', run: async (c, a) => {
    const tz = a.timezone || c.settings?.timezone || 'UTC';
    try { return `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone: tz }).format(new Date())} | ISO ${new Date().toISOString()}`; } catch { throw bad('Unknown timezone'); }
  } },
  mates_list: { group: '*', desc: 'The roster of Mates: who is switched on, their tools and model.', args: '{}', run: async (c) => {
    const cfg = Object.fromEntries((await userCol(c.uid, 'mates').get()).docs.map((d) => [d.id, d.data()]));
    return MATE_DEFS.map((m) => `${m.key} | ${cfg[m.key]?.enabled ?? m.core ? 'on' : 'off'} | ${m.blurb} | tools: ${(cfg[m.key]?.tools ?? m.tools).join(', ') || 'none'}`).join('\n');
  } },
  runs_active: { group: '*', desc: 'Runs that are queued, running, paused or waiting for approval right now.', args: '{}', run: async (c) => {
    const live = new Map((hooks.liveRuns?.(c.uid) ?? []).map((r) => [r.id, r]));
    const rows = (await runs(c.uid)).filter((r) => !DONE.has(r.status) || live.has(r.id));
    return rows.length ? rows.map((r) => `${short(r)}${live.get(r.id)?.paused ? ' | PAUSED' : ''}${live.has(r.id) ? '' : ' | not in memory (orphaned?)'}`).join('\n') : 'Nothing is running.';
  } },
  runs_failed: { group: '*', desc: 'Runs that failed or were stopped recently.', args: '{"hours": 24}', run: async (c, a) => {
    const from = Date.now() - Math.min(Number(a.hours) || 24, 24 * 14) * 3_600_000;
    const rows = (await runs(c.uid)).filter((r) => (r.status === 'failed' || r.status === 'stopped') && Date.parse(r.updatedAt) >= from).slice(0, 15);
    return rows.length ? rows.map(short).join('\n') : 'No failed runs in that period.';
  } },
  runs_recent: { group: '*', desc: 'The most recent runs of any status.', args: '{"limit": 10}', run: async (c, a) => (await runs(c.uid)).slice(0, Math.min(Number(a.limit) || 10, 25)).map(short).join('\n') || 'No runs yet.' },
  run_status: { group: '*', desc: 'Details of one run: status, steps, pending approvals, error.', args: '{"id": "run id"}', run: async (c, a) => {
    const r = (await userCol(c.uid, 'runs').doc(String(a.id ?? '')).get()).data(); if (!r) throw bad('No such run');
    return [`${r.title} | ${r.status}${r.error ? ` | error: ${r.error}` : ''}`, ...(r.steps ?? []).map((s) => `- [${s.status}] ${s.mate}: ${s.label}`), ...(r.approvals ?? []).filter((x) => x.status === 'pending').map((x) => `APPROVAL PENDING: ${x.text ?? x.title ?? x.id}`)].join('\n');
  } },
  run_log: { group: '*', desc: 'The latest log lines of a run.', args: '{"id": "run id", "tail": 20}', run: async (c, a) => {
    const r = (await userCol(c.uid, 'runs').doc(String(a.id ?? '')).get()).data(); if (!r) throw bad('No such run');
    return (r.log ?? []).slice(-Math.min(Number(a.tail) || 20, 60)).map((l) => `${l.at?.slice(11, 19)} [${l.source}] ${l.text}`).join('\n') || 'Empty log.';
  } },
  approvals_pending: { group: '*', desc: 'Actions waiting for the owner to approve or deny.', args: '{}', run: async (c) => {
    const out = [];
    for (const r of (await runs(c.uid)).filter((x) => !DONE.has(x.status))) for (const ap of r.approvals ?? []) if (ap.status === 'pending') out.push(`${r.id} | ${r.title} | ${ap.id} | ${ap.text ?? ap.title ?? ''}`);
    return out.length ? out.join('\n') : 'No approvals waiting.';
  } },
  jobs_upcoming: { group: '*', desc: 'Scheduled jobs (automations, reminders, due tasks) in time order.', args: '{}', run: async (c) => {
    const snap = await db.collection('jobs').where('uid', '==', c.uid).limit(100).get();
    const rows = snap.docs.map((d) => d.data()).sort((a, b) => a.nextAt - b.nextAt).slice(0, 15);
    return rows.length ? rows.map((j) => `${new Date(j.nextAt).toISOString()} | ${j.kind} | ${j.title}${j.nextAt < Date.now() - 120_000 ? ' | OVERDUE' : ''}`).join('\n') : 'No scheduled jobs.';
  } },
  automations_list: { group: '*', desc: 'Automations and their schedules.', args: '{}', run: async (c) => {
    const rows = (await userCol(c.uid, 'automations').limit(50).get()).docs.map((d) => d.data());
    return rows.length ? rows.map((x) => `${x.enabled ? 'on ' : 'off'} | ${x.name} | ${x.schedule?.kind ?? 'manual'} ${x.schedule?.cron ?? x.schedule?.time ?? ''}`).join('\n') : 'No automations.';
  } },
  connections_status: { group: '*', desc: 'Telegram, WhatsApp, Drive, GitHub connection status.', args: '{}', run: async (c) => {
    const rows = (await userCol(c.uid, 'connections').limit(20).get()).docs.map((d) => d.data());
    return rows.length ? rows.map((x) => `${x.provider} | ${x.status}${x.error ? ` | ${x.error}` : ''}`).join('\n') : 'No connections yet.';
  } },
  files_list: { group: '*', desc: 'Recent files in the workspace.', args: '{"limit": 10}', run: async (c, a) => {
    const rows = (await userCol(c.uid, 'files').limit(100).get()).docs.map((d) => d.data()).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))).slice(0, Math.min(Number(a.limit) || 10, 25));
    return rows.length ? rows.map((f) => `${f.name} | ${f.size} bytes | ${f.source}`).join('\n') : 'No files.';
  } },
  knowledge_list: { group: '*', desc: 'Items in the Knowledge library and whether they are indexed.', args: '{}', run: async (c) => {
    const rows = (await userCol(c.uid, 'knowledge').limit(50).get()).docs.map((d) => d.data());
    return rows.length ? rows.map((k) => `${k.name} | ${k.status}${k.error ? ` | ${k.error}` : ''}`).join('\n') : 'Knowledge library is empty.';
  } },
  llm_status: { group: '*', desc: 'LLM providers in use and any that are cooling down after errors.', args: '{}', run: async (c) => {
    const rows = await providerSummary(c.uid);
    return rows.length ? rows.map((p) => `${p.name} | ${p.model}${p.cooling ? ` | cooling down ${p.cooling}s` : ' | ok'}`).join('\n') : 'No LLM provider is configured.';
  } },
  console_tail: { group: '*', desc: 'Read the server console (recent log lines). Secrets are redacted.', args: '{"level": "optional min level: info|warn|error", "grep": "optional text", "n": 40, "minutes": "optional look-back"}', run: async (_c, a) => {
    const rows = tail({ level: String(a.level ?? ''), grep: String(a.grep ?? '').slice(0, 80), n: Number(a.n) || 40, sinceMs: (Number(a.minutes) || 0) * 60_000 });
    return rows.length ? rows.map((l) => `${l.at.slice(11, 19)} ${l.level.toUpperCase()} ${l.text}`).join('\n') : 'Nothing matching in the console buffer.';
  } },
  system_status: { group: '*', desc: 'Server health: uptime, memory, services configured, queue sizes.', args: '{}', run: async (c) => {
    const m = process.memoryUsage();
    const live = hooks.liveRuns?.(c.uid) ?? [];
    return [`uptime ${Math.round(process.uptime() / 60)} min | heap ${Math.round(m.heapUsed / 1048576)} MB | rss ${Math.round(m.rss / 1048576)} MB | node ${process.version}`,
      `live runs: ${live.length}`, `coder service: ${env('CODER_URL') ? 'configured' : 'NOT configured'} | artifacts/Drive: ${env('ARTIFACTS_URL') ? 'configured' : 'NOT configured'} | telegram: ${env('TELEGRAM_BOT_TOKEN') ? 'configured' : 'NOT configured'} | web search: ${env('BRAVE_API_KEY') ? 'Brave' : 'DuckDuckGo fallback'}`,
      `console last 15 min: ${JSON.stringify(counts(15 * 60_000))}`].join('\n');
  } },
  watchdog: { group: '*', desc: 'Full health check with findings: stuck runs, failures, dead services, overdue jobs, stale approvals, LLM trouble, console errors.', args: '{}', run: async (c) => {
    const f = []; const add = (sev, text) => f.push(`${sev} ${text}`);
    const all = await runs(c.uid); const live = new Map((hooks.liveRuns?.(c.uid) ?? []).map((r) => [r.id, r]));
    for (const r of all.filter((x) => !DONE.has(x.status))) {
      if (!live.has(r.id)) add('HIGH', `Run "${r.title}" (${r.id}) is marked ${r.status} but is not running on this server (orphaned).`);
      else if (!live.get(r.id).paused && !(r.approvals ?? []).some((x) => x.status === 'pending') && mins(r.updatedAt) > 10) add('MED', `Run "${r.title}" (${r.id}) has had no activity for ${mins(r.updatedAt)} min (stuck?).`);
      for (const ap of r.approvals ?? []) if (ap.status === 'pending' && mins(ap.at ?? r.updatedAt) > 30) add('LOW', `Approval waiting over 30 min in "${r.title}".`);
    }
    const failed = all.filter((r) => r.status === 'failed' && Date.parse(r.updatedAt) > Date.now() - 86_400_000);
    if (failed.length) add(failed.length > 2 ? 'HIGH' : 'MED', `${failed.length} run(s) failed in the last 24h: ${failed.slice(0, 3).map((r) => `"${r.title}" (${String(r.error ?? '').slice(0, 70)})`).join('; ')}`);
    const [coder, art] = await Promise.all([ping(env('CODER_URL')), ping(env('ARTIFACTS_URL'))]);
    if (env('CODER_URL') && !coder.ok) add('HIGH', `Coder service: ${coder.note}.`); if (env('ARTIFACTS_URL') && !art.ok) add('MED', `Artifacts service: ${art.note}.`);
    if (!env('CODER_URL')) add('LOW', 'Coder service is not configured, so code steps cannot run.'); if (!env('ARTIFACTS_URL')) add('LOW', 'Artifacts/Drive is not configured, so files cannot be saved.');
    const prov = await providerSummary(c.uid);
    if (!prov.length) add('HIGH', 'No LLM provider is configured.'); else if (prov.every((p) => p.cooling)) add('HIGH', 'Every LLM provider is cooling down after errors.'); else if (prov.some((p) => p.cooling)) add('LOW', `${prov.filter((p) => p.cooling).map((p) => p.name).join(', ')} cooling down; failover is covering.`);
    const jobs = (await db.collection('jobs').where('uid', '==', c.uid).limit(100).get()).docs.map((d) => d.data()).filter((j) => j.nextAt < Date.now() - 180_000);
    if (jobs.length) add('MED', `${jobs.length} scheduled job(s) are overdue (the scheduler tick may not be running; check the cron pinger).`);
    const cc = counts(15 * 60_000); if (cc.error > 5) add('MED', `${cc.error} errors in the console in the last 15 min.`);
    return f.length ? `Watchdog found ${f.length} issue(s):\n${f.join('\n')}` : `Watchdog: all clear at ${now()}.`;
  } },
  task_done: { group: '*', write: true, desc: 'Mark a task as done (by id or by part of its title).', args: '{"match": "id or title text"}', run: async (c, a) => {
    const q = String(a.match ?? '').toLowerCase(); if (!q) throw bad('match is required');
    const docs = (await userCol(c.uid, 'tasks').limit(300).get()).docs.filter((d) => d.id === a.match || d.data().title?.toLowerCase().includes(q) && d.data().status !== 'done');
    if (!docs.length) throw bad('No matching open task'); if (docs.length > 1) throw bad(`Several match: ${docs.slice(0, 5).map((d) => d.data().title).join(' | ')}`);
    const t = { ...docs[0].data(), status: 'done', updatedAt: now() }; await docs[0].ref.set(t); await hooks.tasks?.(c.uid, docs[0].id, t, 'set'); return `Marked "${t.title}" done.`;
  } },
  /* ---- control: only for Ops / Halo / Planner (see EXTRA_GROUPS) ---- */
  run_stop: { group: 'Run Control', write: true, desc: 'Stop a running run.', args: '{"id": "run id"}', run: async (c, a) => { if (!hooks.control) throw bad('Run control is unavailable'); try { await hooks.control(c.uid, String(a.id), 'stop'); } catch (e) { throw bad(e.message); } return `Stop requested for ${a.id}.`; } },
  run_pause: { group: 'Run Control', write: true, desc: 'Pause a running run between steps.', args: '{"id": "run id"}', run: async (c, a) => { try { await hooks.control(c.uid, String(a.id), 'pause'); } catch (e) { throw bad(e.message); } return `Paused ${a.id}.`; } },
  run_resume: { group: 'Run Control', write: true, desc: 'Resume a paused run.', args: '{"id": "run id"}', run: async (c, a) => { try { await hooks.control(c.uid, String(a.id), 'resume'); } catch (e) { throw bad(e.message); } return `Resumed ${a.id}.`; } },
};
