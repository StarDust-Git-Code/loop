export const env = (k, d = '') => (process.env[k] ?? d).trim();
export const need = (k) => { const v = env(k); if (!v) throw new Error(`Missing required env var ${k}`); return v; };
export const num = (k, d) => { const n = Number(env(k)); return Number.isFinite(n) && n > 0 ? n : d; };
export const now = () => new Date().toISOString();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
