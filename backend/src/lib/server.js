import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env, num } from './env.js';
import { verifyHeader } from './svc.js';

/** Common fastify setup. `name` shows up in /healthz so we can tell the three services apart. */
export async function createServer(name, { bodyLimit = 2 * 1024 * 1024 } = {}) {
  const app = Fastify({ logger: { level: env('LOG_LEVEL', 'info'), redact: ['req.headers.authorization', 'req.headers["x-svc"]'] }, bodyLimit, trustProxy: true });
  const origins = env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: origins.length ? origins : false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type'],
    maxAge: 86400,
  });
  app.get('/healthz', async () => ({ ok: true, service: name, commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7), uptime: Math.round(process.uptime()), mem: Math.round(process.memoryUsage().rss / 1048576) }));
  app.get('/', async () => ({ service: name, ok: true }));
  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) req.log.error(err);
    reply.code(status).send({ error: status >= 500 ? 'Internal error' : err.message, detail: status >= 500 && env('NODE_ENV') !== 'production' ? err.message : undefined });
  });
  return app;
}

/** preHandler: only another Loopmates service may call. */
export function svcOnly(req, reply, done) {
  const path = req.url.split('?')[0];
  if (!verifyHeader(req.headers['x-svc'], req.method, path)) { reply.code(401).send({ error: 'service auth failed' }); return; }
  done();
}

export async function listen(app) {
  const port = num('PORT', 10000);
  await app.listen({ port, host: env('HOST') || '0.0.0.0' });
  const shutdown = async (sig) => { app.log.info(`${sig}: shutting down`); try { await app.close(); } finally { process.exit(0); } };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));
