// Voice preview for Agents → Configure: one short line in the chosen Gemini voice, spoken in the Mate's own style,
// returned as a WAV file. Uses Gemini text-to-speech (same GEMINI_API_KEY as calls). Cached in memory per voice+Mate.
import { env } from '../lib/env.js';

const cache = new Map(); const MAX = 60;

/** 16-bit mono PCM → a WAV file. */
export function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** The line to speak: who the Mate is, in the tone its card describes. */
export function sampleLine(name, blurb, card = '') {
  const tone = /^Voice(?: \(set by the owner[^)]*\))?:\s*([^.\n]+)/m.exec(card)?.[1]?.trim() || 'friendly and clear';
  return { style: tone, text: `Hi, I'm ${name}. ${String(blurb || '').replace(/\s+/g, ' ').slice(0, 140)} Call me whenever you need me.` };
}

export async function previewVoice({ voice, name, blurb, card }) {
  const key = env('GEMINI_API_KEY'); if (!key) throw Object.assign(new Error('Voice previews need a Gemini API key on your server (the same one voice calls use).'), { statusCode: 501 });
  const { style, text } = sampleLine(name, blurb, card);
  const id = `${voice}|${name}|${style}`; if (cache.has(id)) return cache.get(id);
  const model = env('TTS_MODEL', 'gemini-2.5-flash-preview-tts');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ contents: [{ parts: [{ text: `Say this in a voice that is ${style}: ${text}` }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
  });
  const j = await r.json().catch(() => ({}));
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!r.ok || !part) throw Object.assign(new Error(`Gemini could not make the preview: ${j.error?.message ?? r.status}`), { statusCode: 502 });
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? '')?.[1]) || 24000;
  const out = wav(Buffer.from(part.inlineData.data, 'base64'), rate);
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(id, out);
  return out;
}
