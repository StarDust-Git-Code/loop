import { env } from '../lib/env.js';
import { auth } from './db.js';

const allow = () => env('ALLOWED_EMAILS').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

/** Fastify preHandler: Firebase ID token in `Authorization: Bearer`. Sets req.user. */
export async function requireUser(req, reply) {
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tok) return reply.code(401).send({ error: 'Sign in required' });
  let d;
  try { d = await auth.verifyIdToken(tok); } catch { return reply.code(401).send({ error: 'Session expired. Sign in again.' }); }
  const list = allow();
  const email = (d.email || '').toLowerCase();
  if (list.length && !(d.email_verified !== false && list.includes(email))) return reply.code(403).send({ error: 'This account is not on the allow-list.' });
  req.user = { uid: d.uid, email: d.email || '', name: d.name || d.email || '' };
}
