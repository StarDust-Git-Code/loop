import { userDoc } from './db.js';
import { now } from '../lib/env.js';
import { validTz } from '../lib/cron.js';

export const DEFAULT_SETTINGS = {
  displayName: '', email: '', workspaceName: 'My workspace', timezone: 'Asia/Kolkata', model: '',
  askBeforeRisky: true, maxSteps: 12, allowNetwork: true, stopAfterMinutes: 30, notifyTelegram: true, notifyEmail: false,
  permissionMode: 'ask', retriesOnFailure: 1, hookBeforeTool: '', hookAfterStep: '', hookOnFinish: '', hookOnFailure: '',
  guardContainer: true, guardPurchases: true, guardLog: true,
  chunkSize: 800, overlap: 100, topK: 5, hybrid: true, rerank: false, citeAlways: true, memoryScope: 'private',
  prefersShort: false, shareSchedule: false,
  maxContextTokens: 0, maxOutputTokens: 0, defaultThinking: 'high', showReasoning: true, // developer options: 0 = automatic
};
const ref = (uid) => userDoc(uid, 'meta', 'settings');

export async function getSettings(uid) {
  const d = await ref(uid).get();
  return { ...DEFAULT_SETTINGS, ...(d.exists ? d.data() : {}) };
}
export async function patchSettings(uid, patch) {
  const clean = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in patch && typeof patch[k] === typeof DEFAULT_SETTINGS[k]) clean[k] = patch[k];
  if (clean.timezone && !validTz(clean.timezone)) delete clean.timezone;
  const range = (k, lo, hi) => { if (k in clean) clean[k] = clean[k] === 0 ? 0 : Math.min(hi, Math.max(lo, Math.round(clean[k]))); };
  range('maxContextTokens', 1000, 2_000_000); range('maxOutputTokens', 64, 64_000);
  if (clean.defaultThinking && !['low', 'medium', 'high', 'xhigh'].includes(clean.defaultThinking)) delete clean.defaultThinking;
  await ref(uid).set({ ...clean, updatedAt: now() }, { merge: true });
  return getSettings(uid);
}
