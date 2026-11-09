import Fastify from 'fastify';
import cors from '@fastify/cors';
import { execFileSync } from 'node:child_process';
import { env, num } from './env.js';

/** The commit this server runs (shown in /healthz and the status page). */
export const commit = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: new URL('../..', import.meta.url), stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString().trim(); } catch { return ''; } })();

/** Browsers may call from the dashboard origin(s) in ALLOWED_ORIGINS or from localhost. Native apps send no Origin. */
export function originAllowed(origin) {
  if (!origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean).includes(origin);
}

export async function createServer(name, { bodyLimit = 2 * 1024 * 1024 } = {}) {
  const app = Fastify({ logger: { level: env('LOG_LEVEL', 'info'), redact: ['req.headers.authorization', 'req.headers["x-setup-key"]'] }, bodyLimit, trustProxy: true });
  await app.register(cors, {
    origin: (origin, cb) => cb(null, originAllowed(origin)),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type'],
    maxAge: 86400,
  });
  app.get('/healthz', async () => ({ ok: true, service: name, commit, uptime: Math.round(process.uptime()), mem: Math.round(process.memoryUsage().rss / 1048576) }));
  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) req.log.error(err);
    reply.code(status).send({ error: status >= 500 ? 'Internal error' : err.message, detail: status >= 500 && env('NODE_ENV') !== 'production' ? err.message : undefined });
  });
  return app;
}

/** Listen on HOST (default 127.0.0.1: the tunnel reaches the server locally, so nothing on the home network can). */
export async function listen(app) {
  const port = num('PORT', 8787);
  await app.listen({ port, host: env('HOST') || '127.0.0.1' });
  const shutdown = async (sig) => { app.log.info(`${sig}: shutting down`); try { await app.close(); } finally { process.exit(0); } };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));
