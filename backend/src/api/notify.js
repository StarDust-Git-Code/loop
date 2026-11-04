// One notifier for every linked channel (Telegram, Discord). Returns how many deliveries succeeded.
import { notify as tg } from './telegram.js';
import { notify as dc } from './discord.js';
export async function notify(uid, text) {
  const r = await Promise.allSettled([tg(uid, text), dc(uid, text)]);
  return r.reduce((n, x) => n + (x.status === 'fulfilled' ? x.value : 0), 0);
}
