import multipart from '@fastify/multipart';
import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { env, need, now, uid as rid } from '../lib/env.js';
import { svcJson } from '../lib/svc.js';
import { createServer, svcOnly, listen } from '../lib/server.js';
import { requireUser } from './auth.js';
import { userCol } from './db.js';
import { registerCrud, COLLECTIONS, sealOut } from './crud.js';
import { chat, fetchModels } from './llm.js';
import { converse } from './agent.js';
import { MATE } from './mates.js';
import { setToolHooks } from './tools.js';
import { getSettings, patchSettings } from './settings.js';
import { startRun, control, steer, decide, subscribe, jobEvent, recoverRuns, activeCount, liveRuns } from './engine.js';
import { captureConsole } from '../lib/console.js';
import { hooks as schedHooks, startScheduler, tick } from './sched.js';
import { indexKnowledge, searchKnowledge } from './knowledge.js';
import { verifyMcp } from './mcp.js';
import { putFile, getFileStream, deleteDriveFile } from './files.js';
import { telegramReady, send as tgSend, linkCode, handleUpdate, setWebhook } from './telegram.js';
import { startWhatsApp, waStatus, waChats, waRecent, resumeWhatsApp } from './whatsapp.js';
import { open } from '../lib/crypto.js';

captureConsole();
for (const k of ['SERVICE_SECRET', 'MASTER_KEY']) need(k);
if (env('MEMORY_DB') !== '1' || env('NODE_ENV') === 'production') need('FIREBASE_SERVICE_ACCOUNT_B64');

setToolHooks({ events: schedHooks.events, tasks: schedHooks.tasks, control, liveRuns });
const app = await createServer('api', { bodyLimit: 4 * 1024 * 1024 });
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const originOk = (o) => !!o && env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).includes(o);

/* ---------- public-ish (own auth) ---------- */
app.post('/telegram/webhook/:secret', async (req, reply) => {
  if (!env('TELEGRAM_WEBHOOK_SECRET') || !same(req.params.secret, env('TELEGRAM_WEBHOOK_SECRET'))) return reply.code(404).send();
  handleUpdate(req.body).catch((e) => req.log.error(e)); // answer Telegram fast, work in the background
  return { ok: true };
});

const cronAuth = (req) => env('CRON_SECRET') && same(req.headers['x-cron-secret'] ?? req.query?.key ?? '', env('CRON_SECRET'));
const tickRoute = async (req, reply) => (cronAuth(req) ? { ...(await tick()), active: activeCount() } : reply.code(401).send({ error: 'bad cron secret' }));
app.get('/internal/tick', tickRoute);
app.post('/internal/tick', tickRoute);

/* ---------- service-to-service ---------- */
app.post('/internal/llm', { preHandler: svcOnly }, async (req) => {
  const { uid, model, messages, temperature, maxTokens, json } = req.body ?? {};
  if (!uid || !Array.isArray(messages)) throw Object.assign(new Error('uid and messages required'), { statusCode: 400 });
  return chat(uid, { model, messages, temperature, maxTokens, json });
});
app.post('/internal/runs/:id/events', { preHandler: svcOnly }, async (req) => ({ ok: jobEvent(req.params.id, req.body ?? {}) }));

/* ---------- user API ---------- */
await app.register(async (v1) => {
  v1.addHook('preHandler', requireUser);
  await v1.register(multipart, { limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

  v1.get('/v1/auth/session', async (req) => ({ signedIn: true, name: req.user.name, email: req.user.email, plan: 'Free' }));
  v1.post('/v1/auth/sign-out', async (req, reply) => reply.code(204).send());

  v1.get('/v1/settings', async (req) => getSettings(req.user.uid));
  v1.patch('/v1/settings', async (req) => patchSettings(req.user.uid, req.body ?? {}));

  /* runs */
  v1.post('/v1/runs', async (req, reply) => reply.code(201).send(await startRun(req.user.uid, req.body ?? {})));
  for (const a of ['stop', 'pause', 'resume']) v1.post(`/v1/runs/:id/${a}`, async (req) => control(req.user.uid, req.params.id, a));
  v1.post('/v1/runs/:id/steer', async (req) => steer(req.user.uid, req.params.id, req.body?.text ?? ''));
  v1.post('/v1/runs/:id/approvals/:aid', async (req) => decide(req.user.uid, req.params.id, req.params.aid, req.body?.decision));
  v1.get('/v1/runs/:id/events', async (req, reply) => {
    const { uid } = req.user; const origin = req.headers.origin;
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no', ...(originOk(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}) });
    const write = (e) => raw.write(`data: ${JSON.stringify(e)}\n\n`);
    const off = subscribe(uid, req.params.id, write);
    if (!off) { // finished or unknown: report the stored status once and close
      const d = (await userCol(uid, 'runs').doc(req.params.id).get()).data();
      if (d) write({ type: 'status', status: d.status });
      return raw.end();
    }
    const beat = setInterval(() => raw.write(': ping\n\n'), 20_000);
    req.raw.on('close', () => { clearInterval(beat); off(); });
  });

  /* conversations. ?stream=1 answers as Server-Sent Events (delta / tool / done); otherwise the reply is generated first. */
  v1.post('/v1/conversations/:id/messages', async (req, reply) => {
    const { uid } = req.user; const text = String(req.body?.text ?? '').trim().slice(0, 8000);
    if (!text) return reply.code(400).send({ error: 'text is required' });
    const ref = userCol(uid, 'conversations').doc(req.params.id);
    const conv = (await ref.get()).data();
    if (!conv) return reply.code(404).send({ error: 'Not found' });
    const home = req.body?.mate || conv.mate || 'mimo';
    const userMsg = { id: rid(), role: 'user', text, at: now(), state: 'sent' };
    const messages = [...(conv.messages ?? []), userMsg];
    const cfgs = Object.fromEntries((await userCol(uid, 'mates').get()).docs.map((d) => [d.id, d.data()]));
    const settings = await getSettings(uid);
    // @mentions: every mentioned Mate answers in turn; with none, the chat's own Mate answers.
    const asked = [...new Set([...text.matchAll(/(?:^|\s)@([a-z]+)/gi)].map((m) => m[1].toLowerCase()))].filter((k) => MATE[k]).slice(0, 3);
    const skipped = asked.filter((k) => cfgs[k] ? cfgs[k].enabled === false : !MATE[k].core);
    const mates = asked.filter((k) => !skipped.includes(k));
    const responders = mates.length ? mates : (asked.length ? [] : [home]);
    const members = [...new Set([...(conv.members ?? []), ...mates])];
    const nameOf = (k) => MATE[k]?.name ?? k;
    const HIST_CHARS = 28_000; // about 7k tokens of history; older turns stay reachable through the chat_history tool
    const historyFor = (me) => {
      const all = messages.filter((m) => m.role !== 'system' && m.state !== 'error').map((m) => (m.role === 'user' ? { role: 'user', content: m.text } : (m.mate ?? home) === me ? { role: 'assistant', content: m.text } : { role: 'user', content: `[${nameOf(m.mate ?? home)}]: ${m.text}` }));
      let used = 0, from = all.length;
      while (from > 0 && used + all[from - 1].content.length <= HIST_CHARS) used += all[--from].content.length;
      if (from === all.length && all.length) from = all.length - 1; // always keep the newest message
      const kept = all.slice(from);
      if (from > 0) { const first = all.find((m) => m.role === 'user')?.content ?? ''; kept.unshift({ role: 'user', content: `[Note: ${from} earlier message(s) are not shown here. The chat began with the owner saying: "${first.slice(0, 300)}". Use the chat_history tool to look further back.]` }); }
      return kept;
    };
    const turn = (mate, emit, signal) => converse({ uid, mateKey: mate, cfg: cfgs[mate] ?? {}, settings, mode: conv.mode ?? 'chat', history: historyFor(mate), emit, signal, ctx: { convId: req.params.id }, others: [...new Set([home, ...members])].filter((k) => k !== mate).map(nameOf) });
    const sysNote = (t) => ({ id: rid(), role: 'system', text: t, at: now(), state: 'sent' });
    const stream = req.query?.stream === '1';
    const save = () => ref.set({ messages, updatedAt: now(), ...(members.length ? { members } : {}) }, { merge: true });
    if (skipped.length) messages.push(sysNote(`${skipped.map(nameOf).join(', ')} ${skipped.length > 1 ? 'are' : 'is'} switched off. Turn on in Agents to use @${skipped[0]}.`));

    if (!stream) {
      for (const mate of responders) {
        try { const r = await turn(mate, () => {}); messages.push({ id: rid(), role: 'mate', mate, text: r.text, at: now(), state: 'sent' }); }
        catch (e) { messages.push({ id: rid(), role: 'system', text: `${nameOf(mate)} could not reply: ${e.message.slice(0, 300)}`, at: now(), state: 'error' }); }
      }
      await save();
      return userMsg;
    }

    await save(); // the question is saved before any answer starts
    const origin = req.headers.origin;
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no', ...(originOk(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}) });
    const write = (e) => { if (!raw.writableEnded) raw.write(`data: ${JSON.stringify(e)}\n\n`); };
    const ac = new AbortController(); let gone = false;
    req.raw.on('close', () => { gone = true; ac.abort(); });
    const beat = setInterval(() => { if (!raw.writableEnded) raw.write(': ping\n\n'); }, 15_000);
    write({ type: 'start', userId: userMsg.id });
    for (const mate of responders) {
      if (gone) break;
      write({ type: 'mate', mate });
      let out;
      try { const r = await turn(mate, write, ac.signal); out = { id: rid(), role: 'mate', mate, text: r.text, at: now(), state: 'sent' }; }
      catch (e) { out = gone ? null : { id: rid(), role: 'system', text: `${nameOf(mate)} could not reply: ${String(e.message).slice(0, 300)}`, at: now(), state: 'error' }; }
      if (out) { messages.push(out); await save().catch(() => {}); write({ type: 'done', message: out }); }
    }
    if (!responders.length) write({ type: 'done', message: messages.at(-1) });
    clearInterval(beat);
    raw.end();
  });

  /* mcp / connections / providers */
  v1.post('/v1/mcp-servers/:id/verify', async (req, reply) => {
    const ref = userCol(req.user.uid, 'mcp').doc(req.params.id); const s = (await ref.get()).data();
    if (!s) return reply.code(404).send({ error: 'Not found' });
    const r = await verifyMcp(s);
    const patch = { status: r.ok ? 'connected' : 'error', tools: r.ok ? r.tools : s.tools ?? [], updatedAt: now() };
    await ref.set(patch, { merge: true });
    return { id: ref.id, ...s, ...patch, ...(r.ok ? {} : { error: r.error }) };
  });

  v1.post('/v1/connections/:id/test', async (req, reply) => {
    const uid = req.user.uid; const ref = userCol(uid, 'connections').doc(req.params.id); const c = (await ref.get()).data();
    if (!c) return reply.code(404).send({ error: 'Not found' });
    let status = 'error', error = '';
    try {
      if (c.provider === 'telegram') {
        if (!telegramReady()) error = 'TELEGRAM_BOT_TOKEN is not set on the API service.';
        else if (!c.config?.chatId) { status = 'pending'; error = 'Not linked yet. Get a code and send /start CODE to the bot.'; }
        else { await tgSend(c.config.chatId, 'Loopmates test ✅'); status = 'connected'; }
      } else if (c.provider === 'whatsapp') {
        const w = waStatus(); status = w.status === 'open' ? 'connected' : 'pending'; error = status === 'pending' ? `Bridge is ${w.status}.` : '';
      } else if (c.provider === 'gdrive') {
        await svcJson(env('ARTIFACTS_URL'), '/v1/health'); status = 'connected';
      } else if (c.provider === 'github') {
        const tok = c.secretsEnc?.token ? open(c.secretsEnc.token, `${uid}|connection|${ref.id}|token`) : '';
        const r = await fetch('https://api.github.com/user', { headers: { authorization: `Bearer ${tok}`, 'user-agent': 'loopmates' }, signal: AbortSignal.timeout(15_000) });
        if (r.ok) status = 'connected'; else error = `GitHub answered ${r.status}`;
      } else { status = 'pending'; error = 'Email delivery is not available yet.'; }
    } catch (e) { error = e.message.slice(0, 200); }
    await ref.set({ status, updatedAt: now() }, { merge: true });
    return { ...sealOut(COLLECTIONS.connections, { id: ref.id, ...c, status }), ...(error ? { error } : {}) };
  });
  v1.get('/v1/connections/:id/chats', async () => waChats().map((c) => ({ id: c.id, name: c.name, meta: c.meta })));

  v1.post('/v1/providers/:id/fetch-models', async (req, reply) => {
    const uid = req.user.uid; const ref = userCol(uid, 'providers').doc(req.params.id); const p = (await ref.get()).data();
    if (!p) return reply.code(404).send({ error: 'Not found' });
    if (!p.keyEnc) return reply.code(400).send({ error: 'Save an API key on this provider first.' });
    const models = await fetchModels(uid, { id: ref.id, ...p });
    await ref.set({ models, fetchedAt: now(), updatedAt: now() }, { merge: true });
    return models;
  });

  /* files + knowledge */
  v1.post('/v1/files', async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'file is required' });
    const buf = await part.toBuffer();
    if (part.file.truncated) return reply.code(413).send({ error: 'File is larger than 15 MB' });
    return reply.code(201).send(await putFile(req.user.uid, { name: part.filename || 'upload', mime: part.mimetype, buf, source: 'upload' }));
  });
  v1.get('/v1/files/:id/content', async (req, reply) => {
    const { file, body } = await getFileStream(req.user.uid, req.params.id);
    reply.header('content-type', file.mime || 'application/octet-stream').header('content-disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    return reply.send(Readable.fromWeb(body));
  });
  v1.get('/v1/knowledge/search', async (req) => searchKnowledge(req.user.uid, String(req.query.q ?? '')));

  /* telegram + whatsapp */
  v1.post('/v1/telegram/link-code', async (req) => linkCode(req.user.uid, req.body?.connectionId));
  v1.get('/v1/whatsapp/status', async () => waStatus());
  v1.post('/v1/whatsapp/pair', async (req) => startWhatsApp({ phone: req.body?.phone }));
  v1.get('/v1/whatsapp/recent', async (req) => waRecent(String(req.query.chat ?? '')));

  registerCrud(v1, {
    hooks: {
      ...schedHooks,
      knowledge: async (uid, id, doc, op) => { if (op === 'set' && doc?.status === 'pending') void indexKnowledge(uid, id); },
      files: async (uid, id, doc, op, prev) => { if (op === 'delete') await deleteDriveFile(prev?.driveId); },
    },
  });
});

/* ---------- boot ---------- */
await listen(app);
const recovered = await recoverRuns().catch((e) => { app.log.error(e); return 0; });
if (recovered) app.log.warn(`marked ${recovered} interrupted run(s) as failed`);
startScheduler();
resumeWhatsApp().catch((e) => app.log.warn(`whatsapp: ${e.message}`));
if (telegramReady() && env('PUBLIC_URL') && env('TELEGRAM_WEBHOOK_SECRET')) setWebhook(env('PUBLIC_URL')).then((r) => app.log.info(`telegram webhook: ${r.ok ? 'set' : r.description}`)).catch(() => {});
