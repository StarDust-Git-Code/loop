// Coder service: a small coding agent. It asks the API's LLM gateway what to do (JSON tool protocol works on any model),
// edits files in an ephemeral workspace, then commits a branch and opens a PR if GITHUB_TOKEN is set.
// 512 MB budget: one job at a time, short command timeouts, capped outputs.
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { env, need, num, sleep } from '../lib/env.js';
import { svcJson } from '../lib/svc.js';
import { parseTextCalls } from '../api/toolcalls.js';
import { createServer, svcOnly, listen } from '../lib/server.js';

for (const k of ['SERVICE_SECRET', 'API_URL']) need(k);
const ROOT = '/tmp/loop-work';
const app = await createServer('coder');
let current = null; // { jobId, cancel }

const ALLOWED = new Set(['node', 'npm', 'npx', 'python3', 'ls', 'cat', 'grep', 'find', 'head', 'tail', 'wc', 'diff', 'git']);
const GIT_OK = new Set(['status', 'diff', 'log', 'show', 'ls-files', 'blame']);
const cap = (s, n = 6000) => (s.length > n ? `${s.slice(0, n)}\n…[truncated ${s.length - n} chars]` : s);

/* ---------- process helpers ---------- */
function exec(cmd, args, { cwd, timeoutMs = 120_000, extraEnv = {} } = {}) {
  return new Promise((done) => {
    const child = spawn(cmd, args, { cwd, detached: true, env: { PATH: process.env.PATH, HOME: '/tmp', LANG: 'C.UTF-8', CI: '1', NODE_OPTIONS: '--max-old-space-size=256', GIT_TERMINAL_PROMPT: '0', ...extraEnv } });
    let out = '';
    const add = (d) => { if (out.length < 200_000) out += d.toString(); };
    child.stdout.on('data', add); child.stderr.on('data', add);
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } out += '\n[killed: timeout]'; }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); done({ code: 127, out: `${out}${e.message}` }); });
    child.on('close', (code) => { clearTimeout(timer); done({ code, out }); });
  });
}
const authArgs = () => (env('GITHUB_TOKEN') ? ['-c', `http.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${env('GITHUB_TOKEN')}`).toString('base64')}`] : []);

/* ---------- workspace ---------- */
const inside = (dir, p) => { const full = resolve(dir, p || '.'); if (full !== dir && !full.startsWith(dir + sep)) throw new Error('path escapes the workspace'); return full; };

async function tool(dir, name, a = {}) {
  if (name === 'list_dir') {
    const full = inside(dir, a.path);
    const items = await readdir(full, { withFileTypes: true });
    return items.filter((d) => d.name !== '.git' && d.name !== 'node_modules').slice(0, 200).map((d) => d.name + (d.isDirectory() ? '/' : '')).join('\n') || '(empty)';
  }
  if (name === 'read_file') {
    const full = inside(dir, a.path);
    if ((await stat(full)).size > 2_000_000) throw new Error('file too large');
    return cap(await readFile(full, 'utf8'), 20_000);
  }
  if (name === 'write_file') {
    if (typeof a.content !== 'string') throw new Error('content must be a string');
    const full = inside(dir, a.path);
    if (full.split(sep).includes('.git')) throw new Error('cannot write inside .git');
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, a.content);
    return `wrote ${relative(dir, full)} (${a.content.length} chars)`;
  }
  if (name === 'run') {
    const cmd = String(a.cmd || ''); const args = Array.isArray(a.args) ? a.args.map(String) : [];
    if (!ALLOWED.has(cmd)) throw new Error(`command not allowed: ${cmd}. Allowed: ${[...ALLOWED].join(', ')}`);
    if (cmd === 'git' && !GIT_OK.has(args[0])) throw new Error('git is read-only here (status, diff, log, show, ls-files). Commits are made for you.');
    if (cmd === 'node' && args.some((x) => /^(-e|--eval|-p|--print)$/.test(x))) throw new Error('use write_file then run the file');
    const r = await exec(cmd, args, { cwd: inside(dir, a.cwd), timeoutMs: Math.min(num('CMD_TIMEOUT_MS', 120_000), 170_000) });
    return cap(`exit ${r.code}\n${r.out}`);
  }
  throw new Error(`unknown tool: ${name}`);
}

const SYSTEM = (goal) => `You are a careful coding agent working in a sandbox workspace. Goal:\n${goal}\n
Each turn reply with ONE JSON object and nothing else:
{"tool":"list_dir","args":{"path":"."}}
{"tool":"read_file","args":{"path":"src/a.js"}}
{"tool":"write_file","args":{"path":"src/a.js","content":"full new file content"}}
{"tool":"run","args":{"cmd":"node","args":["test.js"]}}   (allowed: ${[...ALLOWED].join(', ')}; git is read-only)
{"tool":"finish","args":{"summary":"what you did and anything left"}}
Rules: look before you change; write whole files; keep changes small; run tests if they exist; never print secrets; the machine is tiny (512 MB), so avoid heavy installs/builds. Call finish when done or when blocked.`;

const parseTurn = (text) => { const c = parseTextCalls(text)[0]; return c ? { tool: c.name, args: c.args } : null; }; // tolerant: fences, stray tags, several calls (the first runs)

/* ---------- reporting back to the API ---------- */
async function report(job, body) {
  for (let i = 0; i < 3; i++) {
    try { await svcJson(env('API_URL'), `/internal/runs/${job.runId}/events`, { method: 'POST', body: { jobId: job.jobId, ...body } }); return; }
    catch (e) { if (i === 2) console.error('report failed', e.message); else await sleep(1500 * (i + 1)); }
  }
}

/* ---------- the job ---------- */
async function runJob(job, state) {
  const dir = join(ROOT, job.jobId.replace(/[^\w-]/g, '_'));
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const say = (t) => report(job, { logs: [String(t).slice(0, 500)] });
  try {
    let hasRepo = false;
    if (job.repo) {
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?$/.test(job.repo)) throw new Error('repo must be an https://github.com/owner/name URL');
      const r = await exec('git', [...authArgs(), 'clone', '--depth', '1', ...(job.branch ? ['--branch', job.branch] : []), job.repo, 'repo'], { cwd: dir, timeoutMs: 150_000 });
      if (r.code !== 0) throw new Error(`git clone failed: ${cap(r.out.replace(env('GITHUB_TOKEN') || '\u0000', '***'), 400)}`);
      hasRepo = true; await say(`Cloned ${job.repo}`);
    }
    const work = hasRepo ? join(dir, 'repo') : dir;
    if (!hasRepo) await mkdir(join(work, 'out'), { recursive: true });
    const messages = [{ role: 'system', content: SYSTEM(job.goal) }, { role: 'user', content: hasRepo ? 'The repository is checked out in the workspace root. Start by listing it.' : 'Empty workspace. Put any deliverables in the out/ folder.' }];
    let summary = '';
    for (let i = 0; i < (job.maxSteps || 12); i++) {
      if (state.cancelled) throw new Error('cancelled');
      const r = await svcJson(env('API_URL'), '/internal/llm', { method: 'POST', body: { uid: job.uid, model: job.model, messages, maxTokens: 3000, temperature: 0.2 } });
      const turn = parseTurn(r.text);
      messages.push({ role: 'assistant', content: r.text.slice(0, 12_000) });
      if (!turn) { messages.push({ role: 'user', content: 'Reply with exactly one JSON object like {"tool":"list_dir","args":{"path":"."}}.' }); continue; }
      if (turn.tool === 'finish') { summary = String(turn.args?.summary ?? 'Done.'); break; }
      let result;
      try { result = await tool(work, turn.tool, turn.args); } catch (e) { result = `ERROR: ${e.message}`; }
      await say(`${turn.tool} ${turn.args?.path ?? turn.args?.cmd ?? ''}`.trim());
      messages.push({ role: 'user', content: `Result of ${turn.tool}:\n${result}` });
      if (messages.length > 24) messages.splice(2, 2); // keep the prompt small
    }
    if (!summary) summary = 'Stopped at the step limit. Partial work may be in the workspace.';

    const out = { ok: true, summary };
    if (hasRepo) {
      const st = await exec('git', ['status', '--porcelain'], { cwd: work });
      if (st.out.trim()) {
        const branch = `loop/${job.jobId.replace(/[^\w-]/g, '').slice(0, 24)}`;
        const g = (args) => exec('git', ['-c', `user.name=${env('GIT_AUTHOR_NAME', 'Loopmates')}`, '-c', `user.email=${env('GIT_AUTHOR_EMAIL', 'loopmates@users.noreply.github.com')}`, ...args], { cwd: work });
        await g(['checkout', '-b', branch]); await g(['add', '-A']);
        const c = await g(['commit', '-m', `Loopmates: ${job.goal.split('\n')[0].slice(0, 70)}`]);
        if (c.code !== 0) throw new Error(`git commit failed: ${cap(c.out, 300)}`);
        if (env('GITHUB_TOKEN')) {
          const p = await exec('git', [...authArgs(), 'push', 'origin', branch], { cwd: work, timeoutMs: 150_000 });
          if (p.code !== 0) throw new Error(`git push failed: ${cap(p.out.replace(env('GITHUB_TOKEN'), '***'), 300)}`);
          out.branch = branch;
          const [, owner, name] = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(job.repo);
          const base = (await exec('git', ['rev-parse', '--abbrev-ref', 'origin/HEAD'], { cwd: work })).out.trim().replace('origin/', '') || 'main';
          const pr = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls`, { method: 'POST', headers: { authorization: `Bearer ${env('GITHUB_TOKEN')}`, 'user-agent': 'loopmates', accept: 'application/vnd.github+json' }, body: JSON.stringify({ title: `Loopmates: ${job.goal.split('\n')[0].slice(0, 70)}`, head: branch, base, body: summary.slice(0, 3000) }), signal: AbortSignal.timeout(20_000) });
          if (pr.ok) out.prUrl = (await pr.json()).html_url; else out.summary += `\n(PR not opened: GitHub ${pr.status}. Branch ${branch} is pushed.)`;
        } else out.summary += '\n(GITHUB_TOKEN not set on the Coder: changes were committed locally but not pushed, so they are lost when the workspace is cleaned.)';
      } else out.summary += '\n(No file changes.)';
    } else { // no repo: hand small deliverables back so the API can store them in Drive
      const files = [];
      const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) await walk(p); else if (files.length < 5 && (await stat(p)).size <= 200_000) files.push({ name: relative(join(work, 'out'), p), b64: (await readFile(p)).toString('base64') }); } };
      await walk(join(work, 'out')).catch(() => {});
      if (files.length) out.files = files;
    }
    await report(job, { done: out });
  } catch (e) {
    await report(job, { done: { ok: false, summary: String(e.message).slice(0, 600) } });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    current = null;
  }
}

app.post('/v1/jobs', { preHandler: svcOnly }, async (req, reply) => {
  const j = req.body ?? {};
  if (!j.jobId || !j.runId || !j.uid || !j.goal) return reply.code(400).send({ error: 'jobId, runId, uid, goal required' });
  if (current) return reply.code(429).send({ error: 'Coder is busy with another job', busy: current.jobId });
  const state = { cancelled: false };
  current = { jobId: j.jobId, cancel: () => { state.cancelled = true; } };
  void runJob(j, state);
  return reply.code(202).send({ accepted: true });
});
app.post('/v1/jobs/:id/cancel', { preHandler: svcOnly }, async (req) => { if (current?.jobId === req.params.id) current.cancel(); return { ok: true }; });
app.get('/v1/jobs/current', { preHandler: svcOnly }, async () => ({ current: current?.jobId ?? null }));

await mkdir(ROOT, { recursive: true });
exec('git', ['--version'], { timeoutMs: 10_000 }).then((r) => { if (r.code !== 0) app.log.warn('git is not available on this host: repo jobs will fail. Repo-less jobs still work.'); });
await listen(app);
