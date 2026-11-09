import { learnFromTurn } from './memory.js';
import multipart from '@fastify/multipart';
import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { env, now, uid as rid } from '../lib/env.js';
import { originAllowed } from '../lib/server.js';
import { requireUser, requireOwner } from './auth.js';
import { mountAdmin } from './admin.js';
import { initPush, addDevice, listDevices, removeDevice, vapidPublicKey } from './push.js';
import { answerQuestion, openQuestions, answerFromDiscord } from './ask.js';
import { startPresence } from './pairing.js';
import { userCol } from './db.js';
import { registerCrud, COLLECTIONS, sealOut } from './crud.js';
import { fetchModels } from './llm.js';
import { converse } from './agent.js';
import { loadRoster, invalidateRoster, createAgent, removeAgent, restoreAgent } from './roster.js';
import { runRoundTable, pickParticipants } from './brainstorm.js';
import { setToolHooks } from './tools.js';
import { getSettings, patchSettings } from './settings.js';
import { startRun, retryRun, control, steer, decide, subscribe, recoverRuns, activeCount, liveRuns, runLog } from './engine.js';
import { hooks as schedHooks, startScheduler, tick } from './sched.js';
import { indexKnowledge, searchKnowledge } from './knowledge.js';
import { verifyMcp } from './mcp.js';
import { graphSnapshot, deleteNode, mergeNodes } from './graph.js';
import { watchHook, ensureDefaultWatches, runWatch, briefingHook, sendBriefing, standupHook, runStandup } from './watch.js';
import { importPeople, inviteCode, sendCheckin, overview, setCompanySender } from './company.js';
import { putFile, getFileStream, deleteDriveFile } from './files.js';
import { telegramReady, send as tgSend, linkCode, startPolling } from './telegram.js';
import { notify as anyNotify } from './notify.js';
import { discordReady, verifySignature, handleInteraction, handleLinked, linkCode as discordLinkCode, registerCommands, sendChannel, startGateway } from './discord.js';
import { createCall, getCall, listCalls } from './calls.js';
import { startWhatsApp, waStatus, waChats, waRecent, resumeWhatsApp } from './whatsapp.js';
import { open } from '../lib/crypto.js';
import { health as driveHealth, driveReady } from '../drive/index.js';
import { testGithub } from './github.js';
import { mountIntegrations, mountIntegrationsPublic, bootIntegrations } from '../integrations/index.js';

setToolHooks({
  events: schedHooks.events, tasks: schedHooks.tasks, control, liveRuns, startRun, steer, notify: anyNotify, runLog,
  // ask_mate: one focused, read-only, tool-less answer from another Mate.
  ask: async (uid, mateKey, question) => {
    const ro = await loadRoster(uid); const cfgs = ro.cfgs;
    if (!ro.has(mateKey)) throw Object.assign(new Error(`No agent called "${mateKey}"`), { tool: true });
    if (!ro.on(mateKey)) throw Object.assign(new Error(`${ro.name(mateKey)} is switched off`), { tool: true });
    const r = await converse({ uid, mateKey, cfg: cfgs[mateKey] ?? {}, settings: await getSettings(uid), mode: 'chat', history: [{ role: 'user', content: question }], emit: () => {}, maxTokens: 700, readOnly: true, noTools: true, ctx: { depth: 1 } });
    return `${ro.name(mateKey)} says:\n${r.text}`;
  },
});
/** Mount the REST API, SSE and bot endpoints on the main server. */
export async function mountApi(app) {
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const originOk = (o) => !!o && originAllowed(o);

/* ---------- public-ish (own auth) ---------- */
// Discord signs every interaction; verify against the raw body, so this route gets its own JSON parser.
await app.register(async (inst) => {
  inst.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => done(null, body));
  inst.post('/discord/interactions', async (req, reply) => {
    const raw = typeof req.body === 'string' ? req.body : '';
    if (!discordReady() || !verifySignature(raw, String(req.headers['x-signature-ed25519'] ?? ''), String(req.headers['x-signature-timestamp'] ?? ''))) return reply.code(401).send('invalid request signature');
    let i; try { i = JSON.parse(raw); } catch { return reply.code(400).send(); }
    const first = handleInteraction(i);
    if (first) return first;
    return handleLinked(i, { startRun, liveRuns });
  });
});

await mountIntegrationsPublic(app);

// Tests only: run the scheduler now (the server ticks on its own every 30 s).
if (env('TEST_HOOKS') === '1' && env('NODE_ENV') !== 'production') {
  const tickRoute = async (req, reply) => (env('CRON_SECRET') && same(req.headers['x-cron-secret'] ?? '', env('CRON_SECRET')) ? { ...(await tick()), active: activeCount() } : reply.code(401).send({ error: 'bad cron secret' }));
  app.get('/internal/tick', tickRoute);
}

/* ---------- user API ---------- */
await app.register(async (v1) => {
  v1.addHook('preHandler', requireUser);
  await v1.register(multipart, { limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

  mountAdmin(app, v1, { requireOwner });
  mountIntegrations(v1, { requireOwner });

  /* app notifications: devices, inbox, questions */
  v1.get('/v1/mates/cards', async () => (await import('./prompt.js')).defaultCards());
  // A short spoken sample of an agent's call voice (Agents → Configure → Voice on calls → Play).
  v1.get('/v1/voice/preview', async (req, reply) => {
    const { VOICE_NAMES, voiceFor } = await import('./mates.js'); const { cardFor } = await import('./prompt.js'); const { previewVoice } = await import('../voice/preview.js');
    const ro = await loadRoster(req.user.uid); const mate = ro.has(String(req.query?.mate ?? '')) ? String(req.query.mate) : ro.leader;
    const cfg = ro.cfgs[mate] ?? {}; const voice = VOICE_NAMES.includes(String(req.query?.voice ?? '')) ? String(req.query.voice) : voiceFor(mate, cfg);
    const audio = await previewVoice({ voice, name: ro.name(mate), blurb: ro.byKey[mate]?.blurb ?? '', card: cardFor(mate, { ...cfg, personality: String(req.query?.personality ?? cfg.personality ?? '') }, ro.byKey[mate]) });
    return reply.type('audio/wav').header('cache-control', 'private, max-age=3600').send(audio);
  });
  v1.get('/v1/push/key', async () => ({ publicKey: vapidPublicKey() }));
  v1.get('/v1/devices', async (req) => listDevices(req.user.uid));
  v1.post('/v1/devices', async (req, reply) => reply.code(201).send(await addDevice(req.user.uid, req.body ?? {})));
  v1.delete('/v1/devices/:id', async (req, reply) => { await removeDevice(req.user.uid, req.params.id); return reply.code(204).send(); });
  v1.get('/v1/inbox', async (req) => (await userCol(req.user.uid, 'inbox').limit(300).get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 50));
  v1.post('/v1/inbox/read', async (req) => { const snap = await userCol(req.user.uid, 'inbox').where('read', '==', false).get(); await Promise.all(snap.docs.map((d) => d.ref.set({ read: true }, { merge: true }))); return { ok: true, n: snap.size }; });
  v1.get('/v1/questions', async (req) => openQuestions(req.user.uid));
  v1.post('/v1/questions/:id/answer', async (req) => ({ ok: true, text: await answerQuestion(req.user.uid, req.params.id, req.body?.answer, 'app') }));

  v1.get('/v1/auth/session', async (req) => ({ signedIn: true, name: req.user.name, email: req.user.email, plan: 'Free' }));
  v1.post('/v1/auth/sign-out', async (req, reply) => reply.code(204).send());

  v1.get('/v1/settings', async (req) => getSettings(req.user.uid));
  v1.patch('/v1/settings', async (req, reply) => {
    const uid = req.user.uid; const body = { ...(req.body ?? {}) };
    if ('leader' in body) { const r = await loadRoster(uid); if (!r.has(body.leader)) return reply.code(400).send({ error: 'That agent does not exist (or was removed).' }); }
    const out = await patchSettings(uid, body);
    if ('leader' in body) { // a new leader is always switched on
      const ref = userCol(uid, 'mates').doc(out.leader); const cur = (await ref.get()).data();
      if (cur && cur.enabled === false) await ref.set({ enabled: true, updatedAt: now() }, { merge: true });
    }
    invalidateRoster(uid);
    if (['briefingOn', 'briefingAt', 'timezone'].some((k) => k in body)) await briefingHook(uid, out).catch(() => {});
    if (['standupOn', 'standupDay', 'standupAt', 'timezone'].some((k) => k in body)) await standupHook(uid, out).catch(() => {});
    return out;
  });
  /* the leader's watch: what it keeps an eye on, and what it raised */
  v1.get('/v1/leader', async (req) => {
    const uid = req.user.uid; await ensureDefaultWatches(uid);
    const [w, a, ro, s] = await Promise.all([userCol(uid, 'watches').limit(50).get(), userCol(uid, 'alerts').limit(300).get(), loadRoster(uid), getSettings(uid)]);
    return { leader: ro.leader, name: ro.name(ro.leader), watches: w.docs.map((d) => ({ id: d.id, ...d.data() })), alerts: a.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 40),
      calls: { maxPerDay: s.maxCallsPerDay, urgentBreaksQuiet: s.urgentBreaksQuiet }, briefing: { on: s.briefingOn, at: s.briefingAt, call: s.briefingCall } };
  });
  v1.post('/v1/watches/:id/check', async (req) => ({ raised: await runWatch(req.user.uid, req.params.id) }));
  v1.post('/v1/leader/briefing', async (req) => sendBriefing(req.user.uid));
  v1.post('/v1/leader/standup', async (req) => runStandup(req.user.uid));
  v1.get('/v1/standups', async (req) => (await userCol(req.user.uid, 'standups').limit(100).get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 12));
  /* company: directory import, employee invites, sending approved check-ins, workload */
  v1.post('/v1/people/import', async (req) => importPeople(req.user.uid, req.body?.csv));
  v1.post('/v1/people/:id/invite', async (req) => inviteCode(req.user.uid, req.params.id));
  v1.post('/v1/checkins/:id/send', async (req) => sendCheckin(req.user.uid, req.params.id));
  v1.get('/v1/company/overview', async (req) => { const o = await overview(req.user.uid, { team: String(req.query?.team ?? '') }); return { avg: o.avg, people: o.rows.map((r) => ({ id: r.p.id, open: r.open, overdue: r.overdue, blocked: r.blocked })), overloaded: o.overloaded.map((r) => r.p.id) }; });
  /* agents: the roster, custom agents, remove/restore. The leader is settings.leader. */
  v1.get('/v1/mates/roster', async (req) => { const r = await loadRoster(req.user.uid); return { leader: r.leader, agents: r.list.map((d) => ({ ...d, enabled: r.on(d.key) })), removed: r.removed.map((d) => ({ key: d.key, name: d.name, builtin: d.builtin })) }; });
  v1.post('/v1/mates', async (req, reply) => reply.code(201).send(await createAgent(req.user.uid, req.body ?? {})));
  v1.delete('/v1/mates/:id', async (req, reply) => { await removeAgent(req.user.uid, req.params.id); return reply.code(204).send(); });
  v1.post('/v1/mates/:id/restore', async (req, reply) => { await restoreAgent(req.user.uid, req.params.id); return reply.code(204).send(); });

  /* runs */
  v1.post('/v1/runs', async (req, reply) => reply.code(201).send(await startRun(req.user.uid, req.body ?? {})));
  for (const a of ['stop', 'pause', 'resume']) v1.post(`/v1/runs/:id/${a}`, async (req) => control(req.user.uid, req.params.id, a));
  v1.post('/v1/runs/:id/retry', async (req) => retryRun(req.user.uid, req.params.id));
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
    const ro = await loadRoster(uid);
    const home = ro.has(req.body?.mate) ? req.body.mate : ro.has(conv.mate) ? conv.mate : ro.leader;
    const userMsg = { id: rid(), role: 'user', text, at: now(), state: 'sent' };
    const messages = [...(conv.messages ?? []), userMsg];
    const cfgs = ro.cfgs;
    const settings = await getSettings(uid);
    // @mentions: every mentioned Mate answers in turn; with none, the chat's own Mate answers.
    const asked = [...new Set([...text.matchAll(/(?:^|\s)@([a-z][a-z0-9]*)/gi)].map((m) => m[1].toLowerCase()))].filter((k) => ro.has(k)).slice(0, 3);
    const skipped = asked.filter((k) => !ro.on(k));
    const mates = asked.filter((k) => !skipped.includes(k));
    const responders = mates.length ? mates : (asked.length ? [] : [home]);
    const members = [...new Set([...(conv.members ?? []), ...mates])];
    const nameOf = (k) => ro.name(k);
    // History budget: automatic ~28k chars, or derived from the developer option (about 4 chars per token, minus room for the prompt and the answer).
    const HIST_CHARS = settings.maxContextTokens > 0 ? Math.max(2000, settings.maxContextTokens * 4 - 6000 - (settings.maxOutputTokens || 1500) * 4) : 28_000;
    const historyFor = (me, src = messages) => {
      const all = src.filter((m) => m.role !== 'system' && m.state !== 'error').map((m) => (m.role === 'user' ? { role: 'user', content: m.text } : (m.mate ?? home) === me ? { role: 'assistant', content: m.text } : { role: 'user', content: `[${nameOf(m.mate ?? home)}]: ${m.text}` }));
      let used = 0, from = all.length;
      while (from > 0 && used + all[from - 1].content.length <= HIST_CHARS) used += all[--from].content.length;
      if (from === all.length && all.length) from = all.length - 1; // always keep the newest message
      const kept = all.slice(from);
      if (from > 0) { const first = all.find((m) => m.role === 'user')?.content ?? ''; kept.unshift({ role: 'user', content: `[Note: ${from} earlier message(s) are not shown here. The chat began with the owner saying: "${first.slice(0, 300)}". Use the chat_history tool to look further back.]` }); }
      return kept;
    };
    const turn = (mate, emit, signal) => converse({ uid, mateKey: mate, cfg: cfgs[mate] ?? {}, settings, mode: conv.mode ?? 'chat', history: historyFor(mate), emit, signal, ctx: { convId: req.params.id }, thinking: conv.thinking, others: [...new Set([home, ...members])].filter((k) => k !== mate).map(nameOf) });
    const sysNote = (t) => ({ id: rid(), role: 'system', text: t, at: now(), state: 'sent' });
    const stream = req.query?.stream === '1';
    const save = () => ref.set({ messages, updatedAt: now(), ...(members.length ? { members } : {}) }, { merge: true });
    if (skipped.length) messages.push(sysNote(`${skipped.map(nameOf).join(', ')} ${skipped.length > 1 ? 'are' : 'is'} switched off. Turn on in Agents to use @${skipped[0]}.`));
    const table = conv.mode === 'brainstorm' && !text.startsWith('/btw');
    const rounds = Math.min(4, Math.max(1, Number(conv.rounds) || settings.brainstormRounds || 2));
    const seat = table ? pickParticipants({ mentioned: mates, home, members: conv.members ?? [], ro }) : [];
    if (table && seat.length < 2) messages.push(sysNote('Brainstorm needs at least two agents. Switch some on in Agents, or @mention them.'));
    const sitting = table && seat.length >= 2;
    if (sitting) for (const k of seat) if (!members.includes(k) && k !== home) members.push(k);
    const snap = [...messages]; // the chat as it was when the table was called; turns are appended separately
    const roundTable = (emit, signal) => runRoundTable({ uid, topic: text, participants: seat, rounds, cfgs, ro, settings, baseHistory: (me) => historyFor(me, snap), emit, signal, onMessage: async (m) => { messages.push(m); await save().catch(() => {}); } });

    if (!stream) {
      if (sitting) { await roundTable(() => {}); return userMsg; }
      for (const mate of responders) {
        try { const r = await turn(mate, () => {}); messages.push({ id: rid(), role: 'mate', mate, text: r.text, at: now(), state: 'sent', ...(r.thought ? { thought: r.thought.slice(0, 8000) } : {}) }); void learnFromTurn(uid, { user: text, assistant: r.text, mate, settings }); }
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
    if (sitting) { await roundTable(write, ac.signal); clearInterval(beat); raw.end(); return; }
    for (const mate of responders) {
      if (gone) break;
      write({ type: 'mate', mate });
      let out;
      try { const r = await turn(mate, write, ac.signal); out = { id: rid(), role: 'mate', mate, text: r.text, at: now(), state: 'sent', ...(r.thought ? { thought: r.thought.slice(0, 8000) } : {}) }; }
      catch (e) { out = gone ? null : { id: rid(), role: 'system', text: `${nameOf(mate)} could not reply: ${String(e.message).slice(0, 300)}`, at: now(), state: 'error' }; }
      if (out) { messages.push(out); await save().catch(() => {}); write({ type: 'done', message: out }); if (out.role === 'mate') void learnFromTurn(uid, { user: text, assistant: out.text, mate, settings }); }
    }
    if (!responders.length) write({ type: 'done', message: messages.at(-1) });
    clearInterval(beat);
    raw.end();
  });

  /* knowledge graph: what the agents have learned (Memory screen) */
  v1.get('/v1/graph', async (req) => graphSnapshot(req.user.uid, { history: req.query?.history === '1' }));
  v1.delete('/v1/graph/nodes/:id', async (req, reply) => { await deleteNode(req.user.uid, req.params.id); return reply.code(204).send(); });
  v1.post('/v1/graph/merge', async (req, reply) => { await mergeNodes(req.user.uid, String(req.body?.from ?? ''), String(req.body?.into ?? '')); return reply.code(204).send(); });

  /* mcp / connections / providers */
  v1.post('/v1/mcp-servers/:id/verify', async (req, reply) => {
    const ref = userCol(req.user.uid, 'mcp').doc(req.params.id); const s = (await ref.get()).data();
    if (!s) return reply.code(404).send({ error: 'Not found' });
    const r = await verifyMcp(s, req.user.uid, ref.id);
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
        if (!telegramReady()) error = 'No Telegram bot token on your Loopmates server yet. Add it in Connections → Telegram.';
        else if (!c.config?.chatId) { status = 'pending'; error = 'Not linked yet. Get a code and send /start CODE to the bot.'; }
        else { await tgSend(c.config.chatId, 'Loopmates test message: connected'); status = 'connected'; }
      } else if (c.provider === 'discord') {
        if (!discordReady()) error = 'Discord is not set up on your Loopmates server yet. Add the app ID, public key and bot token in Connections → Discord.';
        else if (!c.config?.channelId) { status = 'pending'; error = 'Not linked yet. Get a code and use /link in Discord.'; }
        else { await sendChannel(c.config.channelId, 'Loopmates test message: connected'); status = 'connected'; }
      } else if (c.provider === 'whatsapp') {
        const w = waStatus(); status = w.status === 'open' ? 'connected' : 'pending'; error = status === 'pending' ? `Bridge is ${w.status}.` : '';
      } else if (c.provider === 'gdrive') {
        if (!driveReady()) { status = 'pending'; error = 'Google Drive is not connected yet. Follow the steps in Connections → Google Drive.'; }
        else { await driveHealth(); status = 'connected'; }
      } else if (c.provider === 'github') {
        const tok = c.secretsEnc?.token ? open(c.secretsEnc.token, `${uid}|connection|${ref.id}|token`) : '';
        const repos = String(c.config?.repos ?? env('GITHUB_REPOS')).split(',').map((x) => x.trim()).filter(Boolean);
        const r = await testGithub(tok || env('GITHUB_TOKEN'), repos);
        if (r.ok) { status = 'connected'; await ref.set({ config: { ...(c.config ?? {}), login: r.login, check: r.repos.join('; ').slice(0, 500) } }, { merge: true }); } else error = r.error;
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
  v1.post('/v1/discord/link-code', async (req, reply) => (discordReady() ? discordLinkCode(req.user.uid, req.body?.connectionId) : reply.code(503).send({ error: 'Discord is not set up on your Loopmates server yet (application ID, public key, bot token).' })));
  v1.get('/v1/calls', async (req) => listCalls(req.user.uid, Number(req.query.limit) || 15));
  // "Call me now" from a chat: a call with this Mate that carries the chat's context (the same snapshot as a timer).
  v1.post('/v1/calls/now', async (req) => {
    const { mate = '', convId = '', reason = '' } = req.body ?? {};
    const c = await createCall(req.user.uid, { mate: String(mate), convId: String(convId), reason: String(reason || 'You asked to talk about this chat').slice(0, 300), goal: 'Talk it through with the owner, then sum up what was decided.' });
    return { id: c.id, mate: c.mate, reason: c.reason };
  });
  v1.post('/v1/calls/:id/cancel', async (req) => (await import('./calls.js')).cancelCall(req.user.uid, req.params.id));
  v1.get('/v1/calls/:id', async (req, reply) => (await getCall(req.user.uid, req.params.id)) ?? reply.code(404).send({ error: 'Not found' }));
  v1.get('/v1/whatsapp/status', async () => waStatus());
  v1.post('/v1/whatsapp/pair', async (req) => startWhatsApp({ phone: req.body?.phone }));
  v1.get('/v1/whatsapp/recent', async (req) => waRecent(String(req.query.chat ?? '')));

  registerCrud(v1, {
    hooks: {
      ...schedHooks, watches: watchHook,
      knowledge: async (uid, id, doc, op) => { if (op === 'set' && doc?.status === 'pending') void indexKnowledge(uid, id); },
      files: async (uid, id, doc, op, prev) => { if (op === 'delete') await deleteDriveFile(prev?.driveId); },
    },
  });
});
}

/** Background work that starts once the server listens. */
export async function bootApi(app) {
  setCompanySender((chatId, text) => tgSend(chatId, text));
  if (env('OWNER_UID')) void ensureDefaultWatches(env('OWNER_UID')).catch(() => {});
const recovered = await recoverRuns().catch((e) => { app.log.error(e); return 0; });
if (recovered) app.log.warn(`marked ${recovered} interrupted run(s) as failed`);
startScheduler();
resumeWhatsApp().catch((e) => app.log.warn(`whatsapp: ${e.message}`));
if (discordReady()) {
  registerCommands().then((r) => app.log.info(`discord commands: ${r.ok ? 'registered' : r.error}`)).catch(() => {});
  startGateway({ startRun, liveRuns, onComponent: answerFromDiscord, log: app.log });
}
if (telegramReady()) startPolling(app.log);
bootIntegrations(app.log);
await initPush().catch((e) => app.log.warn(`push: ${e.message}`));
startPresence(app.log);
}
