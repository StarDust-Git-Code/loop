// WhatsApp through Meta's official Cloud API: the owner chats with their Mates in WhatsApp, and notifications can
// land there. (The older bridge in api/whatsapp.js is separate: unofficial and read-only.)
// Meta calls a webhook, so this needs the server's public address (a named tunnel is best: quick-tunnel addresses
// change on restart). Every webhook is checked against the app secret. Free-form replies are only allowed within
// 24 hours of the owner's last message (Meta's rule), so a notification outside that window may not arrive.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, now } from '../lib/env.js';
import { db, userCol } from '../api/db.js';
import { bad, clip, http } from './util.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
export const waCloudReady = () => !!(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_ID') && env('WHATSAPP_APP_SECRET') && env('WHATSAPP_VERIFY_TOKEN'));

/** Meta signs the raw body: X-Hub-Signature-256: sha256=<hex HMAC with the app secret>. */
export function verifyMeta(raw, header, secret = env('WHATSAPP_APP_SECRET')) {
  if (!secret || !/^sha256=[0-9a-f]{64}$/.test(String(header ?? ''))) return false;
  const want = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex')); const got = Buffer.from(String(header).slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}
/** The GET handshake when the owner saves the webhook in Meta. Returns the challenge or null. */
export function verifyHandshake(q) {
  const tok = env('WHATSAPP_VERIFY_TOKEN');
  if (q?.['hub.mode'] !== 'subscribe' || !tok) return null;
  const a = Buffer.from(String(q['hub.verify_token'] ?? '')), b = Buffer.from(tok);
  return a.length === b.length && timingSafeEqual(a, b) ? String(q['hub.challenge'] ?? '') : null;
}

/** Markdown → WhatsApp formatting (*bold*, _italic_, links as "text (url)"). */
export const toWhatsApp = (md) => String(md ?? '').replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^#{1,6}\s+(.+)$/gm, '*$1*').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1 ($2)').replace(/^(\s*)[-*]\s+/gm, '$1• ');

export async function waSend(to, text) {
  return http('WhatsApp', `${GRAPH}/${env('WHATSAPP_PHONE_ID')}/messages`, { method: 'POST', headers: { authorization: `Bearer ${env('WHATSAPP_TOKEN')}` }, body: { messaging_product: 'whatsapp', to: String(to).replace(/\D/g, ''), type: 'text', text: { preview_url: false, body: clip(toWhatsApp(text), 4000) } } });
}

async function link(code, from) {
  const ref = db.collection('chatLinks').doc(String(code).toUpperCase()); const d = (await ref.get()).data();
  if (!d || d.provider !== 'wacloud' || d.exp < Date.now()) return 'That code expired or is not a WhatsApp code. Make a new one in Loopmates → Connections → WhatsApp.';
  await db.collection('waNumbers').doc(from).set({ uid: d.uid, at: now() });
  const col = userCol(d.uid, 'connections'); const cur = (await col.where('provider', '==', 'wacloud').get()).docs[0];
  await (cur ? cur.ref : col.doc()).set({ provider: 'wacloud', label: 'WhatsApp', status: 'connected', config: { number: from }, createdAt: cur?.data().createdAt ?? now(), updatedAt: now() }, { merge: true });
  await ref.delete();
  return 'Linked. Message me any time. Start with @name (e.g. "@chef plan dinners for the week") to ask a specific agent.';
}

const seen = new Set();
/** Handle one verified webhook body. Replies are sent here; the HTTP answer is always 200. */
export async function handleWaWebhook(body) {
  for (const entry of body?.entry ?? []) for (const ch of entry.changes ?? []) for (const m of ch.value?.messages ?? []) {
    if (!m?.from || seen.has(m.id)) continue; seen.add(m.id); if (seen.size > 1000) seen.clear();
    if (m.type !== 'text') { await waSend(m.from, 'I can read text messages only for now.').catch(() => {}); continue; }
    const text = String(m.text?.body ?? '').trim(); if (!text) continue;
    const lk = /^link\s+([A-Z0-9]{8})$/i.exec(text);
    if (lk) { await waSend(m.from, await link(lk[1], m.from)).catch(() => {}); continue; }
    const uid = (await db.collection('waNumbers').doc(m.from).get()).data()?.uid;
    if (!uid) { await waSend(m.from, 'This number is not linked to Loopmates. Open Loopmates → Connections → WhatsApp, get a code, and send "link CODE".').catch(() => {}); continue; }
    const at = /^@([a-z0-9]+)\s+([\s\S]+)$/i.exec(text);
    const { askMate } = await import('../api/bridge.js'); const { loadRoster } = await import('../api/roster.js');
    try {
      const r = await askMate(uid, { key: `whatsapp-${m.from}`, text: at ? at[2] : text, mate: at ? at[1].toLowerCase() : '' });
      await waSend(m.from, `*${(await loadRoster(uid)).name(r.mate)}*\n${r.text}`);
    } catch (e) { await waSend(m.from, `Something went wrong: ${clip(e.message, 200)}`).catch(() => {}); }
  }
}

export async function notifyWhatsApp(uid, text, opts = {}) {
  if (!waCloudReady()) return 0;
  const rows = (await userCol(uid, 'connections').where('provider', '==', 'wacloud').get().catch(() => ({ docs: [] }))).docs.map((d) => d.data()).filter((c) => c.status === 'connected' && c.config?.number);
  let n = 0;
  for (const c of rows) { try { await waSend(c.config.number, `${opts.title ? `*${opts.title}*\n` : ''}${text}${opts.url && /^https:\/\//.test(opts.url) ? `\n${opts.url}` : ''}`); n++; } catch { /* outside the 24 h window, or the number is gone */ } }
  return n;
}

export const wacloud = {
  key: 'wacloud', name: 'WhatsApp', badge: 'WA', group: 'Team Chat', bg: '#DFF3E3', fg: '#1E7A46',
  what: 'Chat with your Mates in WhatsApp through Meta\'s official Cloud API, and get notifications there. "@chef …" picks a Mate. Meta only allows free-form replies within 24 hours of your last message, so message the bot now and then to keep notifications flowing.',
  fields: [{ key: 'WHATSAPP_TOKEN', label: 'Access token (permanent, system user)' }, { key: 'WHATSAPP_PHONE_ID', label: 'Phone number ID' }, { key: 'WHATSAPP_APP_SECRET', label: 'App secret' }, { key: 'WHATSAPP_VERIFY_TOKEN', label: 'Webhook verify token (any long random text)' }],
  steps: [
    { title: 'Create a Meta app with WhatsApp', text: 'On developers.facebook.com → My Apps → Create App → Business, then add the WhatsApp product. Meta gives you a free test number; you can add your own number later. Under API Setup, add your personal number as a recipient.' },
    { title: 'Copy the values', text: 'Phone number ID: WhatsApp → API Setup. App secret: App settings → Basic. Access token: Business settings → System users → Generate token with whatsapp_business_messaging (the API Setup token expires in 24 hours). Make up a verify token.' },
    { title: 'Point the webhook at your server', text: 'WhatsApp → Configuration → Webhook: Callback URL is the address below, Verify token is the one you typed here. Then subscribe to the "messages" field. This needs a public address that does not change, so use a named Cloudflare tunnel.' },
    { title: 'Link your number', text: 'Get a link code here and send "link CODE" to the WhatsApp number from your phone.' },
  ],
  webhook: '/whatsapp/webhook',
  linkCode: 'wacloud',
  ready: waCloudReady, note: () => (waCloudReady() ? 'Set up (needs the webhook in Meta)' : 'Not set up'),
  test: async (uid) => {
    const p = await http('WhatsApp', `${GRAPH}/${env('WHATSAPP_PHONE_ID')}?fields=display_phone_number,verified_name`, { headers: { authorization: `Bearer ${env('WHATSAPP_TOKEN')}` } });
    const n = await notifyWhatsApp(uid, 'Loopmates test message: connected.');
    if (!p?.display_phone_number) throw bad('Meta did not return the phone number. Check the phone number ID and token.');
    return `Working: ${p.verified_name ?? ''} ${p.display_phone_number}.${n ? ' A test message was sent.' : ' Link your number (and message it once) to get messages.'}`;
  },
  tools: {},
};
