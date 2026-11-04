// Fast offline checks for the new pieces (no network, in-memory DB): node scripts/unit.mjs
process.env.MEMORY_DB = '1'; process.env.SERVICE_SECRET = 'x'; process.env.MASTER_KEY = 'a'.repeat(32);
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
console.log(`\nALL ${n} UNIT CHECKS PASSED`); process.exit(0);
