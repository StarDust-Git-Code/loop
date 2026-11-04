// One Telegram bot (TELEGRAM_BOT_TOKEN), webhook-driven so an incoming message wakes the sleeping service.
// Linking: dashboard asks for a code -> user sends "/start CODE" to the bot -> the chat is saved on a `connections` doc.
import { randomBytes } from 'node:crypto';
import { env, now } from '../lib/env.js';
import { db, userCol } from './db.js';
import { askMate } from './bridge.js';

const tg = (method, body) => fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) }).then((r) => r.json());
export const telegramReady = () => !!env('TELEGRAM_BOT_TOKEN');
export const botInfo = () => tg('getMe', {});

export async function send(chatId, text) {
  if (!telegramReady()) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const r = await tg('sendMessage', { chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true });
  if (!r.ok) throw new Error(`Telegram: ${r.description ?? 'send failed'}`);
}

/** Chat ids linked for this user (connections with provider=telegram and a chatId). */
async function linkedChats(uid) {
  const snap = await userCol(uid, 'connections').where('provider', '==', 'telegram').get();
  return snap.docs.map((d) => d.data().config?.chatId).filter(Boolean);
}

/** Best-effort push to every linked chat. Returns how many were sent. */
export async function notify(uid, text) {
  if (!telegramReady()) return 0;
  let n = 0;
  for (const id of await linkedChats(uid)) { try { await send(id, text); n++; } catch { /* chat may have blocked the bot */ } }
  return n;
}

export async function linkCode(uid, connectionId) {
  const code = randomBytes(4).toString('hex').toUpperCase();
  await db.collection('telegramLinks').doc(code).set({ uid, connectionId: connectionId ?? null, exp: Date.now() + 15 * 60_000 });
  const me = telegramReady() ? await botInfo().catch(() => null) : null;
  return { code, bot: me?.result?.username ? `@${me.result.username}` : null, expiresInMinutes: 15 };
}

export async function handleUpdate(update) {
  const m = update?.message;
  if (!m?.text) return;
  const chatId = String(m.chat.id);
  const text = m.text.trim();
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
  if (text.startsWith('/')) return send(chatId, 'Send me any message and your Mimo mate will reply. Use /start CODE to link this chat.');
  // Only linked chats may talk to the LLM (otherwise anyone who finds the bot spends your quota).
  const uid = (await db.collection('telegramChats').doc(chatId).get()).data()?.uid;
  if (!uid) return send(chatId, 'This chat is not linked yet. Open Loopmates > Connections → Telegram and send me the /start code.');
  tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
  const r = await askMate(uid, { key: `telegram-${chatId}`, text });
  return send(chatId, r.text);
}

/** Register the webhook (called by the deploy script and on boot when PUBLIC_URL is known). */
export async function setWebhook(publicUrl) {
  return tg('setWebhook', { url: `${publicUrl.replace(/\/$/, '')}/telegram/webhook/${env('TELEGRAM_WEBHOOK_SECRET')}`, allowed_updates: ['message'], drop_pending_updates: false });
}
