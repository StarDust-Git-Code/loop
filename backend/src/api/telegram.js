// One Telegram bot (TELEGRAM_BOT_TOKEN), read with long polling, so it works behind any home router with no public URL.
// Linking: dashboard asks for a code -> user sends "/start CODE" to the bot -> the chat is saved on a `connections` doc.
import { joinTelegram, employeeOf, employeeMessage } from './company.js';
import { randomBytes } from 'node:crypto';
import { env, now } from '../lib/env.js';
import { db, userCol } from './db.js';
import { askMate } from './bridge.js';
import { loadRoster } from './roster.js';

const tg = (method, body) => fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) }).then((r) => r.json());
export const telegramReady = () => !!env('TELEGRAM_BOT_TOKEN');
export const botInfo = () => tg('getMe', {});

export async function send(chatId, text, buttons) {
  if (!telegramReady()) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const markup = buttons?.length ? { reply_markup: { inline_keyboard: [buttons.slice(0, 4).map((b) => ({ text: String(b.label).slice(0, 60), callback_data: String(b.data).slice(0, 64) }))] } } : {};
  const r = await tg('sendMessage', { chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true, ...markup });
  if (!r.ok) throw new Error(`Telegram: ${r.description ?? 'send failed'}`);
}

/** Chat ids linked for this user (connections with provider=telegram and a chatId). */
async function linkedChats(uid) {
  const snap = await userCol(uid, 'connections').where('provider', '==', 'telegram').get();
  return snap.docs.map((d) => d.data().config?.chatId).filter(Boolean);
}

/** Best-effort push to every linked chat. opts.buttons adds tap-to-answer buttons. Returns how many were sent. */
export async function notify(uid, text, opts = {}) {
  if (!telegramReady()) return 0;
  let n = 0;
  const link = opts.url && /^https:\/\//.test(opts.url) ? `
${opts.url}` : '';
  for (const id of await linkedChats(uid)) { try { await send(id, text + link, opts.buttons); n++; } catch { /* chat may have blocked the bot */ } }
  return n;
}

export async function linkCode(uid, connectionId) {
  const code = randomBytes(4).toString('hex').toUpperCase();
  await db.collection('telegramLinks').doc(code).set({ uid, connectionId: connectionId ?? null, exp: Date.now() + 15 * 60_000 });
  const me = telegramReady() ? await botInfo().catch(() => null) : null;
  return { code, bot: me?.result?.username ? `@${me.result.username}` : null, expiresInMinutes: 15 };
}

/** Set by ask.js: answers a tap on an ask_owner button ("ask:<id>:<n>"). */
let onAnswer = null;
export const setAnswerHandler = (fn) => { onAnswer = fn; };

export async function handleUpdate(update) {
  const cq = update?.callback_query;
  if (cq) {
    const chatId = String(cq.message?.chat?.id ?? '');
    const uid = (await db.collection('telegramChats').doc(chatId).get()).data()?.uid;
    const out = uid && onAnswer ? await onAnswer(uid, String(cq.data ?? '')).catch((e) => e.message) : 'This chat is not linked.';
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: String(out).slice(0, 190) }).catch(() => {});
    if (uid && cq.message) await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    return;
  }
  const m = update?.message;
  if (!m?.text) return;
  const chatId = String(m.chat.id);
  const text = m.text.trim();
  const join = /^\/(?:join|start)(?:@\w+)?\s+([A-F0-9]{8})$/i.exec(text);
  if (join && (await db.collection('employeeInvites').doc(join[1].toUpperCase()).get()).exists) return send(chatId, await joinTelegram(join[1], chatId, m.from?.username ?? ''));
  const start = /^\/start(?:@\w+)?\s+([A-Z0-9]{8})$/i.exec(text);
  if (start) {
    const ref = db.collection('telegramLinks').doc(start[1].toUpperCase());
    const d = await ref.get();
    if (!d.exists || d.data().exp < Date.now()) return send(chatId, 'That code expired. Make a new one in Loopmates > Connections.');
    const { uid, connectionId } = d.data();
    const col = userCol(uid, 'connections');
    const ref2 = connectionId ? col.doc(connectionId) : col.doc();
    const cur = (await ref2.get()).data() ?? {};
    await ref2.set({ provider: 'telegram', label: cur.label || 'Telegram', ...cur, status: 'connected', config: { ...(cur.config ?? {}), chatId, username: m.from?.username ?? '' }, createdAt: cur.createdAt ?? now(), updatedAt: now() }, { merge: true });
    await db.collection('telegramChats').doc(chatId).set({ uid, linkedAt: now() });
    await ref.delete();
    return send(chatId, 'Linked. Reminders and run updates will arrive here. Send me a message any time.');
  }
  // Only linked chats may talk to the LLM (otherwise anyone who finds the bot spends your quota).
  const uid = (await db.collection('telegramChats').doc(chatId).get()).data()?.uid;
  if (!uid) { // an employee who joined with an invite: restricted handler only (no tools, no owner memory)
    const emp = await employeeOf(chatId);
    if (emp) return send(chatId, await employeeMessage(emp.uid, emp.personId, text).catch(() => 'Something went wrong. Please try again later.'));
  }
  if (text.startsWith('/')) return send(chatId, 'Send me any message and your leader agent will reply. Start with @name (for example "@research best e-bikes under 1 lakh") to ask a specific agent. Use /start CODE to link this chat.');
  if (!uid) return send(chatId, 'This chat is not linked yet. Open Loopmates > Connections → Telegram and send me the /start code.');
  tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
  // "@research ..." picks an agent, like @mentions in the dashboard. Unknown or switched-off names fall back to the leader.
  const at = /^@([a-z0-9]+)\s+([\s\S]+)$/i.exec(text);
  const r = await askMate(uid, { key: `telegram-${chatId}`, text: at ? at[2] : text, mate: at ? at[1].toLowerCase() : '' });
  // Sign every reply with the agent's name, so the owner can tell who answered (Discord already does this).
  return send(chatId, `${(await loadRoster(uid)).name(r.mate)}:\n${r.text}`);
}


/* ------------------------------------------------------------------ long polling (no public URL needed) */
let poll = null;
/** Ask Telegram for new messages in a loop (getUpdates with a 50 s wait). Removes any old webhook first. */
export function startPolling(log) {
  if (poll || !telegramReady()) return;
  const me = { stop: false, offset: 0 }; poll = me;
  void (async () => {
    await tg('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
    while (!me.stop && telegramReady()) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/getUpdates`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offset: me.offset, timeout: 50, allowed_updates: ['message', 'callback_query'] }), signal: AbortSignal.timeout(65_000) }).then((x) => x.json());
        if (!r.ok) { if (r.error_code === 401) { log?.warn?.('telegram: the bot token was rejected'); break; } await new Promise((s) => setTimeout(s, 5000)); continue; }
        for (const u of r.result ?? []) { me.offset = u.update_id + 1; handleUpdate(u).catch((e) => log?.error?.(e)); }
      } catch { await new Promise((s) => setTimeout(s, 5000)); }
    }
    if (poll === me) poll = null;
  })();
}
export function stopPolling() { if (poll) { poll.stop = true; poll = null; } }
export const pollingStatus = () => (poll ? 'polling' : 'off');
