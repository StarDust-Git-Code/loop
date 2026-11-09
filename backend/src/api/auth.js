import { env } from '../lib/env.js';
import { auth } from './db.js';

const allow = () => env('ALLOWED_EMAILS').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

/** True when a decoded Firebase token belongs to an allowed account (no list = anyone signed in). */
export function isAllowed(d) {
  const list = allow();
  return !list.length || (d.email_verified !== false && list.includes((d.email || '').toLowerCase()));
}

/** Fastify preHandler: Firebase ID token in `Authorization: Bearer`. Sets req.user. */
export async function requireUser(req, reply) {
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tok) return reply.code(401).send({ error: 'Sign in required' });
  let d;
  try { d = await auth.verifyIdToken(tok); } catch { return reply.code(401).send({ error: 'Session expired. Sign in again.' }); }
  if (!isAllowed(d)) return reply.code(403).send({ error: 'This account is not on the allow-list.' });
  req.user = { uid: d.uid, email: d.email || '', name: d.name || d.email || '' };
}

/** preHandler after requireUser: only the paired owner (or, before pairing, anyone on the allow-list). */
export async function requireOwner(req, reply) {
  const owner = env('OWNER_UID');
  if (owner && req.user?.uid !== owner) return reply.code(403).send({ error: 'Only the owner of this Loopmates server can do that.' });
}
