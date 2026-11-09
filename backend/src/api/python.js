// python_run: agents (Data, Code, Byte, and anyone given "Code Interpreter") run a short Python script.
// Every run gets a throwaway folder under the data folder; input files are written there, new or changed files come back.
//   Docker (when installed, like the coder): python image, only that folder mounted, no network unless asked,
//     1 GB RAM, 1 CPU, 128 processes, no new privileges.
//   No Docker: a child process in that folder with a scrubbed environment (no Loopmates secrets, HOME = the folder).
//     It CAN reach the network and read files your user can read, so it needs approval like every risky tool.
// PY_IMAGE picks the Docker image (default python:3.12-slim; build docker/python.Dockerfile for pandas, numpy, matplotlib).
import { mkdir, writeFile, readdir, readFile, stat, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '../lib/env.js';
import { dir as dataSub } from '../lib/paths.js';
import { exec, useDocker } from '../coder/index.js';

const bad = (m) => Object.assign(new Error(m), { tool: true });
const cap = (s, n) => (s.length > n ? `${s.slice(0, n)}\n…[truncated ${s.length - n} chars]` : s);
const MAX_FILE = 200_000, MAX_BACK = 20_000;
let hostPython = null;
async function pythonBin() {
  if (hostPython !== null) return hostPython;
  for (const p of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) if ((await exec(p, ['--version'], { timeoutMs: 10_000 })).code === 0) return (hostPython = p);
  return (hostPython = '');
}

/** Run one script. Returns { code, out, files: [{ name, size, text? }], sandbox }. */
export async function runPython({ code, files = {}, timeoutSec = 60, network = false, settings = {} }) {
  const script = String(code ?? ''); if (!script.trim()) throw bad('code is required');
  if (script.length > 100_000) throw bad('The script is too long (100 KB max)');
  const work = join(dataSub('py'), `${Date.now()}-${randomBytes(4).toString('hex')}`); await mkdir(work, { recursive: true });
  const before = new Map();
  try {
    for (const [name, content] of Object.entries(files ?? {}).slice(0, 20)) {
      const safe = String(name).replace(/\\/g, '/'); const full = resolve(work, safe);
      if (!full.startsWith(work + sep) || safe.split('/').some((p) => p === '..' || p.startsWith('.'))) throw bad(`Bad file name: ${name}`);
      const text = String(content ?? ''); if (text.length > MAX_FILE) throw bad(`${name} is too big (200 KB max)`);
      await mkdir(resolve(full, '..'), { recursive: true }); await writeFile(full, text, 'utf8'); before.set(safe, text.length);
    }
    await writeFile(join(work, 'main.py'), script, 'utf8');
    const ms = Math.min(Math.max(Number(timeoutSec) || 60, 5), 300) * 1000;
    const net = network && settings.allowNetwork !== false;
    let r, sandbox;
    if (await useDocker().catch(() => false)) {
      sandbox = `docker (${env('PY_IMAGE', 'python:3.12-slim')}${net ? ', network on' : ', no network'})`;
      r = await exec('docker', ['run', '--rm', '-m', '1g', '--cpus', '1', '--pids-limit', '128', '--security-opt', 'no-new-privileges', ...(net ? [] : ['--network', 'none']), '-v', `${work}:/w`, '-w', '/w', '-e', 'HOME=/tmp', '-e', 'PYTHONUNBUFFERED=1', '-e', 'MPLBACKEND=Agg', env('PY_IMAGE', 'python:3.12-slim'), 'python', 'main.py'], { timeoutMs: ms });
    } else {
      const py = await pythonBin(); if (!py) throw bad('Python is not installed on the server computer, and Docker is not running. Install Python 3 (python.org) or Docker Desktop.');
      sandbox = 'this computer (restricted process, no Loopmates secrets)';
      r = await exec(py, ['main.py'], { cwd: work, timeoutMs: ms, extraEnv: { PYTHONUNBUFFERED: '1', MPLBACKEND: 'Agg', PYTHONNOUSERSITE: '1' } });
    }
    const out = []; let budget = MAX_BACK;
    const walk = async (d, rel = '') => {
      for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
        const r2 = rel ? `${rel}/${e.name}` : e.name; if (r2 === 'main.py' || e.name.startsWith('.') || e.name === '__pycache__') continue;
        if (e.isDirectory()) { await walk(join(d, e.name), r2); continue; }
        const st = await stat(join(d, e.name)); if (before.get(r2) === st.size) continue; // unchanged input
        const item = { name: r2, size: st.size };
        if (st.size <= 8000 && budget > 0 && /\.(txt|csv|json|md|tsv|html|xml|log|py)$/i.test(e.name)) { item.text = (await readFile(join(d, e.name), 'utf8')).slice(0, budget); budget -= item.text.length; }
        if (out.length < 30) out.push(item);
      }
    };
    await walk(work);
    return { code: r.code, out: cap(r.out, 12_000), files: out, sandbox };
  } finally { await rm(work, { recursive: true, force: true }).catch(() => {}); }
}

export const PYTHON_TOOLS = {
  python_run: { group: 'Code Interpreter', write: true, needsApproval: true, desc: 'Run a short Python 3 script and get its printed output and any files it writes. Use it for exact calculations, data cleaning, statistics, parsing a CSV or JSON, quick charts (save to a .png), or checking an idea in code. Print what you need: only stdout/stderr and new files come back. Each run starts fresh in an empty folder; pass input data in "files". Standard library always; pandas/numpy/matplotlib only if the server has them. No network unless network is true.', args: '{"code": "python source", "files?": {"data.csv": "file content"}, "timeoutSec?": 60, "network?": false}', run: async (c, a) => {
    let files = a.files; if (typeof files === 'string') { try { files = JSON.parse(files); } catch { throw bad('files must be an object of name → text content'); } }
    const r = await runPython({ code: a.code, files, timeoutSec: a.timeoutSec, network: a.network === true || a.network === 'true', settings: c.settings ?? {} });
    const fl = r.files.map((f) => `- ${f.name} (${f.size} bytes)${f.text !== undefined ? `\n\`\`\`\n${f.text}\n\`\`\`` : ''}`).join('\n');
    return `Exit code ${r.code} · ran in ${r.sandbox}\n\nOutput:\n${r.out.trim() || '(nothing printed)'}${fl ? `\n\nFiles written:\n${fl}` : ''}`;
  } },
};
