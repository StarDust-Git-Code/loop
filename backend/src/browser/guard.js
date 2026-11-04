// Which hosts a browser page may reach: public internet only (never the VM's own network).
import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../lib/env.js';

export const ALLOW_PRIVATE = env('BROWSER_ALLOW_PRIVATE') === '1';
export const privateIp = (ip) => {
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || (l.startsWith('::ffff:') && privateIp(l.slice(7))); }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};
const cache = new Map();
export async function allowedHost(host) {
  if (ALLOW_PRIVATE) return true;
  const hit = cache.get(host); if (hit && Date.now() - hit.at < 60_000) return hit.ok;
  let ok = false;
  try {
    if (net.isIP(host)) ok = !privateIp(host);
    else if (!/^(localhost|.*\.local|.*\.internal)$/i.test(host)) { const addrs = await dns.lookup(host, { all: true }); ok = addrs.length > 0 && addrs.every((a) => !privateIp(a.address)); }
  } catch { ok = false; }
  cache.set(host, { ok, at: Date.now() }); if (cache.size > 2000) cache.clear();
  return ok;
}
export const urlAllowed = async (href) => { try { const u = new URL(href); if (['about:', 'data:', 'blob:'].includes(u.protocol)) return true; return ['http:', 'https:'].includes(u.protocol) && await allowedHost(u.hostname.replace(/^\[|\]$/g, '')); } catch { return false; } };
export const bad = (m, c = 400) => Object.assign(new Error(m), { statusCode: c });
export const normalizeUrl = (raw) => { let u; try { u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw bad('That is not a valid address'); } if (!['http:', 'https:'].includes(u.protocol)) throw bad('Only http and https pages can be opened'); return u; };
export const isSecretField = (kind) => /password/i.test(kind) || /cc-|one-time-code/i.test(kind);
