// Discord bot over HTTP interactions (slash commands), so it works on a sleeping free web service: Discord wakes the
// service by POSTing the command. Outgoing notifications use the bot token. Linking mirrors Telegram: code -> /link.
import { randomBytes, createPublicKey, verify } from 'node:crypto';
import { env, now } from '../lib/env.js';
import { db, userCol } from './db.js';
import { askMate } from './bridge.js';
import { MATE, MATE_DEFS } from './mates.js';

const API = 'https://discord.com/api/v10';
export const discordReady = () => !!(env('DISCORD_BOT_TOKEN') && env('DISCORD_PUBLIC_KEY') && env('DISCORD_APP_ID'));
const bot = (path, init = {}) => fetch(`${API}${path}`, { ...init, headers: { authorization: `Bot ${env('DISCORD_BOT_TOKEN')}`, 'content-type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });

/** Verify Discord's Ed25519 signature over timestamp + raw body. */
export function verifySignature(rawBody, sig, ts) {
  try {
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(env('DISCORD_PUBLIC_KEY'), 'hex')]), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(ts + rawBody), key, Buffer.from(sig, 'hex'));
  } catch { return false; }
}

const chunks = (t) => { const out = []; let s = String(t); while (s.length > 1900) { let i = s.lastIndexOf('\n', 1900); if (i < 800) i = 1900; out.push(s.slice(0, i)); s = s.slice(i).trimStart(); } out.push(s); return out; };

export async function sendChannel(channelId, text) {
  for (const part of chunks(text)) {
    const r = await bot(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content: part, allowed_mentions: { parse: [] } }) });
    if (!r.ok) throw new Error(`Discord: ${r.status}`);
  }
}
async function linkedChannels(uid) {
  const snap = await userCol(uid, 'connections').where('provider', '==', 'discord').get();
  return snap.docs.map((d) => d.data().config?.channelId).filter(Boolean);
}
export async function notify(uid, text) {
  if (!env('DISCORD_BOT_TOKEN')) return 0;
  let n = 0;
  for (const id of await linkedChannels(uid)) { try { await sendChannel(id, text); n++; } catch { /* channel may be gone */ } }
  return n;
}

export async function linkCode(uid, connectionId) {
  const code = randomBytes(4).toString('hex').toUpperCase();
  await db.collection('discordLinks').doc(code).set({ uid, connectionId: connectionId ?? null, exp: Date.now() + 15 * 60_000 });
  return { code, command: `/link code:${code}`, appId: env('DISCORD_APP_ID') || null, expiresInMinutes: 15, invite: env('DISCORD_APP_ID') ? `https://discord.com/oauth2/authorize?client_id=${env('DISCORD_APP_ID')}&scope=applications.commands%20bot&permissions=2048` : null };
}

/** Register slash commands globally (idempotent). */
export async function registerCommands() {
  if (!discordReady()) return { ok: false, error: 'Discord is not configured' };
  const mateChoices = MATE_DEFS.slice(0, 25).map((m) => ({ name: m.name, value: m.key }));
  const body = [
    { name: 'link', description: 'Link this chat to your Loopmates account', type: 1, options: [{ type: 3, name: 'code', description: 'Code from Loopmates > Connections', required: true }], integration_types: [0, 1], contexts: [0, 1, 2] },
    { name: 'ask', description: 'Ask one of your Mates (full tools and memory)', type: 1, options: [{ type: 3, name: 'message', description: 'What do you need?', required: true }, { type: 3, name: 'mate', description: 'Which Mate (default Mimo)', required: false, choices: mateChoices }], integration_types: [0, 1], contexts: [0, 1, 2] },
    { name: 'run', description: 'Start a multi-step run', type: 1, options: [{ type: 3, name: 'task', description: 'What should the team do?', required: true }], integration_types: [0, 1], contexts: [0, 1, 2] },
    { name: 'status', description: 'See your active and recent runs', type: 1, integration_types: [0, 1], contexts: [0, 1, 2] },
  ];
  const r = await bot(`/applications/${env('DISCORD_APP_ID')}/commands`, { method: 'PUT', body: JSON.stringify(body) });
  return r.ok ? { ok: true } : { ok: false, error: `Discord answered ${r.status}: ${(await r.text()).slice(0, 200)}` };
}

const say = (content, ephemeral = true) => ({ type: 4, data: { content: content.slice(0, 1900), flags: ephemeral ? 64 : 0 } });
const opt = (i, name) => i.data?.options?.find((o) => o.name === name)?.value;

/** Handle one interaction. Returns the immediate HTTP response body; long work finishes through the follow-up webhook. */
export function handleInteraction(i) {
  if (i.type === 1) return { type: 1 };
  if (i.type !== 2) return say('Unsupported interaction.');
  const duid = i.user?.id ?? i.member?.user?.id;
  const name = i.data?.name;
  const finish = (content) => fetch(`${API}/webhooks/${env('DISCORD_APP_ID')}/${i.token}/messages/@original`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: String(content).slice(0, 1900), allowed_mentions: { parse: [] } }) }).catch(() => {});
  const follow = (content) => fetch(`${API}/webhooks/${env('DISCORD_APP_ID')}/${i.token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) }).catch(() => {});

  if (name === 'link') {
    const code = String(opt(i, 'code') ?? '').trim().toUpperCase();
    void (async () => {
      const ref = db.collection('discordLinks').doc(code); const d = await ref.get();
      if (!d.exists || d.data().exp < Date.now()) return finish('That code is invalid or expired. Make a new one in Loopmates > Connections.');
      const { uid, connectionId } = d.data();
      let channelId = i.channel_id ?? i.channel?.id;
      try { const dm = await (await bot('/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: duid }) })).json(); if (dm?.id) channelId = dm.id; } catch { /* keep the current channel */ }
      const col = userCol(uid, 'connections'); const r2 = connectionId ? col.doc(connectionId) : col.doc(); const cur = (await r2.get()).data() ?? {};
      await r2.set({ provider: 'discord', label: cur.label || 'Discord', ...cur, status: 'connected', config: { ...(cur.config ?? {}), channelId, userId: duid }, createdAt: cur.createdAt ?? now(), updatedAt: now() }, { merge: true });
      await db.collection('discordUsers').doc(duid).set({ uid, linkedAt: now() });
      await ref.delete();
      await finish('Linked. Run updates and call reports will arrive here. Try /ask.');
    })().catch((e) => finish(`Link failed: ${String(e.message).slice(0, 200)}`));
    return { type: 5, data: { flags: 64 } };
  }
  // Everything else needs a linked account, otherwise anyone could spend your model quota.
  return null;
}

export async function handleLinked(i, deps) {
  const duid = i.user?.id ?? i.member?.user?.id; const name = i.data?.name;
  const uid = (await db.collection('discordUsers').doc(duid).get()).data()?.uid;
  if (!uid) return say('This account is not linked yet. Open Loopmates > Connections > Discord, get a code, then use /link.');
  const finish = (content) => fetch(`${API}/webhooks/${env('DISCORD_APP_ID')}/${i.token}/messages/@original`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: String(content).slice(0, 1900), allowed_mentions: { parse: [] } }) }).catch(() => {});
  const follow = (content) => fetch(`${API}/webhooks/${env('DISCORD_APP_ID')}/${i.token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) }).catch(() => {});
  const work = (fn) => { void (async () => { try { const parts = chunks(await fn()); await finish(parts[0]); for (const p of parts.slice(1)) await follow(p); } catch (e) { await finish(`Something went wrong: ${String(e.message).slice(0, 300)}`); } })(); return { type: 5 }; };
  if (name === 'ask') {
    const mate = MATE[opt(i, 'mate')] ? opt(i, 'mate') : 'mimo'; const text = String(opt(i, 'message') ?? '').slice(0, 4000);
    return work(async () => { const r = await askMate(uid, { key: `discord-${duid}`, text, mate }); return `**${MATE[r.mate].name}**\n${r.text}`; });
  }
  if (name === 'run') {
    const task = String(opt(i, 'task') ?? '').slice(0, 4000);
    return work(async () => { const run = await deps.startRun(uid, { prompt: task, unattended: true }); return `Started run **${run.title}**. I will message you here when it finishes or needs approval.`; });
  }
  if (name === 'status') {
    return work(async () => {
      const live = deps.liveRuns(uid);
      const recent = (await userCol(uid, 'runs').limit(40).get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);
      return `**Active:** ${live.length ? live.map((r) => `${r.id} (${r.status})`).join(', ') : 'none'}\n**Recent:**\n${recent.map((r) => `- ${r.title} - ${r.status}${r.failure ? ` (failed at "${r.failure.step}")` : ''}`).join('\n') || 'none yet'}`;
    });
  }
  return say('Unknown command.');
}
