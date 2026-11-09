// GitHub access for the coder and the connection test. One fine-grained token, sealed on the owner's GitHub
// connection (config.token), with GITHUB_TOKEN from the server settings as the fallback.
import { env } from '../lib/env.js';
import { open } from '../lib/crypto.js';
import { userCol } from './db.js';

/** The owner's GitHub token, or '' when none is linked. */
export async function githubTokenFor(uid) {
  try {
    const snap = await userCol(uid, 'connections').where('provider', '==', 'github').get();
    for (const d of snap.docs) {
      const blob = d.data().secretsEnc?.token;
      if (blob) return open(blob, `${uid}|connection|${d.id}|token`);
    }
  } catch { /* fall back to the server-wide token */ }
  return env('GITHUB_TOKEN');
}

/** Check a token: who it belongs to and which of the allowed repos it can push to. */
export async function testGithub(token, repos = []) {
  if (!token) return { ok: false, error: 'No token. Paste a fine-grained token first.' };
  const h = { authorization: `Bearer ${token}`, 'user-agent': 'loopmates', accept: 'application/vnd.github+json' };
  const me = await fetch('https://api.github.com/user', { headers: h, signal: AbortSignal.timeout(15_000) });
  if (!me.ok) return { ok: false, error: me.status === 401 ? 'GitHub refused the token (expired or mistyped).' : `GitHub answered ${me.status}.` };
  const login = (await me.json()).login;
  const checks = await Promise.all(repos.slice(0, 10).map(async (r) => {
    const res = await fetch(`https://api.github.com/repos/${r}`, { headers: h, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return `${r}: not reachable (${res.status})`;
    const j = await res.json();
    return `${r}: ${j.permissions?.push ? 'can push' : 'read only (give the token Contents: write)'}`;
  }));
  return { ok: true, login, repos: checks };
}
