// External coding harnesses: Claude Code, Codex and OpenCode, run headless in a job workspace and supervised by the
// coder (coder/index.js). Each one signs in with the owner's own account on this computer, so it runs either:
//   host:   in the per-job workspace, with the harness's own safe mode and a scrubbed environment (no Loopmates secrets)
//   docker: in the `loopmates-harness` image, with only the workspace and a per-job COPY of the harness's login mounted
// Flags were checked against codex-cli 0.166 and opencode 2.1.4; Claude Code flags follow its documented print mode.
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';

const WIN = process.platform === 'win32';
export const HARNESS_KEYS = ['builtin', 'claude', 'codex', 'opencode'];
export const HARNESS_NAMES = { builtin: 'Built-in coder', claude: 'Claude Code', codex: 'Codex', opencode: 'OpenCode' };
export const IMAGE = 'loopmates-harness';
const INSTALL = { claude: 'npm install -g @anthropic-ai/claude-code, then run `claude` once to sign in', codex: 'npm install -g @openai/codex, then run `codex login`', opencode: 'npm install -g opencode-ai, then run `opencode auth login`' };
const AUTH_DIRS = { claude: ['.claude', '.claude.json'], codex: ['.codex'], opencode: [join('.local', 'share', 'opencode'), join('.config', 'opencode')] };
const ENV_PREFIX = { claude: ['ANTHROPIC_', 'CLAUDE_'], codex: ['OPENAI_', 'CODEX_'], opencode: ['OPENCODE_'] };
const cap = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);

/* ---------- finding the program (Windows npm shims are .cmd files: run the script they point at, no shell) ---------- */
const binCache = new Map();
export async function resolveBin(name) {
  if (binCache.has(name)) return binCache.get(name);
  let out = null;
  const dirs = String(process.env.PATH ?? '').split(delimiter).filter(Boolean);
  if (WIN) {
    for (const d of dirs) {
      const exe = join(d, `${name}.exe`); if (existsSync(exe)) { out = { file: exe, pre: [] }; break; }
      const cmd = join(d, `${name}.cmd`); if (!existsSync(cmd)) continue;
      const text = await readFile(cmd, 'utf8').catch(() => '');
      const m = [...text.matchAll(/"%dp0%\\([^"]+\.(js|exe|cjs|mjs))"/gi)].at(-1);
      if (m) { const target = join(d, m[1]); out = /\.exe$/i.test(target) ? { file: target, pre: [] } : { file: process.execPath, pre: [target] }; break; }
    }
  } else {
    for (const d of dirs) { const p = join(d, name); try { if ((await stat(p)).isFile()) { out = { file: p, pre: [] }; break; } } catch { /* next */ } }
  }
  binCache.set(name, out);
  return out;
}

function run(file, args, { cwd, env, timeoutMs = 60_000, onLine, signal } = {}) {
  return new Promise((done) => {
    const child = spawn(file, args, { cwd, env, windowsHide: true, detached: !WIN, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '', buf = '';
    const kill = () => { try { if (WIN) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }); else process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } };
    const timer = setTimeout(() => { kill(); err += '\n[killed: timeout]'; }, timeoutMs);
    const onAbort = () => { kill(); err += '\n[cancelled]'; };
    signal?.addEventListener?.('abort', onAbort, { once: true });
    child.stdout.on('data', (d) => {
      const s = d.toString(); if (out.length < 2_000_000) out += s;
      if (!onLine) return; buf += s; let i;
      while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) { try { onLine(line); } catch { /* ignore */ } } }
    });
    child.stderr.on('data', (d) => { if (err.length < 200_000) err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); done({ code: 127, out, err: `${err}${e.message}` }); });
    child.on('close', (code) => { clearTimeout(timer); signal?.removeEventListener?.('abort', onAbort); if (onLine && buf.trim()) { try { onLine(buf.trim()); } catch { /* ignore */ } } done({ code, out, err }); });
  });
}

/* ---------- detection, for the Server page and connections_status ---------- */
let detected = null;
export async function detectHarnesses({ fresh = false } = {}) {
  if (detected && !fresh && Date.now() - detected.at < 10 * 60_000) return detected.r;
  const r = { builtin: { ok: true, version: 'built in' } };
  await Promise.all(['claude', 'codex', 'opencode'].map(async (k) => {
    const bin = await resolveBin(k);
    if (!bin) { r[k] = { ok: false, install: INSTALL[k] }; return; }
    const v = await run(bin.file, [...bin.pre, '--version'], { timeoutMs: 20_000, env: process.env });
    r[k] = v.code === 0 ? { ok: true, version: (v.out || v.err).trim().split('\n')[0].slice(0, 60) } : { ok: false, install: INSTALL[k], error: cap((v.err || v.out).trim(), 160) };
  }));
  r.docker = await dockerImage();
  detected = { at: Date.now(), r };
  return r;
}
async function dockerImage() {
  const d = await run('docker', ['image', 'inspect', IMAGE, '--format', '{{.Id}}'], { timeoutMs: 15_000, env: process.env });
  if (d.code === 0) return { ok: true, image: IMAGE };
  const v = await run('docker', ['version', '--format', '{{.Server.Version}}'], { timeoutMs: 15_000, env: process.env });
  return v.code === 0 ? { ok: false, error: `Docker is running but the ${IMAGE} image is not built yet: docker build -t ${IMAGE} -f docker/harness.Dockerfile .` } : { ok: false, error: 'Docker is not installed or not running.' };
}

/* ---------- adapters ---------- */
const CLAUDE_TOOLS = 'Read,Edit,Write,MultiEdit,Glob,Grep,LS,TodoWrite,Bash(npm test:*),Bash(npm run:*),Bash(npx tsc:*),Bash(node:*),Bash(python:*),Bash(python3:*),Bash(pytest:*),Bash(go test:*),Bash(cargo test:*),Bash(ls:*),Bash(cat:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*)';
export const ADAPTERS = {
  claude: {
    args: ({ prompt, resume, maxTurns = 40, model }) => ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--allowedTools', CLAUDE_TOOLS, '--max-turns', String(maxTurns), ...(resume ? ['--resume', resume] : []), ...(model ? ['--model', model] : [])],
    parse(o, st) {
      if (o.session_id) st.session = o.session_id;
      if (o.type === 'assistant') for (const c of o.message?.content ?? []) {
        if (c.type === 'text' && c.text?.trim()) st.say(cap(c.text.trim(), 300));
        if (c.type === 'tool_use') st.say(`${c.name} ${c.input?.file_path ?? c.input?.path ?? c.input?.command ?? c.input?.pattern ?? ''}`.trim());
      }
      if (o.type === 'result') { st.final = String(o.result ?? ''); if (o.is_error || o.subtype !== 'success') st.error = `${o.subtype ?? 'error'}: ${cap(String(o.result ?? ''), 300)}`; }
    },
  },
  codex: {
    args: ({ prompt, resume, model, cwd }) => ['exec', ...(resume ? ['resume', resume] : []), '--json', '--skip-git-repo-check', ...(resume ? ['-c', 'sandbox_mode="workspace-write"'] : ['--sandbox', 'workspace-write', '-C', cwd]), ...(model ? ['-m', model] : []), prompt],
    parse(o, st) {
      if (o.thread_id) st.session = o.thread_id; if (o.session_id) st.session = o.session_id;
      const it = o.item;
      if (it && o.type === 'item.completed') {
        if (it.type === 'agent_message' && it.text) { st.final = it.text; st.say(cap(it.text, 300)); }
        else if (it.type === 'command_execution') st.say(`run ${cap(String(it.command ?? ''), 160)}${it.exit_code != null ? ` (exit ${it.exit_code})` : ''}`);
        else if (it.type === 'file_change') st.say(`edit ${(it.changes ?? []).map((c) => c.path).join(', ').slice(0, 200)}`);
        else if (it.type === 'error') st.say(`error: ${cap(String(it.message ?? ''), 200)}`);
      }
      if (o.type === 'turn.failed' || o.type === 'error') st.error = cap(String(o.error?.message ?? o.message ?? 'Codex failed'), 300);
    },
  },
  opencode: {
    args: ({ prompt, resume, model }) => ['run', '--standalone', '--format', 'json', '--auto', ...(resume ? ['--continue'] : []), ...(model ? ['-m', model] : []), prompt],
    parse(o, st) {
      const sid = o.sessionID ?? o.session_id ?? o.part?.sessionID; if (sid) st.session = sid;
      const p = o.part ?? o; const type = String(o.type ?? p.type ?? '');
      if (/tool/.test(type)) st.say(`${p.tool ?? p.name ?? 'tool'} ${p.state?.input?.filePath ?? p.state?.input?.command ?? p.input?.filePath ?? ''}`.trim());
      else if (/text/.test(type) && (p.text ?? o.text)) { st.final = String(p.text ?? o.text); st.say(cap(st.final, 300)); }
      else if (/error/.test(type)) st.error = cap(String(o.error?.message ?? o.message ?? p.error ?? 'OpenCode failed'), 300);
    },
  },
};

/** Only what the harness needs: PATH, home folders (for its login), temp, locale, and its own variables. */
export function harnessEnv(name, home = homedir()) {
  const keep = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'PATHEXT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'SHELL', 'TERM', 'USER', 'USERNAME', 'LOGNAME', 'HOMEDRIVE', 'HOMEPATH', 'ProgramData', 'ProgramFiles', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS'];
  const env = { HOME: home, USERPROFILE: home, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0', GIT_TERMINAL_PROMPT: '0' };
  for (const k of keep) if (process.env[k] != null) env[k] = process.env[k];
  for (const [k, v] of Object.entries(process.env)) if ((ENV_PREFIX[name] ?? []).some((p) => k.startsWith(p))) env[k] = v;
  return env;
}

/**
 * Run one round. Returns { code, final, session, error, log[] }.
 * opts: { cwd, prompt, resume, model, maxTurns, timeoutMs, sandbox: 'host'|'docker', jobDir, signal, onLog }
 */
export async function runHarness(name, opts) {
  const a = ADAPTERS[name]; if (!a) throw new Error(`Unknown coding harness: ${name}`);
  const st = { session: opts.resume || '', final: '', error: '', log: [], say: (t) => { st.log.push(t); opts.onLog?.(t); } };
  const onLine = (line) => { let o; try { o = JSON.parse(line); } catch { if (!/^\s*$/.test(line)) st.say(cap(line, 200)); return; } a.parse(o, st); };
  let r;
  if (opts.sandbox === 'docker') {
    const auth = `${opts.jobDir}-auth`; await mkdir(auth, { recursive: true }); // outside the workspace; removed after the job
    for (const p of AUTH_DIRS[name] ?? []) { const src = join(homedir(), p); if (existsSync(src)) await cp(src, join(auth, p), { recursive: true }).catch(() => {}); }
    const envArgs = Object.keys(harnessEnv(name)).filter((k) => (ENV_PREFIX[name] ?? []).some((p) => k.startsWith(p))).flatMap((k) => ['-e', k]);
    const args = a.args({ ...opts, cwd: '/w' });
    r = await run('docker', ['run', '--rm', '-m', '2g', '--cpus', '2', '--pids-limit', '512', '--security-opt', 'no-new-privileges', '-v', `${opts.cwd}:/w`, '-v', `${auth}:/home/coder`, '-e', 'HOME=/home/coder', ...envArgs, '-w', '/w', IMAGE, name, ...args], { env: harnessEnv(name), timeoutMs: opts.timeoutMs, onLine, signal: opts.signal });
  } else {
    const bin = await resolveBin(name); if (!bin) throw new Error(`${HARNESS_NAMES[name]} is not installed on this computer. ${INSTALL[name]}.`);
    r = await run(bin.file, [...bin.pre, ...a.args(opts)], { cwd: opts.cwd, env: harnessEnv(name), timeoutMs: opts.timeoutMs, onLine, signal: opts.signal });
  }
  if (r.code !== 0 && !st.error) st.error = cap((r.err || '').trim().split('\n').slice(-4).join(' ') || `exit ${r.code}`, 400);
  return { code: r.code, final: st.final, session: st.session, error: st.error, log: st.log };
}

