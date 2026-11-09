// Fast offline checks for the new pieces (no network, in-memory DB): node scripts/unit.mjs
process.env.MEMORY_DB = '1'; process.env.MASTER_KEY = Buffer.alloc(32, 3).toString('base64');
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
process.env.DISCORD_PUBLIC_KEY = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
const { verifySignature } = await import('../src/api/discord.js');
const { pack, cosine } = await import('../src/api/vec.js');
const { addMemory, recall } = await import('../src/api/memory.js');
const { createCall, wrapUp, getCall, missionPrompt } = await import('../src/api/calls.js');
let n = 0; const ok = (m) => console.log(`  ✓ ${m}`, ++n && '');

const body = '{"type":1}', ts = '1700000000';
const sig = sign(null, Buffer.from(ts + body), privateKey).toString('hex');
assert.equal(verifySignature(body, sig, ts), true); assert.equal(verifySignature(body + ' ', sig, ts), false); ok('discord signature verify');

const a = pack([1, 0, 0, 0]), b = pack([1, 0.1, 0, 0]), c = pack([0, 0, 1, 0]);
assert.ok(cosine(a, b) > 0.95 && cosine(a, c) < 0.05); ok('vector pack + cosine');

await addMemory('u1', { text: 'User likes the game Genshin Impact' });
await addMemory('u1', { text: 'User studies ECE in Chennai' });
const hits = await recall('u1', 'genshin game', { k: 3, pinned: 0 });
assert.equal(hits[0]?.text, 'User likes the game Genshin Impact'); ok('memory save + keyword recall fallback');

const call = await createCall('u1', { mate: 'mimo', goal: 'Plan the weekend', questions: ['Which day?', 'Budget?'] });
assert.match(missionPrompt(call), /Which day\?/);
const r = await wrapUp('u1', call.id, { transcript: [{ who: 'mate', text: 'Hi' }, { who: 'you', text: 'Saturday, 500 rupees' }], finish: { summary: 'Saturday, budget 500.', answers: ['Which day? -> Saturday', 'Budget? -> 500'], followups: [] }, why: 'done' });
assert.equal(r.report.outcome, 'completed'); assert.equal((await getCall('u1', call.id)).status, 'done'); ok('call mission report');
const c2 = await createCall('u1', { mate: 'mimo', goal: 'x' });
assert.equal((await wrapUp('u1', c2.id, { transcript: [{ who: 'mate', text: 'Hello?' }] })).report.outcome, 'missed'); ok('unanswered call is marked missed');

/* ask_owner: a run step waits for the answer; on timeout the default is used */
const { askOwner, waitForAnswer, answerQuestion, openQuestions } = await import('../src/api/ask.js');
const q = await askOwner('u1', { mate: 'planner', question: 'Cost or speed?', options: ['Cost', 'Speed'], fallback: 'Speed', runId: 'r1' });
assert.equal((await openQuestions('u1')).length, 1);
const waiting = waitForAnswer('u1', q);
assert.equal(await answerQuestion('u1', q.id, 'Cost', 'telegram'), 'Answered: Cost');
assert.deepEqual(await waiting, { answer: 'Cost', timedOut: false });
assert.equal((await openQuestions('u1')).length, 0);
assert.match(await answerQuestion('u1', q.id, 'Speed'), /Already answered/);
await assert.rejects(askOwner('u1', { question: 'x', options: ['only one'] }));
ok('ask_owner: answer reaches the waiting step, double answers ignored, 2+ options required');

const { isQuiet } = await import('../src/api/notify.js');
const at = new Date('2026-11-08T17:00:00Z'); // 22:30 in Asia/Kolkata
assert.equal(isQuiet({ quietHoursOn: true, quietFrom: '22:00', quietTo: '07:00', timezone: 'Asia/Kolkata' }, at), true);
assert.equal(isQuiet({ quietHoursOn: true, quietFrom: '09:00', quietTo: '17:00', timezone: 'Asia/Kolkata' }, at), false);
assert.equal(isQuiet({ quietHoursOn: false, quietFrom: '22:00', quietTo: '07:00', timezone: 'Asia/Kolkata' }, at), false);
ok('quiet hours over midnight, in the owner timezone');

const { renderTemplate, defaultCards } = await import('../src/api/prompt.js');
assert.equal(Object.values(defaultCards()).filter(Boolean).length, 19);
const t = renderTemplate({ 'mate.name': 'Code', 'mate.card': '**Code** card', tools: 'ask_owner' }, { mode: 'plan', surface: 'run', tools: ['ask_owner'] });
assert.ok(t.includes('Mode: PLAN') && !t.includes('Mode: BRAINSTORM') && t.includes('# Inside a run') && !t.includes('# Voice call rules') && !/\{\{|\[\[/.test(t));
ok('system prompt template: conditions, role card, no leftover markers');
const { cardFor, briefPersona } = await import('../src/api/prompt.js');
const cards = defaultCards();
for (const [k, c] of Object.entries(cards)) for (const part of ['How you work:', 'Voice:', 'Ends with:', 'In a brainstorm:']) assert.ok(c.includes(part), `${k} card has ${part}`);
assert.equal(new Set(Object.values(cards).map((c) => /Voice: (.*)/.exec(c)[1])).size, 19, 'every Mate has its own voice line');
assert.equal(renderTemplate({ 'mate.name': 'Luna', 'mate.card': cards.luna }, { mode: 'chat', surface: 'chat', tools: [] }).split('Voice: soft, reflective').length, 2, 'the card is sent once, not twice');
assert.match(cardFor('luna', { personality: 'Dry and brief.' }), /Voice \(set by the owner.*Dry and brief\./);
assert.match(cardFor('hira', {}, { name: 'Hira', blurb: 'Books interviews.' }), /\*\*Hira\*\* \(custom agent\)\. Books interviews\.\nHow you work:[\s\S]*Voice:[\s\S]*Ends with:/);
assert.ok(briefPersona('writer', { card: '**Writer** custom card. Voice: shouty.' }).includes('Voice: shouty.'), 'run reports use the owner-edited card');
ok('role cards: every Mate has its own voice, ending and brainstorm stance; personality and custom agents covered');
const { voiceFor, MATE_VOICE, SPARE_VOICES } = await import('../src/api/mates.js');
assert.equal(new Set(Object.values(MATE_VOICE)).size, 19, 'no two built-ins share a call voice');
assert.equal(voiceFor('research'), 'Charon'); assert.equal(voiceFor('research', { voice: 'Kore' }), 'Kore'); assert.equal(voiceFor('research', { voice: 'Nope' }), 'Charon');
assert.ok(SPARE_VOICES.includes(voiceFor('hira')) && voiceFor('hira') === voiceFor('hira'), 'custom agents get a stable voice no built-in uses');
ok('call voices: owner pick, built-in default, spare voice for custom agents');
const { addMemory: add2, recall: rec2 } = await import('../src/api/memory.js');
await add2('u2', { text: 'Luna keeps the journal format short', scope: 'personal', mate: 'luna' });
await add2('u2', { text: 'Owner lives in Chennai', scope: 'shared' });
const asCode = await rec2('u2', 'journal format Chennai', { k: 5, pinned: 0, mate: 'code', access: { memory: { personal: true, shared: 'read' } } });
const asLuna = await rec2('u2', 'journal format Chennai', { k: 5, pinned: 0, mate: 'luna', access: { memory: { personal: true, shared: 'read' } } });
assert.ok(asCode.length && asCode.every((m) => m.scope === 'shared') && asLuna.some((m) => m.scope === 'personal'));
assert.equal((await rec2('u2', 'Chennai', { k: 5, pinned: 0, mate: 'luna', access: { memory: { personal: true, shared: 'none' } } })).length, 0);
ok('memory scopes: personal notes stay with their agent, shared can be switched off');

const { link, neighbours } = await import('../src/api/graph.js');
await link('u3', { from: 'Owner', rel: 'lives in', to: 'Chennai' }); await link('u3', { from: 'Owner', rel: 'lives_in', to: 'Bengaluru' });
const nb = await neighbours('u3', 'owner', { history: true });
assert.ok(nb.lines.some((l) => l.includes('Bengaluru') && !l.includes('until')) && nb.lines.some((l) => l.includes('Chennai') && l.includes('until')));
ok('graph: one-value relations replace the old value and keep it as history');
const { userCol } = await import('../src/api/db.js');
const company = await import('../src/api/company.js');
await userCol('u4', 'people').doc('p1').set({ name: 'Arun Kumar', role: 'Designer', teamId: '', contact: {}, status: 'active' });
await userCol('u4', 'assignments').doc('a1').set({ title: 'Launch deck', assigneeId: 'p1', status: 'todo', due: '2030-01-01T00:00:00.000Z' });
await userCol('u4', 'memories').doc('m1').set({ kind: 'fact', text: 'Owner salary is 99 lakh', scope: 'shared' });
const inv = await company.inviteCode('u4', 'p1');
assert.match(await company.joinTelegram(inv.code, '555', 'arun'), /Hi Arun Kumar/);
assert.deepEqual(await company.employeeOf('555'), { uid: 'u4', personId: 'p1', at: (await company.employeeOf('555')).at });
assert.match(await company.employeeMessage('u4', 'p1', '/tasks'), /1\. Launch deck/);
assert.match(await company.employeeMessage('u4', 'p1', '/blocked 1 waiting for copy'), /blocked/);
assert.equal((await userCol('u4', 'assignments').doc('a1').get()).data().status, 'blocked');
const leak = await company.employeeMessage('u4', 'p1', 'what is the owner salary?');
assert.ok(!/99/.test(leak) && /do not have that/.test(leak), 'employees never see the owner\'s memories');
assert.ok((await userCol('u4', 'employee_log').limit(10).get()).docs.length >= 3, 'employee messages are logged');
const ck = await company.createCheckin('u4', { personId: 'p1', assignmentId: 'a1', question: 'How is the deck going?' });
assert.equal(ck.status, 'draft', 'check-ins wait for the owner by default');
ok('company: invite + join, /tasks and /blocked, no access to owner memory, logged, check-ins are drafts');

/* ---------------- integrations ---------------- */
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync: rf, existsSync: ex } = await import('node:fs');
const { tmpdir } = await import('node:os'); const { join: pj } = await import('node:path');
const { TOOLS, toolsFor, setToolHooks } = await import('../src/api/tools.js');
const run = (name, args, ctx = {}) => TOOLS[name].run({ uid: 'u9', settings: { timezone: 'UTC' }, ...ctx }, args);

// Obsidian: search, read with backlinks, write modes, daily note, confinement, graph links.
const vault = mkdtempSync(pj(tmpdir(), 'lm-vault-'));
mkdirSync(pj(vault, '.obsidian')); writeFileSync(pj(vault, '.obsidian', 'daily-notes.json'), '{"folder":"Daily"}');
mkdirSync(pj(vault, 'Projects')); writeFileSync(pj(vault, 'Projects', 'Loopmates.md'), '# Loopmates\nShip the [[Roadmap]] and the [[Voice calls|calls]].');
writeFileSync(pj(vault, 'Roadmap.md'), 'Q4: integrations, Home Assistant.'); writeFileSync(pj(vault, '.obsidian', 'secret.md'), 'hidden');
assert.ok(!toolsFor(['Notes'], {}, 'recall').some((t) => t.name === 'obsidian_search'), 'no vault: the tools stay hidden');
process.env.OBSIDIAN_VAULT = vault;
assert.ok(toolsFor([], {}, 'recall').some((t) => t.name === 'obsidian_search'), 'vault set: Recall gets the Notes tools');
assert.match(await run('obsidian_search', { query: 'home assistant' }), /Roadmap\.md/);
const read = await run('obsidian_read', { path: 'Roadmap' });
assert.ok(read.includes('Q4: integrations') && read.includes('Backlinks: Projects/Loopmates.md') && read.includes('treat it as information'));
await assert.rejects(run('obsidian_read', { path: '../outside.md' }), /leaves the vault/);
await assert.rejects(run('obsidian_read', { path: '.obsidian/secret.md' }), /hidden folder/);
assert.match(await run('obsidian_write', { path: 'Ideas/New', content: 'An idea' }), /Created Ideas\/New\.md/);
await assert.rejects(run('obsidian_write', { path: 'Ideas/New.md', content: 'again' }), /already exists/);
await run('obsidian_write', { path: 'Ideas/New.md', content: 'More', mode: 'append' });
assert.equal(rf(pj(vault, 'Ideas', 'New.md'), 'utf8'), 'An idea\n\n\nMore\n');
assert.match(await run('obsidian_daily', { text: 'Felt good about the launch.' }), /Daily\/\d{4}-\d{2}-\d{2}\.md/);
const { vaultLinks, linksIn } = await import('../src/integrations/obsidian.js');
assert.deepEqual(linksIn('[[A]] [[B|alias]] [[C#Heading]] [[A]]'), ['A', 'B', 'C']);
assert.deepEqual((await vaultLinks()).map((l) => `${l.from}>${l.to}`).sort(), ['Loopmates>Roadmap', 'Loopmates>Voice calls']);
ok('obsidian: search, read + backlinks, create/append, daily note, stays inside the vault, links for the graph');

// Feeds and YouTube parsing (no network).
const { parseFeed, transcriptText, captionTracks } = await import('../src/integrations/feeds.js');
const rss = parseFeed('<rss><channel><title>Blog</title><item><title><![CDATA[Hello & bye]]></title><link>https://a.example/1</link><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;First&lt;/p&gt;</description></item></channel></rss>');
assert.equal(rss.title, 'Blog'); assert.equal(rss.items[0].title, 'Hello & bye'); assert.equal(rss.items[0].link, 'https://a.example/1'); assert.equal(rss.items[0].summary, 'First');
const atom = parseFeed('<feed><title>Chan</title><entry><title>Video</title><link rel="alternate" href="https://yt.example/v"/><id>yt:1</id><updated>2026-11-09</updated></entry></feed>');
assert.equal(atom.items[0].link, 'https://yt.example/v'); assert.equal(atom.items[0].id, 'yt:1');
assert.equal(transcriptText('<transcript><text start="0">Hi &amp;amp; welcome</text><text>to the show</text></transcript>'), 'Hi & welcome to the show');
assert.equal(captionTracks('"captionTracks":[{"baseUrl":"https://x","languageCode":"en"}],"audioTracks":[]')[0].languageCode, 'en');
ok('feeds: RSS, Atom and YouTube captions parse');

// Home Assistant against a fake server: find, control, secure domains need the approval tool.
const http = await import('node:http'); const calls = [];
const fake = http.createServer((req, res) => {
  if (req.headers.authorization !== 'Bearer t0k') { res.writeHead(401); return res.end('{"message":"no"}'); }
  let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => {
    const send = (j) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
    const st = [{ entity_id: 'light.kitchen', state: 'off', attributes: { friendly_name: 'Kitchen light' }, last_changed: '2026-11-09T10:00:00Z' }, { entity_id: 'lock.front_door', state: 'unlocked', attributes: { friendly_name: 'Front door' }, last_changed: '2026-11-09T09:00:00Z' }];
    if (req.url === '/api/states') return send(st);
    if (req.url.startsWith('/api/states/')) return send(st.find((s) => s.entity_id === req.url.slice(12)) ?? {});
    if (req.method === 'POST' && req.url.startsWith('/api/services/')) { calls.push([req.url, JSON.parse(b)]); return send([]); }
    if (req.url === '/api/config') return send({ location_name: 'Home', version: '2026.11' });
    res.writeHead(404); res.end('{}');
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
process.env.HA_URL = `http://127.0.0.1:${fake.address().port}`; process.env.HA_TOKEN = 't0k';
assert.match(await run('home_find', { query: 'kitchen' }), /light\.kitchen \| Kitchen light \| off/);
assert.match(await run('home_control', { entity_id: 'light.kitchen', action: 'turn_on', data: '{"brightness_pct": 30}' }), /Done: light\.turn_on/);
assert.deepEqual(calls[0], ['/api/services/light/turn_on', { brightness_pct: 30, entity_id: 'light.kitchen' }]);
await assert.rejects(run('home_control', { entity_id: 'lock.front_door', action: 'lock' }), /home_control_secure/);
await assert.rejects(run('home_control', { entity_id: 'light.kitchen', action: 'turn_on; rm' }), /service like/);
assert.ok(!toolsFor([], { permissionMode: 'ask' }, 'mimo', 'mimo').some((t) => t.name === 'home_control_secure') && toolsFor([], { permissionMode: 'ask' }, 'mimo', 'mimo').some((t) => t.name === 'home_control'), 'secure control needs approval (hidden in ask mode)');
assert.match(await run('home_control_secure', { entity_id: 'lock.front_door', action: 'lock' }), /Done: lock\.lock/);
const { home: homeInt } = await import('../src/integrations/home.js'); assert.match(await homeInt.test(), /Home Assistant 2026\.11\), 2 entities/);
const { addWatch, runWatch: rw } = await import('../src/api/watch.js');
await assert.rejects(addWatch('u9', { kind: 'home', config: {} }), /entity id/);
const hw = await addWatch('u9', { kind: 'home', config: { entity: 'lock.front_door', state: 'unlocked', score: 2 } });
const raisedHome = await rw('u9', hw.id); assert.equal(raisedHome.length, 1); assert.match(raisedHome[0].title, /Front door is unlocked/);
assert.equal((await rw('u9', hw.id)).length, 0, 'the same state change is raised once');
fake.close();
ok('home assistant: find, control with data, secure domains need approval, test, home watch raises once');

// Health: clean values, CSV, ingest key, summary.
const hl = await import('../src/integrations/health.js');
const d = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
assert.deepEqual(hl.cleanDay({ date: d(1), steps: '8400', restingHr: 999, junk: 1 }), { date: d(1), steps: 8400 });
assert.equal((await hl.saveDays('u9', [{ date: d(1), steps: 8400, sleepMinutes: 420 }, { date: 'bad', steps: 1 }, { date: d(9), steps: 4000, sleepMinutes: 360 }])).saved, 2);
assert.equal(hl.parseHealthCsv('Date,Steps,Sleep hours\n2026-11-01,5000,7.5')[0].sleepMinutes, 450);
const key = await hl.newIngestKey('u9'); assert.equal(await hl.uidForIngestKey(key), 'u9'); assert.equal(await hl.uidForIngestKey('lmh_wrongwrongwrongwrongwrong'), '');
const sum = await run('health_summary', { days: 7 }); assert.ok(sum.includes('steps: avg 8400 (before: 4000)') && sum.includes('7h00'));
ok('health: values cleaned, CSV import, ingest key, summary with the week before');

// Chat formats, signatures, email and Notion conversions.
const { toMrkdwn } = await import('../src/integrations/util.js');
assert.equal(toMrkdwn('## Plan\n**Bold** see [docs](https://d.example)\n- one'), '*Plan*\n*Bold* see <https://d.example|docs>\n• one');
const { verifyMeta, verifyHandshake, toWhatsApp } = await import('../src/integrations/whatsappcloud.js');
const { createHmac } = await import('node:crypto'); const body2 = '{"entry":[]}';
assert.equal(verifyMeta(body2, `sha256=${createHmac('sha256', 'sec').update(body2).digest('hex')}`, 'sec'), true);
assert.equal(verifyMeta(`${body2} `, `sha256=${createHmac('sha256', 'sec').update(body2).digest('hex')}`, 'sec'), false);
process.env.WHATSAPP_VERIFY_TOKEN = 'vt-123'; assert.equal(verifyHandshake({ 'hub.mode': 'subscribe', 'hub.verify_token': 'vt-123', 'hub.challenge': '42' }), '42'); assert.equal(verifyHandshake({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '42' }), null);
assert.equal(toWhatsApp('**Hi** [x](https://x.example)'), '*Hi* x (https://x.example)');
const { rfc822, messageText } = await import('../src/integrations/google.js');
assert.ok(!/\r\nBcc:/i.test(rfc822({ to: 'a@x.example\r\nBcc: evil@x.example', subject: 'Hi', body: 'b' })), 'no header injection');
assert.equal(messageText({ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: Buffer.from('Plain body').toString('base64url') } }] }), 'Plain body');
const { markdownBlocks, blocksText } = await import('../src/integrations/workapps.js');
assert.equal(blocksText(markdownBlocks('# Title\n- item\n- [x] done\nText')), '# Title\n- item\n- [x] done\nText');
ok('slack, whatsapp and email formats; Meta signatures and handshake; Notion blocks round-trip');

// Agents: team and sign-off lines, signed pings, journal notes, the stand-up without a model.
const { signoffFor } = await import('../src/api/prompt.js');
for (const [k, c] of Object.entries(defaultCards())) assert.ok(/\nTeam: /.test(c) && /\nSign-off: — /.test(c), `${k} has Team and Sign-off`);
assert.equal(signoffFor('ops'), '— Ops, standing by'); assert.equal(signoffFor('hira', {}, { name: 'Hira', blurb: 'x' }), '— Hira');
let pinged = null; setToolHooks({ notify: async (_u, text, opts) => { pinged = { text, opts }; return 1; } });
await run('notify_me', { text: 'Weekly report is ready.\n— Ops' }, { mate: 'ops', uid: 'u9' });
assert.equal(pinged.text, 'Weekly report is ready.\n— Ops, standing by'); assert.equal(pinged.opts.title, 'Ops');
const { runStandup } = await import('../src/api/watch.js');
await userCol('u9', 'conversations').doc('c1').set({ title: 'Trip to Goa', messages: [{ role: 'mate', mate: 'research', text: 'x', at: new Date().toISOString() }, { role: 'mate', mate: 'research', text: 'y', at: new Date().toISOString() }] });
const su = await runStandup('u9'); assert.match(su.text, /• Research: 2 chat replies, 0 run steps this week\. Topics: Trip to Goa\./);
const { wav } = await import('../src/voice/preview.js'); const w = wav(Buffer.alloc(48000)); assert.equal(w.toString('ascii', 0, 4), 'RIFF'); assert.equal(w.readUInt32LE(24), 24000);
ok('agents: team + sign-off lines, signed pings, stand-up falls back to facts, preview WAV header');

// Calls: a timer saves the Mate's context now, rings as that Mate later, and the call flows back into its chat.
const callsMod = await import('../src/api/calls.js');
await userCol('u9', 'conversations').doc('c2').set({ title: 'Logo ideas', mate: 'spark', updatedAt: new Date().toISOString(), messages: [{ role: 'user', text: 'I like the round logo best', at: new Date().toISOString() }, { role: 'mate', mate: 'spark', text: 'Round it is, two colour options next', at: new Date().toISOString() }] });
let rung = []; setToolHooks({ notify: async (_u, text, opts) => { rung.push({ text, opts }); return 1; }, tasks: async () => {} });
const sch = await run('schedule_call', { inMinutes: 30, reason: 'Pick the logo colour', questions: ['Blue or green?'] }, { mate: 'spark', convId: 'c2', uid: 'u9' });
assert.match(sch, /you \(Spark\) will call the owner at/);
const pend = (await callsMod.listCalls('u9', 5)).find((c) => c.status === 'scheduled');
assert.ok(pend.snapshot.includes('I like the round logo best') && pend.mate === 'spark', 'the snapshot is taken when the timer is set');
const { db } = await import('../src/api/db.js'); assert.ok((await db.collection('jobs').doc(`u9_call_${pend.id}`).get()).exists, 'the scheduler has the timer');
await assert.rejects(callsMod.scheduleCall('u9', { mate: 'spark', at: '2001-01-01T00:00:00Z', reason: 'x' }), /already passed/);
const rr = await callsMod.ringCall('u9', pend.id); assert.equal(rr.delivered, 'call'); assert.match(rung.at(-1).text, /Spark is calling: Pick the logo colour/);
await callsMod.wrapUp('u9', pend.id, { transcript: [{ who: 'mate', text: 'Blue or green?' }, { who: 'you', text: 'Green please, and send me the files tomorrow' }], finish: { summary: 'Owner picked green.', answers: ['Blue or green? -> green'], followups: ['Send the logo files tomorrow'] } });
const conv2 = (await userCol('u9', 'conversations').doc('c2').get()).data();
assert.ok(conv2.messages.at(-1).text.includes('**What was said**') && conv2.messages.at(-1).text.includes('Green please'), 'the call joins the Mate\'s chat history');
assert.ok((await userCol('u9', 'tasks').limit(50).get()).docs.some((d) => d.data().title === 'Send the logo files tomorrow'), 'follow-ups become tasks');
const c3 = await callsMod.scheduleCall('u9', { mate: 'zen', at: new Date(Date.now() + 3_600_000).toISOString(), reason: 'Break check' });
await callsMod.cancelCall('u9', c3.id); assert.equal((await callsMod.getCall('u9', c3.id)).status, 'cancelled'); assert.ok(!(await db.collection('jobs').doc(`u9_call_${c3.id}`).get()).exists);
assert.equal((await callsMod.waitForCall('u9', pend.id, { timeoutMs: 100 })).status, 'done');
ok('calls: timer with a context snapshot, rings as that Mate, report + transcript join its chat, follow-ups become tasks, cancel');

// python_run: only when this computer has Python or Docker.
const py = await import('../src/api/python.js');
try {
  const r = await py.runPython({ code: 'import csv\nrows=list(csv.reader(open("d.csv")))\nprint(sum(int(x[1]) for x in rows[1:]))\nopen("out.txt","w").write("done")', files: { 'd.csv': 'a,b\nx,2\ny,40\n' }, timeoutSec: 30 });
  assert.equal(r.code, 0, r.out); assert.equal(r.out.trim(), '42'); assert.deepEqual(r.files.map((f) => [f.name, f.text]), [['out.txt', 'done']]);
  await assert.rejects(py.runPython({ code: 'print(1)', files: { '../x.txt': 'no' } }), /Bad file name/);
  const slow = await py.runPython({ code: 'import time\ntime.sleep(30)', timeoutSec: 5 }); assert.match(slow.out, /killed: timeout/);
  ok(`python_run: runs with input files, returns output and new files, refuses ../ names, times out (${r.sandbox})`);
} catch (e) { if (/not installed/.test(e.message)) console.log('  - python_run skipped: no Python or Docker on this computer'); else throw e; }
assert.ok(TOOLS.python_run.needsApproval && !toolsFor(['Code Interpreter'], { permissionMode: 'ask' }, 'data').some((t) => t.name === 'python_run'), 'python_run needs approval');

console.log(`\nALL ${n} UNIT CHECKS PASSED`); process.exit(0);
