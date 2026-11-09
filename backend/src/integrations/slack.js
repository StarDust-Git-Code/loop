// Slack over Socket Mode: the server connects OUT to Slack (no public address), like the Discord Gateway.
// The owner DMs the bot or @mentions it in a channel; the right Mate answers under its own name and mascot
// (chat:write.customize). "@research …" picks a Mate. Linking: Connections → Slack → code → DM "link CODE".
// Agents can also read channels the bot was added to, and post (with the owner's approval).
import WebSocket from 'ws';
import { env, now } from '../lib/env.js';
import { db, userCol } from '../api/db.js';
import { bad, str, clip, data, http, toMrkdwn, dashboardUrl } from './util.js';

export const slackReady = () => !!(env('SLACK_BOT_TOKEN') && env('SLACK_APP_TOKEN'));
const api = async (method, body = {}, token = env('SLACK_BOT_TOKEN')) => {
  const j = await http('Slack', `https://slack.com/api/${method}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' }, body });
  if (!j?.ok) throw bad(`Slack: ${j?.error ?? 'request failed'}${j?.needed ? ` (needs the ${j.needed} scope)` : ''}`);
  return j;
};

const state = { status: 'off', error: '', botId: '', team: '' };
let ws = null, stopped = true, backoff = 2000; const seen = new Map();
export const slackStatus = () => state.status;

/** Post as a Mate: its name and mascot picture, Slack formatting. */
export async function postAs(channel, text, { name = 'Loopmates', avatar = '', thread } = {}) {
  const site = dashboardUrl(env);
  return api('chat.postMessage', { channel, text: clip(toMrkdwn(text), 39_000), username: name, ...(site && avatar ? { icon_url: `${site}/dots/${avatar}.png` } : {}), ...(thread ? { thread_ts: thread } : {}), unfurl_links: false });
}

async function link(code, team, user, channel) {
  const ref = db.collection('chatLinks').doc(String(code).toUpperCase()); const d = (await ref.get()).data();
  if (!d || d.provider !== 'slack' || d.exp < Date.now()) return 'That code expired or is not a Slack code. Make a new one in Loopmates → Connections → Slack.';
  await db.collection('slackUsers').doc(`${team}_${user}`).set({ uid: d.uid, channel, at: now() });
  const col = userCol(d.uid, 'connections'); const cur = (await col.where('provider', '==', 'slack').get()).docs[0];
  await (cur ? cur.ref : col.doc()).set({ provider: 'slack', label: 'Slack', status: 'connected', config: { team, user, channel }, createdAt: cur?.data().createdAt ?? now(), updatedAt: now() }, { merge: true });
  await ref.delete();
  return 'Linked. DM me any time, or @mention me in a channel. Start with @name (e.g. "@research …") to ask a specific agent.';
}

async function onEvent(e, teamId) {
  if (!e || e.bot_id || e.subtype || !e.text || !e.user) return;
  const isDm = e.channel_type === 'im'; if (!isDm && e.type !== 'app_mention') return;
  const key = e.client_msg_id || `${e.channel}:${e.ts}`; if (seen.has(key)) return; seen.set(key, Date.now()); if (seen.size > 500) for (const [k, t] of seen) if (Date.now() - t > 600_000) seen.delete(k);
  const text = e.text.replace(/<@[A-Z0-9]+>/g, '').trim(); const thread = isDm ? undefined : e.thread_ts || e.ts;
  const m = /^link\s+([A-Z0-9]{8})$/i.exec(text);
  if (m) return void postAs(e.channel, await link(m[1], teamId, e.user, e.channel), { thread }).catch(() => {});
  const uid = (await db.collection('slackUsers').doc(`${teamId}_${e.user}`).get()).data()?.uid;
  if (!uid) return void postAs(e.channel, 'This Slack account is not linked yet. Open Loopmates → Connections → Slack, get a code, and send me "link CODE".', { thread }).catch(() => {});
  const at = /^@([a-z0-9]+)\s+([\s\S]+)$/i.exec(text);
  const { askMate } = await import('../api/bridge.js'); const { loadRoster } = await import('../api/roster.js');
  try {
    const r = await askMate(uid, { key: `slack-${teamId}-${e.user}`, text: at ? at[2] : text, mate: at ? at[1].toLowerCase() : '' });
    const ro = await loadRoster(uid);
    await postAs(e.channel, r.text, { name: ro.name(r.mate), avatar: ro.byKey[r.mate]?.avatar ?? r.mate, thread });
  } catch (err) { await postAs(e.channel, `Something went wrong: ${clip(err.message, 200)}`, { thread }).catch(() => {}); }
}

async function connect(log) {
  if (stopped) return;
  try {
    state.status = 'connecting';
    const j = await api('apps.connections.open', {}, env('SLACK_APP_TOKEN'));
    const auth = await api('auth.test').catch(() => null); state.botId = auth?.user_id ?? ''; state.team = auth?.team ?? '';
    ws = new WebSocket(j.url);
    ws.on('open', () => { state.status = 'connected'; state.error = ''; backoff = 2000; log?.info?.('slack: connected'); });
    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.envelope_id) ws.send(JSON.stringify({ envelope_id: msg.envelope_id })); // ack within 3 s, then work
      if (msg.type === 'disconnect') { try { ws.close(); } catch { /* reconnect below */ } return; }
      if (msg.type === 'events_api') void onEvent(msg.payload?.event, msg.payload?.team_id ?? '').catch((e) => log?.warn?.(`slack: ${e.message}`));
    });
    ws.on('close', () => { state.status = stopped ? 'off' : 'reconnecting'; ws = null; if (!stopped) setTimeout(() => connect(log), backoff).unref(); backoff = Math.min(backoff * 2, 60_000); });
    ws.on('error', (e) => { state.error = e.message; });
  } catch (e) {
    state.status = 'error'; state.error = e.message; log?.warn?.(`slack: ${e.message}`);
    if (!stopped) setTimeout(() => connect(log), backoff).unref(); backoff = Math.min(backoff * 2, 300_000);
  }
}
export function startSlack(log) { if (!slackReady()) return; stopped = false; if (!ws) void connect(log); }
export function stopSlack() { stopped = true; try { ws?.close(); } catch { /* ignore */ } ws = null; state.status = 'off'; }

/** Notify the owner in their Slack DM. Returns how many were sent. */
export async function notifySlack(uid, text, opts = {}) {
  if (!slackReady()) return 0;
  const rows = (await userCol(uid, 'connections').where('provider', '==', 'slack').get().catch(() => ({ docs: [] }))).docs.map((d) => d.data()).filter((c) => c.status === 'connected' && c.config?.channel);
  let n = 0;
  for (const c of rows) { try { await postAs(c.config.channel, `${opts.title ? `*${opts.title}*\n` : ''}${text}${opts.url && /^https:\/\//.test(opts.url) ? `\n${opts.url}` : ''}`, { name: opts.title?.split(':')[0] || 'Loopmates', avatar: opts.avatar ?? '' }); n++; } catch { /* channel gone */ } }
  return n;
}

const chanId = async (v) => {
  const s = str(v, 100).replace(/^#/, '').trim(); if (/^[CGD][A-Z0-9]{8,}$/.test(s)) return s;
  const j = await api('conversations.list', { limit: 500, exclude_archived: true, types: 'public_channel,private_channel' });
  const c = j.channels.find((x) => x.name === s.toLowerCase()); if (!c) throw bad(`No channel #${s} (or the bot was not added to it)`); return c.id;
};
const SLACK_TOOLS = {
  slack_channels: { group: 'Team Chat', ready: slackReady, desc: 'List the Slack channels the Loopmates bot can see (and whether it is a member, which reading needs).', args: '{}', run: async () => {
    const j = await api('conversations.list', { limit: 300, exclude_archived: true, types: 'public_channel,private_channel' });
    return j.channels.map((c) => `- #${c.name} | ${c.id} | ${c.is_member ? 'member' : 'not a member (invite the bot to read it)'}${c.topic?.value ? ` | ${clip(c.topic.value, 60)}` : ''}`).join('\n') || 'No channels.';
  } },
  slack_read: { group: 'Team Chat', ready: slackReady, desc: 'Read the latest messages in a Slack channel the bot is a member of.', args: '{"channel": "#name or id", "limit?": 20}', run: async (_c, a) => {
    const id = await chanId(a.channel);
    const j = await api('conversations.history', { channel: id, limit: Math.min(Number(a.limit) || 20, 50) });
    const users = new Map(); const who = async (u) => { if (!u) return 'bot'; if (!users.has(u)) users.set(u, (await api('users.info', { user: u }).catch(() => null))?.user?.real_name ?? u); return users.get(u); };
    const rows = []; for (const m of (j.messages ?? []).reverse()) rows.push(`${new Date(Number(m.ts) * 1000).toISOString().slice(0, 16).replace('T', ' ')} ${await who(m.user)}: ${clip(m.text, 400)}`);
    return data(`Slack #${str(a.channel, 60).replace(/^#/, '')}`, rows.join('\n') || '(no messages)');
  } },
  slack_post: { group: 'Team Chat', ready: slackReady, write: true, needsApproval: true, desc: 'Post a message to a Slack channel, as you (your name and mascot). This speaks to other people: only when the owner asked for it.', args: '{"channel": "#name or id", "text": "message", "thread?": "thread ts to reply in"}', run: async (c, a) => {
    const id = await chanId(a.channel); const { loadRoster } = await import('../api/roster.js'); const ro = await loadRoster(c.uid);
    await postAs(id, str(a.text, 8000), { name: ro.name(c.mate ?? ro.leader), avatar: ro.byKey[c.mate]?.avatar ?? c.mate, thread: a.thread ? str(a.thread, 40) : undefined });
    return `Posted to ${str(a.channel, 60)}.`;
  } },
};

export const SLACK_MANIFEST = {
  display_information: { name: 'Loopmates', description: 'Your Loopmates agents in Slack', background_color: '#2F6BFF' },
  features: { app_home: { messages_tab_enabled: true, messages_tab_read_only_enabled: false }, bot_user: { display_name: 'Loopmates', always_online: true } },
  oauth_config: { scopes: { bot: ['app_mentions:read', 'channels:history', 'channels:read', 'groups:history', 'groups:read', 'chat:write', 'chat:write.customize', 'im:history', 'im:read', 'im:write', 'users:read'] } },
  settings: { event_subscriptions: { bot_events: ['app_mention', 'message.im'] }, interactivity: { is_enabled: false }, socket_mode_enabled: true, token_rotation_enabled: false },
};

export const slack = {
  key: 'slack', name: 'Slack', badge: 'SL', group: 'Team Chat', bg: '#F4E8F6', fg: '#611F69',
  what: 'DM your agents in Slack or @mention them in a channel. Each Mate answers under its own name and mascot, "@research …" picks one, and notifications can land in your Slack DM. Agents can read channels you add the bot to, and post only with your approval.',
  fields: [{ key: 'SLACK_BOT_TOKEN', label: 'Bot token', placeholder: 'xoxb-…' }, { key: 'SLACK_APP_TOKEN', label: 'App-level token', placeholder: 'xapp-…' }],
  steps: [
    { title: 'Create the app from a manifest', text: 'On api.slack.com/apps → Create New App → From an app manifest → pick your workspace → paste the manifest below. It turns on Socket Mode, so your server connects out and needs no public address.' },
    { title: 'Copy the two tokens', text: 'Basic Information → App-Level Tokens → Generate Token with the connections:write scope (xapp-…). Then Install App → Install to workspace, and copy the Bot User OAuth Token (xoxb-…).' },
    { title: 'Link your Slack account', text: 'Get a link code here, open the Loopmates app in Slack (Apps → Loopmates → Messages) and send "link CODE".' },
  ],
  manifest: SLACK_MANIFEST,
  linkCode: 'slack',
  ready: slackReady, note: () => (slackReady() ? `${state.status}${state.team ? ` (${state.team})` : ''}${state.error ? `: ${state.error}` : ''}` : 'Not set up'),
  test: async (uid) => {
    const a = await api('auth.test');
    const sent = await notifySlack(uid, 'Loopmates test message: connected.', { title: 'Loopmates' });
    return `Working as ${a.user} in ${a.team}.${sent ? ' A test message was sent to your DM.' : ' Link your Slack account to get messages.'}`;
  },
  tools: SLACK_TOOLS,
};
