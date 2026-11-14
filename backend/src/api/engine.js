// Run engine: plan -> steps -> (approval) -> execute -> report. Live events go over SSE from memory;
// Firestore only gets checkpoints (run creation, each step, approvals, final) to respect the free write quota.
import { env, now, uid as rid, sleep } from '../lib/env.js';
import { createCoder } from '../coder/index.js';
import { HARNESS_NAMES } from '../coder/harness.js';
import { githubTokenFor } from './github.js';
import { db, userCol } from './db.js';
import { chat, extractJson, effortOf } from './llm.js';
import { PLAN_JSON_PROMPT } from './mates.js';
import { briefPersona } from './prompt.js';
import { loadRoster } from './roster.js';
import { converse } from './agent.js';
import { getSettings } from './settings.js';
import { putFile, storageReady as artifactsReady } from './files.js';
import { notify } from './notify.js';
import { learnFromTurn, lessonsFor } from './memory.js';

const live = new Map();      // runId -> state
const jobWaiters = new Map(); // jobId -> resolve(result)
// The coder runs in this process; its log lines and result come back through jobEvent.
const coder = createCoder({ llm: (req) => chat(req.uid, req), onEvent: (runId, body) => jobEvent(runId, body) });
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

async function makePlan(st, wf) {
  if (wf?.nodes?.length) { // follow the workflow canvas: mate nodes ordered by edges from the first node
    const byId = new Map(wf.nodes.map((n) => [n.id, n]));
    const next = new Map((wf.edges ?? []).map((e) => [e.from, e.to]));
    const hasIn = new Set((wf.edges ?? []).map((e) => e.to));
    let cur = wf.nodes.find((n) => !hasIn.has(n.id)) ?? wf.nodes[0];
    const seen = new Set(); const out = [];
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const deep = /^(deep|deep-research|research)$/i.test(String(cur.config?.mode ?? ''));
      if (cur.type === 'mate' || cur.type === 'tool' || cur.type === 'output') out.push({ mate: cur.mate ?? 'ops', label: cur.label || 'Step', kind: cur.type === 'output' ? 'file' : deep ? 'research' : cur.mate === 'code' || cur.mate === 'byte' ? 'code' : 'think', repo: cur.config?.repo, branch: cur.config?.branch, harness: cur.config?.harness, sandbox: cur.config?.sandbox, ...(deep ? { research: { sources: cur.config?.sources, parameters: cur.config?.parameters, target: cur.config?.target } } : {}) });
      cur = byId.get(next.get(cur.id));
    }
    if (out.length) return out.slice(0, st.settings.maxSteps);
  }
  try {
    // The Planner's own lessons from past runs (reflect.js), so a plan that went wrong before is not planned again.
    const lessons = await lessonsFor(st.uid, 'planner', st.run.prompt, 4).catch(() => []);
    const r = await chat(st.uid, {
      model: st.settings.model, json: true, maxTokens: 900, temperature: 0.2, effort: effortOf(st.mates.planner?.thinking),
      messages: [
        { role: 'system', content: `${PLAN_JSON_PROMPT(st.ro, Math.min(st.settings.maxSteps, 8))}${lessons.length ? `\n\nLessons you wrote after reviewing your past plans (apply them):\n${lessons.map((l) => `- ${l.text}`).join('\n')}` : ''}` },
        { role: 'user', content: st.run.prompt },
      ],
    });
    const j = extractJson(r.text);
    const steps = (j?.steps ?? []).filter((s) => s && typeof s.label === 'string').slice(0, st.settings.maxSteps)
      .map((s) => ({ mate: st.ro.on(s.mate) ? s.mate : st.ro.on('ops') ? 'ops' : st.ro.leader, label: s.label.slice(0, 120), kind: ['think', 'code', 'file', 'notify', 'research'].includes(s.kind) ? s.kind : 'think' }));
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

// Research only reads public documents and writes its own report, so it is not a risky step (like "think").
const needsApproval = (st, kind) => !['think', 'research'].includes(kind) && (st.run.askFirst || (st.settings.askBeforeRisky && st.settings.permissionMode !== 'auto'));

/* ------------------------------------------------------------------ steps */
const runLine = (st, step) => `Run "${st.run.title}". Your step: ${step.label}. Steps: ${st.run.steps.map((x) => `${x.label} (${x.mate}, ${x.status})`).join('; ').slice(0, 900)}`;
async function stepThink(st, step, feedback = '') {
  const cfg = st.mates[step.mate];
  const steer = st.steer.splice(0).join('\n');
  const r = await converse({
    uid: st.uid, mateKey: step.mate, cfg: cfg ?? {}, settings: st.settings, ctx: { runId: st.run.id, surface: 'run', run: runLine(st, step) },
    history: [{ role: 'user', content: `Overall job:\n${st.run.prompt}\n\nNotes so far:\n${st.run.notes || '(none)'}\n\n${steer ? `Owner steering: ${steer}\n\n` : ''}${feedback ? `Your previous attempt was rejected: ${feedback}\nFix that this time.\n\n` : ''}Your step: ${step.label}\nAnswer with the result of this step only.` }],
    emit: (ev) => { if (ev.type === 'tool') log(st, step.mate, `Using tool: ${ev.name}`); },
  });
  return r.text;
}

/** Cheap second opinion on a step's output. Lenient: only rejects empty, off-topic, refused or clearly broken output. */
async function verifyStep(st, step, output) {
  if (st.settings.verifySteps === false) return { ok: true };
  if (!String(output).trim()) return { ok: false, issue: 'The step produced no output.' };
  try {
    const r = await chat(st.uid, { model: st.settings.fastModel || st.settings.model, json: true, temperature: 0, maxTokens: 200, effort: 'low', messages: [
      { role: 'system', content: 'You check whether a work step\'s output accomplishes the step. Reply JSON only: {"ok":true|false,"issue":"one sentence on what is missing or wrong"}. Be lenient: answer ok=false only if the output is empty, off-topic, a refusal, shows an unhandled error, or is clearly incomplete.' },
      { role: 'user', content: `Job: ${st.run.prompt.slice(0, 600)}\nStep: ${step.label}\n\nOutput:\n${String(output).slice(0, 3000)}` }] });
    const j = extractJson(r.text); return { ok: j?.ok !== false, issue: String(j?.issue ?? '').slice(0, 300) };
  } catch { return { ok: true }; }
}

/** What happened, why it stopped, and what to do next: written when a run fails so it never ends as a bare "failed". */
async function failureReport(st, failedStep, err, attempts) {
  const done = st.run.steps.filter((x) => x.status === 'done').map((x) => `- ${x.label}`).join('\n') || '(none)';
  const base = `## What went wrong\n\nStep **${failedStep?.label ?? 'unknown'}** failed after ${attempts} attempt(s).\n\n> ${String(err).slice(0, 400)}\n\n## Finished before it stopped\n\n${done}\n`;
  try {
    const r = await chat(st.uid, { model: st.settings.fastModel || st.settings.model, maxTokens: 450, temperature: 0.2, effort: 'low', messages: [
      { role: 'system', content: `${briefPersona('ops', st.mates?.ops ?? {})}\n\nWrite a short plain-language failure report in Markdown with two sections: "Likely cause" and "What to try next" (2-4 concrete bullets). No preface.` },
      { role: 'user', content: `Job: ${st.run.prompt.slice(0, 500)}\nFailed step: ${failedStep?.label}\nError: ${String(err).slice(0, 500)}\nRecent log:\n${st.run.log.slice(-8).map((l) => `${l.source}: ${l.text}`).join('\n').slice(0, 1500)}` }] });
    return `${base}\n${r.text}`;
  } catch { return `${base}\n## What to try next\n\n- Press Retry to resume from the failed step.\n- Check the log for details.`; }
}

async function stepCode(st, step, idx) {
  const jobId = `${st.run.id}-${idx}`;
  const done = new Promise((resolve) => jobWaiters.set(jobId, resolve));
  const goal = `${step.label}\n\nContext:\n${st.run.prompt}\n\n${st.run.notes.slice(-3000)}`;
  coder.start({ jobId, runId: st.run.id, uid: st.uid, goal, repo: step.repo || env('DEFAULT_REPO'), branch: step.branch, model: st.settings.model, maxSteps: Math.min(st.settings.maxSteps, 20), githubToken: await githubTokenFor(st.uid), harness: step.harness || st.settings.coderHarness || 'builtin', sandbox: step.sandbox || st.settings.coderSandbox || 'auto', harnessModel: step.harnessModel || '', timeoutMs: Math.max(5, st.settings.stopAfterMinutes - 2) * 60_000 });
  log(st, 'code', `Coding agent started (${HARNESS_NAMES[step.harness || st.settings.coderHarness || 'builtin'] ?? 'built-in'}).`);
  const timeout = sleep(st.settings.stopAfterMinutes * 60_000).then(() => ({ ok: false, summary: 'Timed out waiting for the coding agent.' }));
  const result = await Promise.race([done, timeout, st.stopSignal]);
  jobWaiters.delete(jobId);
  if (st.stopped) { coder.cancel(jobId); throw new Stopped(); }
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
  if (!artifactsReady()) throw new Error('Storage is unavailable.');
  const r = await chat(st.uid, { model: st.settings.model, maxTokens: 3000, messages: [{ role: 'system', content: briefPersona(step.mate, st.mates?.[step.mate] ?? {}, st.ro.byKey[step.mate]) }, { role: 'user', content: `Write the deliverable for this step as Markdown. No preface.\n\nJob:\n${st.run.prompt}\n\nNotes:\n${st.run.notes}\n\nStep: ${step.label}` }] });
  const name = `${step.label.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'output'}.md`;
  const f = await putFile(st.uid, { name, mime: 'text/markdown', buf: Buffer.from(r.text, 'utf8'), source: 'run', runId: st.run.id });
  emit(st, { type: 'file', fileId: f.id });
  log(st, step.mate, `Saved ${name} to Drive.`);
}

/** Deep research on primary documents (research/index.js): collected, extracted page by page, every quote checked. */
async function stepResearch(st, step, idx) {
  const { runResearch } = await import('../research/index.js');
  const { getFileStream } = await import('./files.js');
  const r = await runResearch({
    uid: st.uid, runId: st.run.id, idx, prompt: st.run.prompt, label: step.label, notes: st.run.notes, mate: step.mate, fileIds: st.run.fileIds ?? [], config: step.research ?? {}, settings: st.settings,
    chat: (req) => chat(st.uid, req), persona: (k) => briefPersona(k, st.mates?.[k] ?? {}, st.ro.byKey[k]),
    getFile: async (id) => { const { file, body } = await getFileStream(st.uid, id); return { name: file.name, buf: Buffer.from(await new Response(body).arrayBuffer()) }; },
    log: (t) => log(st, step.mate, t), gate: () => gate(st),
  });
  const name = `${step.label.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'research'}.md`;
  try { const f = await putFile(st.uid, { name, mime: 'text/markdown', buf: Buffer.from(r.report, 'utf8'), source: 'run', runId: st.run.id }); emit(st, { type: 'file', fileId: f.id }); log(st, step.mate, `Saved the report as ${name}.`); }
  catch (e) { log(st, step.mate, `Could not save the report file (${String(e.message).slice(0, 120)}); it is in the run notes.`); }
  for (const u of r.sources) if (!st.run.sources.includes(u)) st.run.sources.push(u);
  st.run.notes = (st.run.notes + `\n\n## ${step.label}\n${r.summary}\n\n${r.report.slice(0, 6000)}`).slice(-NOTES_CAP);
}

async function stepNotify(st, step) {
  const sent = await notify(st.uid, `${st.run.title}\n${step.label}\n\n${st.run.notes.slice(-600)}`);
  log(st, step.mate, sent ? `Sent to ${sent} Telegram chat(s).` : 'No Telegram chat is linked, nothing sent.');
}

/* ------------------------------------------------------------------ main loop */
async function execute(st) {
  let failed = null, attempts = 0;
  try {
    st.run.error = ''; st.run.failure = null;
    emit(st, { type: 'status', status: 'running' });
    if (!st.run.plan?.length) {
      log(st, 'planner', 'Planning…');
      let wf; if (st.run.workflowId) wf = (await userCol(st.uid, 'workflows').doc(st.run.workflowId).get()).data();
      st.run.plan = (await makePlan(st, wf)).map((p, i) => ({ ...p, id: `s${i + 1}` }));
    } else log(st, 'planner', st.run.steps?.length ? 'Resuming from where it stopped.' : st.run.mode === 'research' ? 'Deep research: no planning needed.' : 'Using the given plan.');
    const steps = st.run.plan.map((p) => ({ id: p.id, mate: p.mate, label: p.label, status: st.run.steps.find((x) => x.id === p.id)?.status === 'done' ? 'done' : 'waiting', _p: p }));
    for (const s of steps) if (s.status !== 'done') emit(st, { type: 'step', step: { id: s.id, mate: s.mate, label: s.label, status: 'waiting' } });
    await save(st);

    for (let i = 0; i < steps.length; i++) {
      await gate(st);
      const s = steps[i], p = s._p;
      if (s.status === 'done') continue;
      const view = (status, extra = {}) => ({ id: s.id, mate: s.mate, label: s.label, status, ...extra });
      const started = now();
      if (needsApproval(st, p.kind)) {
        const ok = await ask(st, s, `${s.label} (${p.kind === 'code' ? 'runs the coding agent' : p.kind === 'file' ? 'writes a file to Drive' : 'sends a message'})`);
        if (st.stopped) throw new Stopped();
        emit(st, { type: 'status', status: 'running' });
        if (!ok) { emit(st, { type: 'step', step: view('failed', { startedAt: started, finishedAt: now(), error: 'Denied by you.' }) }); log(st, 'halo', `Skipped (denied): ${s.label}`); continue; }
      }
      const maxTries = Math.max(0, Number(st.settings.retriesOnFailure) || 0);
      let tries = 0, feedback = '';
      const checks = []; // why the checker sent this step back: the evidence the nightly review (reflect.js) learns from
      const withChecks = (extra) => (checks.length ? { ...extra, checks: [...checks] } : extra);
      emit(st, { type: 'step', step: view('running', { startedAt: started, attempt: 1 }) });
      for (;;) {
        try {
          if (p.kind === 'code') await stepCode(st, p, i);
          else if (p.kind === 'file') await stepFile(st, p);
          else if (p.kind === 'notify') await stepNotify(st, p);
          else if (p.kind === 'research') await stepResearch(st, p, i);
          else {
            const out = await stepThink(st, p, feedback);
            const v = await verifyStep(st, p, out);
            if (!v.ok && tries < maxTries) { feedback = v.issue || 'The output did not accomplish the step.'; checks.push(feedback.slice(0, 300)); tries++; log(st, 'ops', `Checked "${s.label}": ${feedback} Trying again (${tries}/${maxTries}).`); emit(st, { type: 'step', step: view('running', withChecks({ startedAt: started, attempt: tries + 1 })) }); continue; }
            log(st, s.mate, out.slice(0, 600));
            st.run.notes = (st.run.notes + `\n\n## ${s.label}\n${out}`).slice(-NOTES_CAP);
          }
          emit(st, { type: 'step', step: view('done', withChecks({ startedAt: started, finishedAt: now(), attempt: tries + 1 })) });
          break;
        } catch (e) {
          if (e instanceof Stopped || st.stopped) throw new Stopped();
          attempts = tries + 1;
          if (tries++ < maxTries) { feedback = `It crashed with: ${String(e.message).slice(0, 200)}`; checks.push(feedback.slice(0, 300)); log(st, 'ops', `"${s.label}" failed (${String(e.message).slice(0, 160)}). Retrying ${tries}/${maxTries}…`); emit(st, { type: 'step', step: view('running', withChecks({ startedAt: started, attempt: tries + 1 })) }); await sleep(1500 * tries); continue; }
          emit(st, { type: 'step', step: view('failed', withChecks({ startedAt: started, finishedAt: now(), attempt: attempts, error: String(e.message).slice(0, 400) })) });
          failed = s;
          throw e;
        }
      }
      await save(st);
    }

    const fin = await chat(st.uid, { model: st.settings.model, maxTokens: 1500, effort: effortOf(st.mates.writer?.thinking), messages: [{ role: 'system', content: briefPersona('writer', st.mates?.writer ?? {}) }, { role: 'user', content: `Write the final report (Markdown, brief, with the answer first) for this job.\n\nJob:\n${st.run.prompt}\n\nNotes:\n${st.run.notes}` }] }).catch(() => null);
    st.run.report = fin?.text ?? st.run.notes;
    emit(st, { type: 'status', status: 'done' });
    if (st.settings.notifyTelegram) void notify(st.uid, `Done: ${st.run.title}\n\n${st.run.report.slice(0, 700)}`);
    void learnFromTurn(st.uid, { user: st.run.prompt, assistant: st.run.report.slice(0, 600), mate: 'planner', settings: st.settings });
  } catch (e) {
    if (e instanceof Stopped) { emit(st, { type: 'status', status: 'stopped' }); log(st, 'ops', 'Stopped.'); }
    else {
      st.run.error = String(e.message).slice(0, 500); log(st, 'ops', `Failed: ${st.run.error}`);
      st.run.failure = { step: failed?.label ?? null, stepId: failed?.id ?? null, error: st.run.error, attempts: attempts || 1, at: now() };
      st.run.report = await failureReport(st, failed, e.message, attempts || 1);
      emit(st, { type: 'status', status: 'failed' });
      if (st.settings.notifyTelegram) void notify(st.uid, `Run failed: ${st.run.title}\nStep: ${failed?.label ?? 'planning'}\n${st.run.error}\nOpen the run to see the report and press Retry.`);
    }
  } finally {
    await save(st);
    await activeRef(st.run.id).delete().catch(() => {});
    for (const send of st.subs) { try { send({ type: 'status', status: st.run.status }); } catch { /* closed */ } }
    setTimeout(() => live.delete(st.run.id), 60_000).unref();
  }
}

/* ------------------------------------------------------------------ public API */
/**
 * mode 'research': skip planning and run one deep-research step (by Research, else Data, else the leader). `research`
 * = optional hints for it: { parameters, target, sources }.
 */
export async function startRun(uid, { prompt, workflowId, askFirst = false, fileIds = [], title, unattended = false, mode = '', research = null } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw Object.assign(new Error('prompt is required'), { statusCode: 400 });
  const settings = await getSettings(uid);
  const ro = await loadRoster(uid); const mates = ro.cfgs;
  const ref = userCol(uid, 'runs').doc();
  const ts = now();
  const files = (Array.isArray(fileIds) ? fileIds : []).map(String).slice(0, 20);
  const run = { id: ref.id, createdAt: ts, updatedAt: ts, title: (title || prompt.trim().split('\n')[0]).slice(0, 80), prompt: prompt.trim().slice(0, 8000), workflowId, askFirst: !!askFirst, status: 'queued', steps: [], log: [], approvals: [], fileIds: files, sources: [], report: '', notes: '' };
  if (mode === 'research') {
    const who = ['research', 'data'].find((k) => ro.on(k)) ?? ro.leader;
    const hints = research && typeof research === 'object' ? { parameters: research.parameters, target: research.target, sources: research.sources } : {};
    run.mode = 'research'; run.plan = [{ id: 's1', mate: who, label: `Deep research: ${run.title}`.slice(0, 120), kind: 'research', research: hints }];
  }
  return launch(uid, run, settings, mates, unattended, true);
}

async function launch(uid, run, settings, mates, unattended, fresh) {
  let stop; const stopSignal = new Promise((r) => { stop = r; });
  const st = { uid, run, settings, mates, ro: await loadRoster(uid), unattended, subs: new Set(), steer: [], approvals: new Map(), paused: false, stopped: false, stopSignal, stop: () => stop({ ok: false, summary: 'Stopped.' }) };
  live.set(run.id, st);
  await runRef(uid, run.id).set(withoutId(run));
  await activeRef(run.id).set({ uid, at: now() });
  const snapshot = structuredClone(run);
  void execute(st);
  return snapshot;
}

/** Resume a failed or stopped run from its first unfinished step (keeps notes, log and finished steps). */
export async function retryRun(uid, id) {
  if (live.has(id)) throw Object.assign(new Error('This run is still active'), { statusCode: 409 });
  const d = await runRef(uid, id).get(); if (!d.exists) throw Object.assign(new Error('Not found'), { statusCode: 404 });
  const run = { id, ...d.data() };
  if (!['failed', 'stopped'].includes(run.status)) throw Object.assign(new Error('Only failed or stopped runs can be retried'), { statusCode: 409 });
  const settings = await getSettings(uid);
  const mates = (await loadRoster(uid)).cfgs;
  run.status = 'queued'; run.error = ''; run.failure = null; run.report = ''; run.steps = (run.steps ?? []).map((x) => (x.status === 'done' ? x : { ...x, status: 'waiting', error: undefined }));
  run.log = [...(run.log ?? []), { at: now(), source: 'you', text: 'Retry requested.' }].slice(-LOG_CAP);
  return launch(uid, run, settings, mates, false, false);
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
const testSinks = new Map(); // runId -> { logs } for harness test jobs (no run doc)
export function jobEvent(runId, body) {
  const sink = testSinks.get(runId);
  if (sink) { sink.logs.push(...(body.logs ?? []).slice(0, 50)); if (body.done) jobWaiters.get(body.jobId)?.(body.done); return true; }
  const st = live.get(runId);
  if (!st) return false;
  for (const l of (body.logs ?? []).slice(0, 50)) log(st, 'code', l);
  if (body.done) jobWaiters.get(body.jobId)?.(body.done);
  return true;
}

/** Connections → Coding harness → Test: a tiny repo-less job through the chosen harness. */
export async function testHarness(uid, harness, sandbox = 'auto') {
  const runId = `test-${Date.now().toString(36)}`; const jobId = `${runId}-0`; const sink = { logs: [] };
  testSinks.set(runId, sink);
  const done = new Promise((resolve) => jobWaiters.set(jobId, resolve));
  try {
    const settings = await getSettings(uid);
    coder.start({ jobId, runId, uid, goal: `Create the file out/hello.txt containing exactly this line: hello from ${harness}`, model: settings.model, harness, sandbox, timeoutMs: 8 * 60_000, maxSteps: 6 });
    const r = await Promise.race([done, sleep(9 * 60_000).then(() => ({ ok: false, summary: 'Timed out after 9 minutes.' }))]);
    const file = (r.files ?? []).find((f) => f.name === 'hello.txt');
    return { ok: !!r.ok && !!file && Buffer.from(file.b64, 'base64').toString('utf8').includes(`hello from ${harness}`), summary: r.summary, files: (r.files ?? []).map((f) => f.name), logs: sink.logs.slice(-40) };
  } finally { testSinks.delete(runId); jobWaiters.delete(jobId); }
}

/* ------------------------------------------------------------------ housekeeping */

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

/** A line in a live run's log from outside the engine (for example, waiting for the owner's answer). */
export function runLog(runId, text) { const st = live.get(runId); if (st) log(st, 'owner', text); }
