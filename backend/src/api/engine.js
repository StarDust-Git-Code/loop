// Run engine: plan -> steps -> (approval) -> execute -> report. Live events go over SSE from memory;
// Firestore only gets checkpoints (run creation, each step, approvals, final) to respect the free write quota.
import { env, now, uid as rid, sleep } from '../lib/env.js';
import { svcJson } from '../lib/svc.js';
import { db, userCol } from './db.js';
import { chat, extractJson, effortOf } from './llm.js';
import { MATE_DEFS, persona, PLAN_JSON_PROMPT } from './mates.js';
import { converse } from './agent.js';
import { getSettings } from './settings.js';
import { putFile, artifactsReady } from './files.js';
import { notify } from './telegram.js';

const live = new Map();      // runId -> state
const jobWaiters = new Map(); // jobId -> resolve(result)
const LOG_CAP = 300;
const NOTES_CAP = 12000;

class Stopped extends Error {}

const runRef = (uid, id) => userCol(uid, 'runs').doc(id);
const activeRef = (id) => db.collection('activeRuns').doc(id);

function emit(st, e) {
  const r = st.run;
  switch (e.type) {
    case 'status': r.status = e.status; break;
    case 'step': r.steps = r.steps.some((s) => s.id === e.step.id) ? r.steps.map((s) => (s.id === e.step.id ? e.step : s)) : [...r.steps, e.step]; break;
    case 'log': r.log.push(e.line); if (r.log.length > LOG_CAP) r.log.splice(0, r.log.length - LOG_CAP); break;
    case 'approval': r.approvals = [...r.approvals.filter((a) => a.id !== e.approval.id), e.approval]; break;
    case 'file': r.fileIds.push(e.fileId); break;
  }
  r.updatedAt = now();
  for (const send of st.subs) { try { send(e); } catch { st.subs.delete(send); } }
}
const log = (st, source, text) => emit(st, { type: 'log', line: { at: now(), source, text: String(text).slice(0, 2000) } });
const save = (st) => runRef(st.uid, st.run.id).set(withoutId(st.run)).catch((e) => console.error('run save failed', e.message));
const withoutId = ({ id, ...rest }) => rest;

/* ------------------------------------------------------------------ planning */
const MATE_LIST = MATE_DEFS.map((m) => `${m.key} (${m.blurb})`).join('; ');

async function makePlan(st, wf) {
  if (wf?.nodes?.length) { // follow the workflow canvas: mate nodes ordered by edges from the first node
    const byId = new Map(wf.nodes.map((n) => [n.id, n]));
    const next = new Map((wf.edges ?? []).map((e) => [e.from, e.to]));
    const hasIn = new Set((wf.edges ?? []).map((e) => e.to));
    let cur = wf.nodes.find((n) => !hasIn.has(n.id)) ?? wf.nodes[0];
    const seen = new Set(); const out = [];
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.type === 'mate' || cur.type === 'tool' || cur.type === 'output') out.push({ mate: cur.mate ?? 'ops', label: cur.label || 'Step', kind: cur.type === 'output' ? 'file' : cur.mate === 'code' || cur.mate === 'byte' ? 'code' : 'think', repo: cur.config?.repo, branch: cur.config?.branch });
      cur = byId.get(next.get(cur.id));
    }
    if (out.length) return out.slice(0, st.settings.maxSteps);
  }
  try {
    const r = await chat(st.uid, {
      model: st.settings.model, json: true, maxTokens: 900, temperature: 0.2, effort: effortOf(st.mates.planner?.thinking),
      messages: [
        { role: 'system', content: PLAN_JSON_PROMPT(st.mates, Math.min(st.settings.maxSteps, 8)) },
        { role: 'user', content: st.run.prompt },
      ],
    });
    const j = extractJson(r.text);
    const steps = (j?.steps ?? []).filter((s) => s && typeof s.label === 'string').slice(0, st.settings.maxSteps)
      .map((s) => ({ mate: MATE_DEFS.some((m) => m.key === s.mate) && st.mates[s.mate]?.enabled !== false ? s.mate : 'ops', label: s.label.slice(0, 120), kind: ['think', 'code', 'file', 'notify'].includes(s.kind) ? s.kind : 'think' }));
    if (steps.length) return steps;
  } catch (e) { log(st, 'planner', `Planning failed (${e.message.slice(0, 160)}). Using a simple plan.`); }
  return [{ mate: 'research', label: 'Work on the request', kind: 'think' }, { mate: 'writer', label: 'Write the final answer', kind: 'think' }];
}

/* ------------------------------------------------------------------ control */
async function gate(st) { // honours stop + pause between steps
  while (st.paused && !st.stopped) await sleep(500);
  if (st.stopped) throw new Stopped();
}

function ask(st, step, text) {
  const approval = { id: rid(), mate: step.mate, text, paths: [], status: 'pending' };
  emit(st, { type: 'approval', approval });
  emit(st, { type: 'status', status: 'waiting_approval' });
  if (st.unattended) void notify(st.uid, `Approval needed for "${st.run.title}": ${text}\nOpen the Loopmates dashboard to approve or deny.`);
  void save(st);
  return new Promise((resolve) => { st.approvals.set(approval.id, resolve); });
}

const needsApproval = (st, kind) => kind !== 'think' && (st.run.askFirst || (st.settings.askBeforeRisky && st.settings.permissionMode !== 'auto'));

/* ------------------------------------------------------------------ steps */
async function stepThink(st, step) {
  const cfg = st.mates[step.mate];
  const steer = st.steer.splice(0).join('\n');
  const r = await converse({
    uid: st.uid, mateKey: step.mate, cfg: cfg ?? {}, settings: st.settings, ctx: { runId: st.run.id },
    history: [{ role: 'user', content: `Overall job:\n${st.run.prompt}\n\nNotes so far:\n${st.run.notes || '(none)'}\n\n${steer ? `Owner steering: ${steer}\n\n` : ''}Your step: ${step.label}\nAnswer with the result of this step only.` }],
    emit: (ev) => { if (ev.type === 'tool') log(st, step.mate, `Using tool: ${ev.name}`); },
  });
  log(st, step.mate, r.text.slice(0, 600));
  st.run.notes = (st.run.notes + `\n\n## ${step.label}\n${r.text}`).slice(-NOTES_CAP);
}

async function stepCode(st, step, idx) {
  if (!env('CODER_URL')) throw new Error('Coder service is not configured (CODER_URL).');
  const jobId = `${st.run.id}-${idx}`;
  const done = new Promise((resolve) => jobWaiters.set(jobId, resolve));
  await svcJson(env('CODER_URL'), '/v1/jobs', { method: 'POST', body: { jobId, runId: st.run.id, uid: st.uid, goal: `${step.label}\n\nContext:\n${st.run.prompt}\n\n${st.run.notes.slice(-3000)}`, repo: step.repo || env('DEFAULT_REPO'), branch: step.branch, model: st.settings.model, maxSteps: Math.min(st.settings.maxSteps, 20) } });
  log(st, 'code', 'Coding agent started.');
  const timeout = sleep(st.settings.stopAfterMinutes * 60_000).then(() => ({ ok: false, summary: 'Timed out waiting for the coding agent.' }));
  const result = await Promise.race([done, timeout, st.stopSignal]);
  jobWaiters.delete(jobId);
  if (st.stopped) { svcJson(env('CODER_URL'), `/v1/jobs/${jobId}/cancel`, { method: 'POST', body: {} }).catch(() => {}); throw new Stopped(); }
  if (!result.ok) throw new Error(result.summary || 'Coding agent failed.');
  for (const f of artifactsReady() ? result.files ?? [] : []) { // small deliverables from a repo-less job go to Drive
    const name = String(f.name).split(/[\\/]/).pop();
    const saved = await putFile(st.uid, { name, mime: 'application/octet-stream', buf: Buffer.from(f.b64, 'base64'), source: 'run', runId: st.run.id });
    emit(st, { type: 'file', fileId: saved.id });
  }
  if (result.prUrl) st.run.sources.push(result.prUrl); else if (result.branch) st.run.sources.push(`branch:${result.branch}`);
  st.run.notes = (st.run.notes + `\n\n## ${step.label}\n${result.summary}${result.prUrl ? `\nPR: ${result.prUrl}` : ''}`).slice(-NOTES_CAP);
}

async function stepFile(st, step) {
  if (!artifactsReady()) throw new Error('Artifacts service is not configured (ARTIFACTS_URL).');
  const r = await chat(st.uid, { model: st.settings.model, maxTokens: 3000, messages: [{ role: 'system', content: persona(step.mate) }, { role: 'user', content: `Write the deliverable for this step as Markdown. No preface.\n\nJob:\n${st.run.prompt}\n\nNotes:\n${st.run.notes}\n\nStep: ${step.label}` }] });
  const name = `${step.label.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'output'}.md`;
  const f = await putFile(st.uid, { name, mime: 'text/markdown', buf: Buffer.from(r.text, 'utf8'), source: 'run', runId: st.run.id });
  emit(st, { type: 'file', fileId: f.id });
  log(st, step.mate, `Saved ${name} to Drive.`);
}

async function stepNotify(st, step) {
  const sent = await notify(st.uid, `${st.run.title}\n${step.label}\n\n${st.run.notes.slice(-600)}`);
  log(st, step.mate, sent ? `Sent to ${sent} Telegram chat(s).` : 'No Telegram chat is linked, nothing sent.');
}

/* ------------------------------------------------------------------ main loop */
async function execute(st) {
  try {
    emit(st, { type: 'status', status: 'running' });
    log(st, 'planner', 'Planning…');
    let wf; if (st.run.workflowId) wf = (await userCol(st.uid, 'workflows').doc(st.run.workflowId).get()).data();
    const plan = await makePlan(st, wf);
    const steps = plan.map((p, i) => ({ id: `s${i + 1}`, mate: p.mate, label: p.label, status: 'waiting', _p: p }));
    for (const s of steps) emit(st, { type: 'step', step: { id: s.id, mate: s.mate, label: s.label, status: 'waiting' } });
    await save(st);

    for (let i = 0; i < steps.length; i++) {
      await gate(st);
      const s = steps[i], p = s._p;
      const view = (status, extra = {}) => ({ id: s.id, mate: s.mate, label: s.label, status, ...extra });
      const started = now();
      if (needsApproval(st, p.kind)) {
        const ok = await ask(st, s, `${s.label} (${p.kind === 'code' ? 'runs the coding agent' : p.kind === 'file' ? 'writes a file to Drive' : 'sends a message'})`);
        if (st.stopped) throw new Stopped();
        emit(st, { type: 'status', status: 'running' });
        if (!ok) { emit(st, { type: 'step', step: view('failed', { startedAt: started, finishedAt: now() }) }); log(st, 'halo', `Skipped (denied): ${s.label}`); continue; }
      }
      emit(st, { type: 'step', step: view('running', { startedAt: started }) });
      let tries = 0;
      for (;;) {
        try {
          if (p.kind === 'code') await stepCode(st, p, i); else if (p.kind === 'file') await stepFile(st, p); else if (p.kind === 'notify') await stepNotify(st, p); else await stepThink(st, p);
          emit(st, { type: 'step', step: view('done', { startedAt: started, finishedAt: now() }) });
          break;
        } catch (e) {
          if (e instanceof Stopped || st.stopped) throw new Stopped();
          if (tries++ < st.settings.retriesOnFailure) { log(st, 'ops', `Retrying "${s.label}": ${e.message.slice(0, 200)}`); await sleep(2000); continue; }
          emit(st, { type: 'step', step: view('failed', { startedAt: started, finishedAt: now() }) });
          throw e;
        }
      }
      await save(st);
    }

    const fin = await chat(st.uid, { model: st.settings.model, maxTokens: 1500, effort: effortOf(st.mates.writer?.thinking), messages: [{ role: 'system', content: persona('writer') }, { role: 'user', content: `Write the final report (Markdown, brief, with the answer first) for this job.\n\nJob:\n${st.run.prompt}\n\nNotes:\n${st.run.notes}` }] }).catch(() => null);
    st.run.report = fin?.text ?? st.run.notes;
    emit(st, { type: 'status', status: 'done' });
    if (st.settings.notifyTelegram) void notify(st.uid, `Done: ${st.run.title}\n\n${st.run.report.slice(0, 700)}`);
  } catch (e) {
    if (e instanceof Stopped) { emit(st, { type: 'status', status: 'stopped' }); log(st, 'ops', 'Stopped.'); }
    else { st.run.error = String(e.message).slice(0, 500); log(st, 'ops', `Failed: ${st.run.error}`); emit(st, { type: 'status', status: 'failed' }); if (st.settings.notifyTelegram) void notify(st.uid, `Failed: ${st.run.title}\n${st.run.error}`); }
  } finally {
    await save(st);
    await activeRef(st.run.id).delete().catch(() => {});
    for (const send of st.subs) { try { send({ type: 'status', status: st.run.status }); } catch { /* closed */ } }
    setTimeout(() => live.delete(st.run.id), 60_000).unref();
  }
}

/* ------------------------------------------------------------------ public API */
export async function startRun(uid, { prompt, workflowId, askFirst = false, fileIds = [], title, unattended = false } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw Object.assign(new Error('prompt is required'), { statusCode: 400 });
  const settings = await getSettings(uid);
  const mates = Object.fromEntries((await userCol(uid, 'mates').get()).docs.map((d) => [d.id, d.data()]));
  const ref = userCol(uid, 'runs').doc();
  const ts = now();
  const run = { id: ref.id, createdAt: ts, updatedAt: ts, title: (title || prompt.trim().split('\n')[0]).slice(0, 80), prompt: prompt.trim().slice(0, 8000), workflowId, askFirst: !!askFirst, status: 'queued', steps: [], log: [], approvals: [], fileIds, sources: [], report: '', notes: '' };
  let stop; const stopSignal = new Promise((r) => { stop = r; });
  const st = { uid, run, settings, mates, unattended, subs: new Set(), steer: [], approvals: new Map(), paused: false, stopped: false, stopSignal, stop: () => stop({ ok: false, summary: 'Stopped.' }) };
  live.set(run.id, st);
  await ref.set(withoutId(run));
  await activeRef(run.id).set({ uid, at: ts });
  const snapshot = structuredClone(run);
  void execute(st);
  keepAlive();
  return snapshot;
}

const own = (uid, id) => { const st = live.get(id); if (!st || st.uid !== uid) throw Object.assign(new Error('Run is not active'), { statusCode: 409 }); return st; };

export async function control(uid, id, action) {
  if (!live.has(id)) { // not in memory (finished, or the service restarted): only report the stored state
    const d = await runRef(uid, id).get(); if (!d.exists) throw Object.assign(new Error('Not found'), { statusCode: 404 });
    return { id, ...d.data() };
  }
  const st = own(uid, id);
  if (action === 'stop') { st.stopped = true; st.stop(); for (const r of st.approvals.values()) r(false); }
  else if (action === 'pause') { st.paused = true; log(st, 'ops', 'Paused.'); }
  else if (action === 'resume') { st.paused = false; log(st, 'ops', 'Resumed.'); }
  else throw Object.assign(new Error('Unknown action'), { statusCode: 400 });
  return st.run;
}

export const liveRuns = (uid) => [...live.values()].filter((s) => s.uid === uid).map((s) => ({ id: s.run.id, status: s.run.status, paused: s.paused }));
export function steer(uid, id, text) { const st = own(uid, id); st.steer.push(String(text).slice(0, 2000)); log(st, 'you', `Steer: ${text}`); return st.run; }

export function decide(uid, runId, approvalId, decision) {
  const st = own(uid, runId);
  const resolve = st.approvals.get(approvalId);
  const a = st.run.approvals.find((x) => x.id === approvalId);
  if (!resolve || !a) throw Object.assign(new Error('No such pending approval'), { statusCode: 404 });
  st.approvals.delete(approvalId);
  emit(st, { type: 'approval', approval: { ...a, status: decision === 'approved' ? 'approved' : 'denied' } });
  resolve(decision === 'approved');
  void save(st);
  return st.run;
}

/** SSE: only new events (the dashboard already loads the stored run as its base). */
export function subscribe(uid, id, send) {
  const st = live.get(id);
  if (!st || st.uid !== uid) return null;
  send({ type: 'status', status: st.run.status });
  st.subs.add(send);
  return () => st.subs.delete(send);
}

/** Coder callback: progress lines and the final result of a job. */
export function jobEvent(runId, body) {
  const st = live.get(runId);
  if (!st) return false;
  for (const l of (body.logs ?? []).slice(0, 50)) log(st, 'code', l);
  if (body.done) jobWaiters.get(body.jobId)?.(body.done);
  return true;
}

/* ------------------------------------------------------------------ housekeeping */
let timer;
function keepAlive() { // active runs do not count as inbound traffic, so ping ourselves to stop Render sleeping mid-run
  if (timer || !env('PUBLIC_URL')) return;
  timer = setInterval(() => { if (!live.size) { clearInterval(timer); timer = undefined; return; } fetch(`${env('PUBLIC_URL')}/healthz`).catch(() => {}); }, 4 * 60_000);
  timer.unref();
}

/** Runs that were mid-flight when the service restarted cannot resume: mark them failed so the UI is honest. */
export async function recoverRuns() {
  const snap = await db.collection('activeRuns').limit(50).get();
  for (const d of snap.docs) {
    const { uid } = d.data();
    await runRef(uid, d.id).set({ status: 'failed', error: 'The API restarted while this run was in progress. Start it again.', updatedAt: now() }, { merge: true }).catch(() => {});
    await d.ref.delete().catch(() => {});
  }
  return snap.size;
}
export const activeCount = () => live.size;
