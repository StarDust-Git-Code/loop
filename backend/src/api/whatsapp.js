// WhatsApp bridge (optional, experimental, unofficial). READ-ONLY by design: it lists chats and keeps the latest messages
// of the chats you tick. It never sends. Session is stored in Firestore (single doc, debounced) because Render has no disk.
import { env, now } from '../lib/env.js';
import { db } from './db.js';

const docRef = () => db.collection('system').doc('whatsapp');
export const waEnabled = () => env('WHATSAPP_ENABLED') === '1';
const state = { status: 'off', pairing: null, error: '' };
const chats = new Map();      // jid -> { id, name, meta }
const recent = new Map();     // jid -> [{ at, from, text }]
let sock;

export const waStatus = () => ({ ...state, chats: chats.size });
export const waChats = () => [...chats.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 300);
export const waRecent = (jid) => (recent.get(jid) ?? []).slice(-30);

async function loadAuth(B) {
  const d = (await docRef().get()).data();
  const creds = d?.creds ? JSON.parse(d.creds, B.BufferJSON.reviver) : B.initAuthCreds();
  const keys = d?.keys ? JSON.parse(d.keys, B.BufferJSON.reviver) : {};
  let timer;
  const persist = () => { clearTimeout(timer); timer = setTimeout(() => docRef().set({ creds: JSON.stringify(creds, B.BufferJSON.replacer), keys: JSON.stringify(keys, B.BufferJSON.replacer), at: now() }).catch(() => {}), 5000); };
  const store = {
    get: async (type, ids) => Object.fromEntries(ids.map((id) => [id, keys[`${type}:${id}`]]).filter(([, v]) => v !== undefined)),
    set: async (data) => { for (const [type, m] of Object.entries(data)) for (const [id, v] of Object.entries(m)) { if (v) keys[`${type}:${id}`] = v; else delete keys[`${type}:${id}`]; } persist(); },
  };
  return { creds, store, persist };
}

export async function startWhatsApp({ phone } = {}) {
  if (!waEnabled()) throw Object.assign(new Error('WhatsApp is disabled. Set WHATSAPP_ENABLED=1 on the API service.'), { statusCode: 501 });
  if (sock && state.status === 'open') return waStatus();
  let B;
  try { B = await import('@whiskeysockets/baileys'); } catch { throw Object.assign(new Error('Baileys is not installed on this deploy.'), { statusCode: 501 }); }
  const makeWASocket = B.default?.default ?? B.default ?? B.makeWASocket;
  const quiet = { level: 'silent', trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {}, child() { return quiet; } };
  const { creds, store, persist } = await loadAuth(B);
  state.status = 'connecting'; state.error = '';
  sock = makeWASocket({ auth: { creds, keys: B.makeCacheableSignalKeyStore(store, quiet) }, logger: quiet, printQRInTerminal: false, browser: B.Browsers.ubuntu('Loopmates'), syncFullHistory: false, markOnlineOnConnect: false });
  sock.ev.on('creds.update', persist);
  sock.ev.on('chats.upsert', (list) => list.forEach((c) => chats.set(c.id, { id: c.id, name: c.name || c.id.split('@')[0], meta: c.id.endsWith('@g.us') ? 'Group' : 'Chat' })));
  sock.ev.on('contacts.upsert', (list) => list.forEach((c) => { if (c.id && (c.name || c.notify)) chats.set(c.id, { id: c.id, name: c.name || c.notify, meta: 'Contact' }); }));
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages ?? []) {
      const jid = m.key?.remoteJid; const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
      if (!jid || !text || jid === 'status@broadcast') continue;
      if (!chats.has(jid)) chats.set(jid, { id: jid, name: m.pushName || jid.split('@')[0], meta: jid.endsWith('@g.us') ? 'Group' : 'Chat' });
      const arr = recent.get(jid) ?? []; arr.push({ at: now(), from: m.key.fromMe ? 'me' : m.pushName || 'them', text: text.slice(0, 1000) });
      recent.set(jid, arr.slice(-50));
    }
  });
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') { state.status = 'open'; state.pairing = null; }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      state.status = 'closed';
      if (code === B.DisconnectReason.loggedOut) { docRef().delete().catch(() => {}); state.error = 'Logged out from the phone. Pair again.'; }
      else setTimeout(() => startWhatsApp().catch(() => {}), 5000).unref();
    }
  });
  if (!creds.registered) {
    if (!phone) { state.status = 'needs-pairing'; return waStatus(); }
    await new Promise((r) => setTimeout(r, 2500));
    state.pairing = await sock.requestPairingCode(String(phone).replace(/\D/g, ''));
    state.status = 'pairing';
  }
  return waStatus();
}

/** Called on boot: reconnect only when a saved session exists. */
export async function resumeWhatsApp() {
  if (!waEnabled()) return;
  if ((await docRef().get()).exists) await startWhatsApp().catch((e) => { state.error = e.message; });
}
