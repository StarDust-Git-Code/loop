// Browser side of a voice call: mic -> 16 kHz PCM16 over a WebSocket, and 24 kHz PCM16 back out of the speakers.
import { idToken } from './auth';

export const VOICE_URL = process.env.NEXT_PUBLIC_VOICE_URL ?? '';
export type CallEvent = { type: 'ready'; name: string } | { type: 'transcript'; who: 'you' | 'mate'; text: string } | { type: 'interrupted' | 'turn' } | { type: 'error'; message: string } | { type: 'end'; why: string };

const WORKLET = `class Cap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; this.pos = 0; }
  process(inputs) {
    const ch = inputs[0][0]; if (!ch) return true;
    const ratio = sampleRate / 16000;
    for (let i = 0; i < ch.length; i++) { this.pos += 1; if (this.pos >= ratio) { this.pos -= ratio; this.buf.push(ch[i]); } }
    if (this.buf.length >= 1600) { const out = new Int16Array(this.buf.length); for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, this.buf[i])) * 32767; this.port.postMessage(out.buffer, [out.buffer]); this.buf = []; }
    return true;
  }
}
registerProcessor('cap', Cap);`;

export type CallHandle = { hangup(): void; mute(on: boolean): void; level(): number };

export async function startCall(mate: string, reason: string, on: (e: CallEvent) => void): Promise<CallHandle> {
  if (!VOICE_URL) throw new Error('Voice is not set up yet (NEXT_PUBLIC_VOICE_URL is missing).');
  const token = await idToken();
  const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const ac = new AudioContext(); await ac.resume();
  const url = new URL('/live', VOICE_URL.replace(/^http/, 'ws'));
  url.searchParams.set('mate', mate); if (token) url.searchParams.set('token', token); if (reason) url.searchParams.set('reason', reason); else url.searchParams.set('greet', '1');
  const ws = new WebSocket(url); ws.binaryType = 'arraybuffer';
  let muted = false, playAt = 0, peak = 0; const playing = new Set<AudioBufferSourceNode>();
  const stopPlayback = () => { for (const s of playing) { try { s.stop(); } catch { /* already ended */ } } playing.clear(); playAt = 0; };
  await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })));
  const src = ac.createMediaStreamSource(media); const node = new AudioWorkletNode(ac, 'cap'); src.connect(node);
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    const pcm = new Int16Array(e.data); let p = 0; for (let i = 0; i < pcm.length; i += 16) p = Math.max(p, Math.abs(pcm[i]));
    peak = p / 32767; if (!muted && ws.readyState === WebSocket.OPEN) ws.send(e.data);
  };
  ws.onmessage = (m) => {
    if (typeof m.data === 'string') { const ev = JSON.parse(m.data) as CallEvent; if (ev.type === 'interrupted') stopPlayback(); on(ev); return; }
    const pcm = new Int16Array(m.data as ArrayBuffer); const buf = ac.createBuffer(1, pcm.length, 24000); const f = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    const s = ac.createBufferSource(); s.buffer = buf; s.connect(ac.destination); playing.add(s); s.onended = () => playing.delete(s);
    playAt = Math.max(playAt, ac.currentTime + 0.05); s.start(playAt); playAt += buf.duration;
  };
  const cleanup = () => { stopPlayback(); media.getTracks().forEach((t) => t.stop()); void ac.close(); };
  ws.onclose = () => { cleanup(); on({ type: 'end', why: 'closed' }); };
  ws.onerror = () => on({ type: 'error', message: 'Could not reach the voice server. It may be waking up; try again in a minute.' });
  return { hangup: () => { try { ws.send(JSON.stringify({ type: 'end' })); } catch { /* socket closed */ } ws.close(); }, mute: (v) => { muted = v; }, level: () => peak };
}
