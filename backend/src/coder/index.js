// Coder: runs coding jobs inside the server process, in a per-job workspace under the data folder, then commits a branch
// and opens a PR. The work itself is done by a harness:
//   builtin  - a small agent here that asks the LLM what to do (a JSON tool protocol that works on any model)
//   claude / codex / opencode - an external coding CLI (coder/harness.js), SUPERVISED: the Code Mate writes a brief with
//     acceptance criteria, the harness works, the supervisor checks the diff and runs the tests, and sends it back with
//     feedback (up to 3 rounds) before anything is committed.
// Commands run in a sandbox: Docker when available (SANDBOX=auto|docker), otherwise a restricted child process
// (an allow-list of programs, no shell, short timeouts). One job at a time.
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { env, num } from '../lib/env.js';
import { dir as dataSub } from '../lib/paths.js';
import { parseTextCalls } from '../api/toolcalls.js';
import { HARNESS_NAMES, detectHarnesses, runHarness } from './harness.js';

const WIN = process.platform === 'win32';
const ALLOWED = new Set(['node', 'npm', 'npx', 'python3', 'python', 'ls', 'cat', 'grep', 'find', 'head', 'tail', 'wc', 'diff', 'git']);
const GIT_OK = new Set(['status', 'diff', 'log', 'show', 'ls-files', 'blame']);
const cap = (s, n = 6000) => (s.length > n ? `${s.slice(0, n)}\n…[truncated ${s.length - n} chars]` : s);
const IMAGE = () => env('SANDBOX_IMAGE', 'node:22-bookworm-slim');

/* ---------- process helpers ---------- */
/** Run a program without a shell. On Windows, npm/npx are run through node so no .cmd shim (and no shell) is needed. */
export function exec(cmd, args, { cwd, timeoutMs = 120_000, extraEnv = {} } = {}) {
  let file = cmd, argv = args;
  if (WIN && (cmd === 'npm' || cmd === 'npx')) {
    const cli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', `${cmd}-cli.js`);
    file = process.execPath; argv = [cli, ...args];
  }
  if (WIN && cmd === 'python3') file = 'python';
  return new Promise((done) => {
    const child = spawn(file, argv, { cwd, detached: !WIN, windowsHide: true, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: cwd, USERPROFILE: cwd, LANG: 'C.UTF-8', CI: '1', NODE_OPTIONS: '--max-old-space-size=512', GIT_TERMINAL_PROMPT: '0', ...extraEnv } });
    let out = '';
    const add = (d) => { if (out.length < 200_000) out += d.toString(); };
    child.stdout.on('data', add); child.stderr.on('data', add);
    const kill = () => {
      try { if (WIN) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }); else process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ }
    };
    const timer = setTimeout(() => { kill(); out += '\n[killed: timeout]'; }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); done({ code: 127, out: `${out}${e.message}` }); });
    child.on('close', (code) => { clearTimeout(timer); done({ code, out }); });
  });
}

let dockerOk = null;
export async function useDocker() {
  const mode = env('SANDBOX', 'auto');
  if (mode === 'process') return false;
  if (dockerOk === null) dockerOk = (await exec('docker', ['version', '--format', '{{.Server.Version}}'], { timeoutMs: 15_000 })).code === 0;
  if (mode === 'docker' && !dockerOk) throw new Error('SANDBOX=docker but Docker is not running.');
  return dockerOk;
}
/** Which sandbox runs commands, for the status page. */
export async function sandboxInfo() {
  try { return (await useDocker()) ? { kind: 'docker', image: IMAGE() } : { kind: 'process', warning: 'Docker is not installed or not running: commands run as restricted child processes on this computer.' }; }
  catch (e) { return { kind: 'none', warning: e.message }; }
}
/** A command inside the workspace: in a throwaway container (only the workspace is mounted, 1 GB RAM, 1 CPU), or a restricted process. */
async function sandboxed(work, cwd, cmd, args, timeoutMs) {
  if (await useDocker()) {
    const rel = relative(work, cwd).split(sep).join('/');
    return exec('docker', ['run', '--rm', '-m', '1g', '--cpus', '1', '--pids-limit', '256', '--security-opt', 'no-new-privileges', '-v', `${work}:/w`, '-w', `/w/${rel}`, '-e', 'CI=1', '-e', 'HOME=/tmp', IMAGE(), cmd === 'python' ? 'python3' : cmd, ...args], { timeoutMs });
  }
  return exec(cmd, args, { cwd, timeoutMs });
}

const ghToken = (job) => job.githubToken || env('GITHUB_TOKEN');
const authArgs = (job) => (ghToken(job) ? ['-c', `http.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${ghToken(job)}`).toString('base64')}`] : []);
/** owner/name allow-list (GITHUB_REPOS). Empty list = any repo the token can reach. */
export function repoAllowed(url) {
  const m = /github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?$/i.exec(String(url));
  if (!m) return false;
  const list = env('GITHUB_REPOS').split(',').map((s) => s.trim().toLowerCase().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')).filter(Boolean);
  return !list.length || list.includes(m[1].toLowerCase());
}

/* ---------- workspace ---------- */
const inside = (root, p) => { const full = resolve(root, p || '.'); if (full !== root && !full.startsWith(root + sep)) throw new Error('path escapes the workspace'); return full; };

async function tool(root, name, a = {}) {
  if (name === 'list_dir') {
    const items = await readdir(inside(root, a.path), { withFileTypes: true });
    return items.filter((d) => d.name !== '.git' && d.name !== 'node_modules').slice(0, 200).map((d) => d.name + (d.isDirectory() ? '/' : '')).join('\n') || '(empty)';
  }
  if (name === 'read_file') {
    const full = inside(root, a.path);
    if ((await stat(full)).size > 2_000_000) throw new Error('file too large');
    return cap(await readFile(full, 'utf8'), 20_000);
  }
  if (name === 'write_file') {
    if (typeof a.content !== 'string') throw new Error('content must be a string');
    const full = inside(root, a.path);
    if (full.split(sep).includes('.git')) throw new Error('cannot write inside .git');
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, a.content);
    return `wrote ${relative(root, full).split(sep).join('/')} (${a.content.length} chars)`;
  }
  if (name === 'run') {
    const cmd = String(a.cmd || ''); const args = Array.isArray(a.args) ? a.args.map(String) : [];
    if (!ALLOWED.has(cmd)) throw new Error(`command not allowed: ${cmd}. Allowed: ${[...ALLOWED].join(', ')}`);
    if (cmd === 'git' && !GIT_OK.has(args[0])) throw new Error('git is read-only here (status, diff, log, show, ls-files). Commits are made for you.');
    if (cmd === 'node' && args.some((x) => /^(-e|--eval|-p|--print)$/.test(x))) throw new Error('use write_file then run the file');
    const r = await sandboxed(root, inside(root, a.cwd), cmd, args, Math.min(num('CMD_TIMEOUT_MS', 120_000), 170_000));
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
Rules: look before you change; write whole files; keep changes small; run tests if they exist; never print secrets; avoid heavy installs and builds. Call finish when done or when blocked.`;

const parseTurn = (text) => { const c = parseTextCalls(text)[0]; return c ? { tool: c.name, args: c.args } : null; }; // tolerant: fences, stray tags, several calls (the first runs)


/* ---------- the built-in agent ---------- */
async function builtinAgent(job, state, { llm, work, hasRepo, say }) {
  const messages = [{ role: 'system', content: SYSTEM(job.goal) }, { role: 'user', content: hasRepo ? 'The repository is checked out in the workspace root. Start by listing it.' : 'Empty workspace. Put any deliverables in the out/ folder.' }];
  let summary = '';
  for (let i = 0; i < (job.maxSteps || 12); i++) {
    if (state.cancelled) throw new Error('cancelled');
    const r = await llm({ uid: job.uid, model: job.model, messages, maxTokens: 3000, temperature: 0.2 });
    const turn = parseTurn(r.text);
    messages.push({ role: 'assistant', content: r.text.slice(0, 12_000) });
    if (!turn) { messages.push({ role: 'user', content: 'Reply with exactly one JSON object like {"tool":"list_dir","args":{"path":"."}}.' }); continue; }
    if (turn.tool === 'finish') { summary = String(turn.args?.summary ?? 'Done.'); break; }
    let result;
    try { result = await tool(work, turn.tool, turn.args); } catch (e) { result = `ERROR: ${e.message}`; }
    say(`${turn.tool} ${turn.args?.path ?? turn.args?.cmd ?? ''}`.trim());
    messages.push({ role: 'user', content: `Result of ${turn.tool}:\n${result}` });
    if (messages.length > 24) messages.splice(2, 2); // keep the prompt small
  }
  return summary || 'Stopped at the step limit. Partial work may be in the workspace.';
}

/* ---------- supervising an external harness ---------- */
const extractJson = (t) => { try { const m = /\{[\s\S]*\}/.exec(String(t)); return m ? JSON.parse(m[0]) : null; } catch { return null; } };
/** A test command is only run if its program is on the allow-list, without a shell. */
function testCommand(cmdline) {
  const parts = String(cmdline ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length || !ALLOWED.has(parts[0]) || parts.some((p) => /[;&|`$<>]/.test(p))) return null;
  if (parts[0] === 'git') return null;
  return { cmd: parts[0], args: parts.slice(1) };
}
async function changesOf(work, hasRepo, startHead) {
  if (!hasRepo) {
    const files = [];
    const walk = async (d, depth = 0) => { for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) { if (e.name === 'auth' || e.name === '.git' || e.name === 'node_modules') continue; const p = join(d, e.name); if (e.isDirectory() && depth < 4) await walk(p, depth + 1); else if (e.isFile()) files.push(`${relative(work, p).split(sep).join('/')} (${(await stat(p)).size} bytes)`); } };
    await walk(work); return files.length ? `Files in the workspace:\n${files.slice(0, 60).join('\n')}` : '(the workspace is empty)';
  }
  await exec('git', ['add', '-A', '--intent-to-add', '.'], { cwd: work });
  const base = startHead || 'HEAD';
  const stat_ = (await exec('git', ['diff', '--stat', base], { cwd: work })).out.trim();
  const diff = (await exec('git', ['diff', base], { cwd: work })).out;
  return stat_ ? `${stat_}\n\n${cap(diff, 14_000)}` : '(no changes)';
}

/** Brief -> harness -> check diff and tests -> feedback, up to 3 rounds. Returns the summary. */
async function supervise(job, state, { llm, work, dir, hasRepo, say }) {
  const name = HARNESS_NAMES[job.harness] ?? job.harness;
  const det = (await detectHarnesses())[job.harness];
  let sandbox = job.sandbox || 'auto';
  if (sandbox === 'auto') sandbox = (await detectHarnesses()).docker?.ok ? 'docker' : 'host';
  if (sandbox === 'docker' && !(await detectHarnesses()).docker?.ok) throw new Error((await detectHarnesses()).docker?.error || 'Docker is not available for the coding harness.');
  if (sandbox === 'host' && !det?.ok) throw new Error(`${name} is not installed on this computer. ${det?.install ?? ''}`.trim());
  const startHead = hasRepo ? (await exec('git', ['rev-parse', 'HEAD'], { cwd: work })).out.trim() : '';

  // 1. The brief: acceptance criteria and a test command, written by the Code Mate's model.
  let brief = { criteria: [], test: '', notes: '' };
  try {
    const listing = hasRepo ? (await exec('git', ['ls-files'], { cwd: work })).out.split('\n').slice(0, 150).join('\n') : '(empty workspace)';
    const r = await llm({ uid: job.uid, model: job.model, maxTokens: 700, temperature: 0.1, messages: [
      { role: 'system', content: 'You are the Code Mate supervising a coding agent. Write its brief. Reply JSON only: {"criteria":["checkable acceptance criteria, 2-6"],"test":"one test command using node/npm/npx/python, or empty if there are no tests","notes":"constraints and files that likely matter, one short paragraph"}' },
      { role: 'user', content: `Goal:\n${job.goal}\n\nFiles:\n${listing}` }] });
    const j = extractJson(r.text); if (j) brief = { criteria: (j.criteria ?? []).map(String).slice(0, 6), test: String(j.test ?? ''), notes: String(j.notes ?? '').slice(0, 800) };
  } catch (e) { say(`Brief: using the goal as is (${String(e.message).slice(0, 80)})`); }
  const test = testCommand(brief.test);
  const criteria = brief.criteria.length ? brief.criteria : ['The goal is met', 'Existing behaviour still works'];
  let prompt = `${job.goal}\n\nAcceptance criteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}${brief.notes ? `\n\nNotes: ${brief.notes}` : ''}${test ? `\n\nCheck your work with: ${brief.test}` : ''}\n\nRules: work only inside this folder. Do not commit, push or open pull requests: the supervisor does that after review. Never print or store secrets. ${hasRepo ? '' : 'Put deliverables in the out/ folder.'}\nWhen you are done, end with a short summary of what you changed and anything left.`;
  say(`${name} is working (${sandbox === 'docker' ? 'in Docker' : 'on this computer'}).`);

  let session = '', final = '', verdict = { ok: true, issues: [] }, rounds = 0;
  const ac = new AbortController(); const poll = setInterval(() => { if (state.cancelled) ac.abort(); }, 1000);
  try {
    for (rounds = 1; rounds <= 3; rounds++) {
      const r = await runHarness(job.harness, { cwd: work, jobDir: dir, prompt, resume: session, model: job.harnessModel || '', maxTurns: 40, timeoutMs: job.timeoutMs || 20 * 60_000, sandbox, signal: ac.signal, onLog: (t) => say(`${job.harness}: ${t}`) });
      if (state.cancelled) throw new Error('cancelled');
      session = r.session || session; final = r.final || final;
      if (r.error && !r.final) throw new Error(`${name} stopped: ${r.error}`);
      // 2. Check: what changed, and do the tests pass?
      const changes = await changesOf(work, hasRepo, startHead);
      let testOut = '';
      if (test) { const t = await sandboxed(work, work, test.cmd, test.args, 170_000); testOut = `exit ${t.code}\n${cap(t.out, 4000)}`; say(`check: ${brief.test} → exit ${t.code}`); }
      // 3. Review against the criteria.
      try {
        const v = await llm({ uid: job.uid, model: job.model, maxTokens: 500, temperature: 0, messages: [
          { role: 'system', content: 'You review a coding agent\'s work against acceptance criteria. Be strict on the criteria and on failing tests, lenient on style. Reply JSON only: {"ok":true|false,"issues":["specific things to fix"]}' },
          { role: 'user', content: `Goal:\n${job.goal}\n\nCriteria:\n${criteria.join('\n')}\n\nAgent summary:\n${cap(final || '(none)', 2000)}\n\nChanges:\n${changes}\n\n${test ? `Tests (${brief.test}):\n${testOut}` : 'No test command.'}` }] });
        const j = extractJson(v.text); verdict = { ok: j?.ok !== false, issues: (j?.issues ?? []).map(String).slice(0, 6) };
      } catch { verdict = { ok: !test || /^exit 0/.test(testOut), issues: test && !/^exit 0/.test(testOut) ? ['The tests fail.'] : [] }; }
      if (changes === '(no changes)' && hasRepo) verdict = { ok: false, issues: ['Nothing was changed in the repository.'] };
      say(verdict.ok ? `Review round ${rounds}: accepted.` : `Review round ${rounds}: ${verdict.issues.join('; ').slice(0, 300)}`);
      if (verdict.ok) break;
      if (rounds === 3) break;
      prompt = `Review of your work found problems. Fix them, keep everything else as it is:\n${verdict.issues.map((x) => `- ${x}`).join('\n')}${testOut && !/^exit 0/.test(testOut) ? `\n\nTest output:\n${cap(testOut, 2500)}` : ''}\n\nAgain: do not commit or push. End with a short summary.`;
      if (!session) { prompt = `${job.goal}\n\n${prompt}`; } // harness gave no session id: start over with the context
    }
  } finally { clearInterval(poll); await rm(`${dir}-auth`, { recursive: true, force: true }).catch(() => {}); }
  return `${name}: ${cap(final || 'Done.', 2500)}${verdict.ok ? '' : `\n\nNot fully accepted after ${Math.min(rounds, 3)} review rounds:\n${verdict.issues.map((x) => `- ${x}`).join('\n')}`}`;
}

/* ---------- the job ---------- */
async function runJob(job, state, { llm, onEvent }) {
  const root = dataSub('work');
  const dir = join(root, job.jobId.replace(/[^\w-]/g, '_'));
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const report = (body) => { try { onEvent(job.runId, { jobId: job.jobId, ...body }); } catch (e) { console.error('coder report failed', e.message); } };
  const say = (t) => report({ logs: [String(t).slice(0, 500)] });
  const tok = ghToken(job);
  const scrub = (s) => (tok ? String(s).split(tok).join('***') : String(s));
  try {
    let hasRepo = false;
    if (job.repo) {
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?$/.test(job.repo)) throw new Error('repo must be an https://github.com/owner/name URL');
      if (!repoAllowed(job.repo)) throw new Error(`${job.repo} is not in the allowed repositories (Connections → GitHub).`);
      const r = await exec('git', [...authArgs(job), 'clone', '--depth', '1', ...(job.branch ? ['--branch', job.branch] : []), job.repo, 'repo'], { cwd: dir, timeoutMs: 150_000 });
      if (r.code !== 0) throw new Error(`git clone failed: ${cap(scrub(r.out), 400)}`);
      hasRepo = true; say(`Cloned ${job.repo}`);
    }
    const work = hasRepo ? join(dir, 'repo') : dir;
    if (!hasRepo) await mkdir(join(work, 'out'), { recursive: true });
    const startHead = hasRepo ? (await exec('git', ['rev-parse', 'HEAD'], { cwd: work })).out.trim() : '';
    let summary = '';
    if (job.harness && job.harness !== 'builtin') summary = await supervise(job, state, { llm, work, dir, hasRepo, say });
    else summary = await builtinAgent(job, state, { llm, work, hasRepo, say });
    if (state.cancelled) throw new Error('cancelled');

    const out = { ok: true, summary, harness: job.harness || 'builtin' };
    if (hasRepo) {
      const moved = startHead && (await exec('git', ['rev-list', '--count', `${startHead}..HEAD`], { cwd: work })).out.trim() !== '0';
      if (moved) { await exec('git', ['reset', '--soft', startHead], { cwd: work }); say('The harness made its own commits: folding them into one Loopmates commit.'); }
      const st = await exec('git', ['status', '--porcelain'], { cwd: work });
      if (st.out.trim()) {
        const branch = `loop/${job.jobId.replace(/[^\w-]/g, '').slice(0, 24)}`;
        const g = (args) => exec('git', ['-c', `user.name=${env('GIT_AUTHOR_NAME', 'Loopmates')}`, '-c', `user.email=${env('GIT_AUTHOR_EMAIL', 'loopmates@users.noreply.github.com')}`, ...args], { cwd: work });
        await g(['checkout', '-b', branch]); await g(['add', '-A']);
        const c = await g(['commit', '-m', `Loopmates: ${job.goal.split('\n')[0].slice(0, 70)}`]);
        if (c.code !== 0) throw new Error(`git commit failed: ${cap(c.out, 300)}`);
        if (tok) {
          const p = await exec('git', [...authArgs(job), 'push', 'origin', branch], { cwd: work, timeoutMs: 150_000 });
          if (p.code !== 0) throw new Error(`git push failed: ${cap(scrub(p.out), 300)}`);
          out.branch = branch;
          const [, owner, name] = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(job.repo);
          const base = (await exec('git', ['rev-parse', '--abbrev-ref', 'origin/HEAD'], { cwd: work })).out.trim().replace('origin/', '') || 'main';
          const pr = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'user-agent': 'loopmates', accept: 'application/vnd.github+json' }, body: JSON.stringify({ title: `Loopmates: ${job.goal.split('\n')[0].slice(0, 70)}`, head: branch, base, body: summary.slice(0, 3000) }), signal: AbortSignal.timeout(20_000) });
          if (pr.ok) out.prUrl = (await pr.json()).html_url; else out.summary += `\n(PR not opened: GitHub ${pr.status}. Branch ${branch} is pushed.)`;
        } else out.summary += '\n(GitHub is not connected: changes were committed locally but not pushed, so they are lost when the workspace is cleaned. Add a token in Connections → GitHub.)';
      } else out.summary += '\n(No file changes.)';
    } else { // no repo: hand small deliverables back so they can be stored as files
      const files = [];
      const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) await walk(p); else if (files.length < 5 && (await stat(p)).size <= 200_000) files.push({ name: relative(join(work, 'out'), p).split(sep).join('/'), b64: (await readFile(p)).toString('base64') }); } };
      await walk(join(work, 'out')).catch(() => {});
      if (files.length) out.files = files;
    }
    report({ done: out });
  } catch (e) {
    report({ done: { ok: false, summary: scrub(String(e.message)).slice(0, 600) } });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** The in-process coder. `llm(req)` answers chat requests; `onEvent(runId, body)` receives {logs} and {done}. */
export function createCoder({ llm, onEvent }) {
  let current = null; // { jobId, state }
  return {
    start(job) {
      if (!job.jobId || !job.runId || !job.uid || !job.goal) throw new Error('jobId, runId, uid, goal required');
      if (job.harness && !HARNESS_NAMES[job.harness]) throw new Error(`Unknown coding harness: ${job.harness}`);
      if (current) throw Object.assign(new Error(`The coder is busy with another job (${current.jobId}).`), { statusCode: 429 });
      const state = { cancelled: false };
      current = { jobId: job.jobId, state };
      void runJob(job, state, { llm, onEvent }).finally(() => { current = null; });
    },
    cancel(jobId) { if (current?.jobId === jobId) current.state.cancelled = true; },
    current: () => current?.jobId ?? null,
  };
}

export const gitAvailable = async () => (await exec('git', ['--version'], { timeoutMs: 10_000 })).code === 0;
