// Phone side of a voice call: microphone -> 16 kHz PCM16 over a WebSocket, and 24 kHz PCM16 back out of the speaker.
import { AudioContext, AudioManager, AudioRecorder } from 'react-native-audio-api';
import { getVoiceUrl } from './api';
import { idToken } from './auth';

export type CallEvent =
  | { type: 'ready'; name: string } | { type: 'transcript'; who: 'you' | 'mate'; text: string }
  | { type: 'interrupted' | 'turn' } | { type: 'tool'; name: string }
  | { type: 'error'; message: string } | { type: 'end'; why?: string };
export type CallHandle = { hangup(): void; mute(on: boolean): void; level(): number };

export async function startCall(mate: string, reason: string, on: (e: CallEvent) => void, conv = ''): Promise<CallHandle> {
  const base = await getVoiceUrl();
  if (!base) throw new Error('Set the voice server address in Settings first.');
  let perm = await AudioManager.checkRecordingPermissions();
  if (perm !== 'Granted') perm = await AudioManager.requestRecordingPermissions();
  if (perm !== 'Granted') throw new Error('Microphone permission is needed to call. Allow it in Android settings.');
  const token = await idToken();

  AudioManager.setAudioSessionOptions({ iosCategory: 'playAndRecord', iosMode: 'voiceChat', iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'] });
  const q = new URLSearchParams({ mate });
  if (token) q.set('token', token); if (conv) q.set('conv', conv);
  if (reason) q.set('reason', reason); else q.set('greet', '1');
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/live?${q.toString()}`);
  ws.binaryType = 'arraybuffer';

  const ctx = new AudioContext({ sampleRate: 24000 });
  const out = ctx.createBufferQueueSource();
  out.connect(ctx.destination);
  out.start(0, 0);
  const rec = new AudioRecorder();
  let muted = false, peak = 0, closed = false;

  rec.onAudioReady({ sampleRate: 16000, bufferLength: 1600, channelCount: 1 }, (ev) => {
    const f = ev.buffer.getChannelData(0);
    const ratio = Math.max(1, Math.round(ev.buffer.sampleRate / 16000));
    const n = Math.floor(f.length / ratio); const pcm = new Int16Array(n); let p = 0;
    for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, f[i * ratio])); pcm[i] = v * 32767; p = Math.max(p, Math.abs(v)); }
    peak = p;
    if (!muted && ws.readyState === 1) ws.send(pcm.buffer);
  });

  const cleanup = () => {
    if (closed) return; closed = true;
    try { out.clearBuffers(); out.stop(); } catch { /* already stopped */ }
    void rec.stop().catch(() => undefined); rec.clearOnAudioReady();
    void ctx.close().catch(() => undefined);
  };
  ws.onmessage = (m) => {
    if (typeof m.data === 'string') {
      let ev: CallEvent; try { ev = JSON.parse(m.data) as CallEvent; } catch { return; }
      if (ev.type === 'interrupted') { try { out.clearBuffers(); } catch { /* nothing queued */ } }
      on(ev); return;
    }
    const pcm = new Int16Array(m.data as ArrayBuffer); if (!pcm.length) return;
    const buf = ctx.createBuffer(1, pcm.length, 24000); const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    buf.copyToChannel(f, 0); out.enqueueBuffer(buf);
  };
  ws.onclose = () => { cleanup(); on({ type: 'end', why: 'closed' }); };
  ws.onerror = () => on({ type: 'error', message: 'Could not reach the voice server. It may be waking up; try again in a minute.' });
  const started = await rec.start();
  if (started.status === 'error') { cleanup(); ws.close(); throw new Error('Could not open the microphone.'); }
  return {
    hangup: () => { try { ws.send(JSON.stringify({ type: 'end' })); } catch { /* socket closed */ } ws.close(); cleanup(); },
    mute: (v) => { muted = v; }, level: () => peak,
  };
}
