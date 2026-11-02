// Envelope encryption for secrets (provider API keys, connection tokens).
// Each secret gets its own random data key (DEK). The DEK is wrapped with MASTER_KEY (AES-256-GCM).
// AAD binds the ciphertext to its owner (uid + label), so a copied blob will not decrypt elsewhere.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { need } from './env.js';

let master;
const mk = () => (master ??= (() => {
  const b = Buffer.from(need('MASTER_KEY'), 'base64');
  if (b.length !== 32) throw new Error('MASTER_KEY must be 32 bytes, base64-encoded');
  return b;
})());

const gcm = (key, iv, aad, data, decrypt, tag) => {
  const c = decrypt ? createDecipheriv('aes-256-gcm', key, iv) : createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(aad));
  if (decrypt) c.setAuthTag(tag);
  const out = Buffer.concat([c.update(data), c.final()]);
  return decrypt ? out : { out, tag: c.getAuthTag() };
};

export function seal(plain, aad) {
  const dek = randomBytes(32), iv = randomBytes(12), wiv = randomBytes(12);
  const body = gcm(dek, iv, aad, Buffer.from(plain, 'utf8'), false);
  const wrapped = gcm(mk(), wiv, aad, dek, false);
  const b64 = (b) => b.toString('base64');
  return { v: 1, ct: b64(body.out), iv: b64(iv), tag: b64(body.tag), dek: b64(wrapped.out), wiv: b64(wiv), wtag: b64(wrapped.tag) };
}

export function open(blob, aad) {
  const f = (s) => Buffer.from(s, 'base64');
  const dek = gcm(mk(), f(blob.wiv), aad, f(blob.dek), true, f(blob.wtag));
  return gcm(dek, f(blob.iv), aad, f(blob.ct), true, f(blob.tag)).toString('utf8');
}

export const hint = (s) => (s && s.length > 8 ? `••••${s.slice(-4)}` : s ? '••••' : '');
