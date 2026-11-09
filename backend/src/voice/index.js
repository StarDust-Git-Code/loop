// Voice: a thin WebSocket relay (/live on the main server) between the phone/browser and Gemini's Live API.
// Client -> server: binary frames of 16 kHz mono PCM16, plus JSON text frames {type:'text', text} / {type:'end'}.
// Server -> client: binary frames of 24 kHz mono PCM16, plus JSON {type:'ready'|'interrupted'|'turn'|'transcript'|'error'|'end'}.
import { WebSocketServer, WebSocket } from 'ws';
import { env, num, now } from '../lib/env.js';
import { auth, userCol } from '../api/db.js';
import { isAllowed } from '../api/auth.js';
import { originAllowed } from '../lib/server.js';
import { buildSystem } from '../api/prompt.js';
import { getSettings } from '../api/settings.js';
import { MATE, defaultConfig, voiceFor } from '../api/mates.js';
import { loadRoster } from '../api/roster.js';
import { toolsFor, runTool } from '../api/tools.js';
import { getCall, missionPrompt, FINISH_DECL, wrapUp } from '../api/calls.js';
import { toSchema } from '../api/toolcalls.js';

const MAX_CALLS = num('VOICE_MAX_CALLS', 3);
const MAX_SECONDS = num('VOICE_MAX_SECONDS', 600);
const IDLE_SECONDS = 90;
const GEMINI_WS = env('VOICE_UPSTREAM') || 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
// One distinct Gemini prebuilt voice per Mate: voiceFor() in mates.js (owner's pick, built-in, or a spare voice).
// Calls get every tool the Mate has in chat. Tools that need approval stay off unless the owner runs in auto mode (nobody can tap Approve mid-call). Everything passes through the normal tool runner.
const gType = (n) => { if (Array.isArray(n)) return n.map(gType); if (n && typeof n === 'object') return Object.fromEntries(Object.entries(n).filter(([k]) => !['additionalProperties', '$schema', 'default', 'examples', 'title'].includes(k)).map(([k, v]) => [k, k === 'type' && typeof v === 'string' ? v.toUpperCase() : gType(v)])); return n; };
let active = 0;

/** Newest Live-capable model this key can use, unless VOICE_MODEL pins one. */
let picked = { at: 0, id: '' };
async function liveModel() {
  if (env('VOICE_MODEL')) return env('VOICE_MODEL').replace(/^models\//, '');
  if (picked.id && Date.now() - picked.at < 3_600_000) return picked.id;
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': env('GEMINI_API_KEY') }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Gemini model list answered ${r.status}`);
  const live = ((await r.json()).models ?? []).filter((m) => (m.supportedGenerationMethods ?? []).includes('bidiGenerateContent')).map((m) => m.name.replace(/^models\//, ''));
  const rank = (n) => (/translate|transcribe/.test(n) ? -1 : 0) + (/native-audio|live/.test(n) ? 1 : 0) + Number((/(\d+(?:\.\d+)?)/.exec(n) ?? [0, 0])[1]) / 100;
  const best = live.sort((a, b) => rank(b) - rank(a))[0];
  if (!best) throw new Error('This Gemini key has no Live (audio) models');
  picked = { at: Date.now(), id: best }; return best;
}

/** Mount the voice relay on the main server: GET /v1/voice/model and the /live WebSocket. */
export function mountVoice(app) {
app.get('/v1/voice/model', async (req, reply) => {
  try { return { using: await liveModel() }; } catch (e) { return reply.code(502).send({ error: e.message }); }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
app.server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://x');
  // Browsers send an Origin we can check (dashboard or localhost). Native apps send none, or the socket's own host (React Native).
  // The Firebase token checked in handle() is the real guard; the origin check only stops other websites.
  const origin = req.headers.origin ?? '';
  const own = (() => { try { return new URL(origin).host === req.headers.host; } catch { return false; } })();
  const okOrigin = own || originAllowed(origin);
  if (u.pathname !== '/live' || !okOrigin) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => handle(ws, u.searchParams));
});
}

async function handle(ws, q) {
  const say = (o) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(o)); };
  const fail = (m) => { say({ type: 'error', message: m }); ws.close(); };
  if (!env('GEMINI_API_KEY')) return fail('Voice is not configured (GEMINI_API_KEY missing on the voice service).');
  if (active >= MAX_CALLS) return fail('The line is busy. Try again in a minute.');
  let user; try { user = await auth.verifyIdToken(q.get('token') ?? ''); } catch { return fail('Sign in again to call.'); }
  if (!isAllowed(user)) return fail('This account is not on the allow-list.');
  if (ws.readyState !== WebSocket.OPEN) return;
  active++; let up, ended = false; const started = Date.now(); let last = Date.now();
  const callId = String(q.get('call') ?? '').slice(0, 60); const transcript = []; let finish = null, hangAfterTurn = false, whyEnded = '';
  const note = (who, text) => { const t = transcript.at(-1); if (t && t.who === who) t.text += text; else transcript.push({ who, text }); };
  const end = (why) => { if (ended) return; ended = true; active--; whyEnded = why; if (callId) void wrapUp(user.uid, callId, { transcript, finish, why }).catch(() => {}); clearInterval(tick); try { up?.close(); } catch { /* ignore */ } say({ type: 'end', why }); try { ws.close(); } catch { /* ignore */ } };
  const tick = setInterval(() => { if (Date.now() - started > MAX_SECONDS * 1000) end('time limit'); else if (Date.now() - last > IDLE_SECONDS * 1000) end('silence'); }, 5000);
  ws.on('close', () => end('hangup')); ws.on('error', () => end('error'));
  try {
    const ro = await loadRoster(user.uid);
    const mateKey = ro.has(q.get('mate')) ? q.get('mate') : ro.leader;
    const [settings, model] = await Promise.all([getSettings(user.uid), liveModel()]);
    if (ended) return;
    const cfg = ro.cfgs[mateKey] ?? defaultConfig(MATE[mateKey] ?? ro.byKey[mateKey], now());
    const base = await buildSystem({ uid: user.uid, mateKey, cfg, mode: 'chat', query: '', settings, tools: [], others: [], surface: 'voice' });
    const reason = String(q.get('reason') ?? '').slice(0, 300);
    const call = callId ? await getCall(user.uid, callId) : null;
    if (call) await userCol(user.uid, 'calls').doc(callId).set({ status: 'answered', answeredAt: now(), updatedAt: now() }, { merge: true }).catch(() => {});
    // Context: the most recent chat (the one the call was started from, else the newest with this Mate) so the call continues it.
    let recap = '';
    if (call?.snapshot) recap = `\n\nWhat you (${ro.name(mateKey)}) knew when you asked for this call${call.scheduledFor ? ` (it was scheduled for ${call.scheduledFor})` : ''}. Continue from it naturally; it is your own context, not something to read out:\n${call.snapshot}`;
    else try {
      const convs = (await userCol(user.uid, 'conversations').limit(60).get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.updatedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.createdAt)));
      const c = convs.find((x) => x.id === q.get('conv')) ?? convs.find((x) => x.mate === mateKey) ?? convs[0];
      const msgs = (c?.messages ?? []).filter((m) => m.role !== 'system' && m.text).slice(-10);
      if (msgs.length) recap = `\n\nRecent chat "${String(c.title ?? '').slice(0, 60)}" (for context, continue naturally):\n${msgs.map((m) => `${m.role === 'user' ? 'Owner' : ro.name(m.mate ?? mateKey)}: ${String(m.text).slice(0, 300)}`).join('\n')}`;
    } catch { /* context is best effort */ }
    const allowed = toolsFor(cfg.tools ?? [], { ...settings, permissionMode: settings.permissionMode }, mateKey, ro.leader).filter((t) => !(t.needsApproval && settings.permissionMode !== 'auto'));
    const declarations = allowed.map((t) => { const f = toSchema(t).function; return { name: f.name, description: f.description, ...(Object.keys(f.parameters.properties).length ? { parameters: gType(f.parameters) } : {}) }; });
    // The base prompt already carries the voice-call rules (surface=voice) and this Mate's own voice; only add what is call-specific.
    const system = `${base}${call ? `\n\n${missionPrompt(call)}` : reason ? `\n\nYou called the owner because: ${reason}. Start by saying why, in your own voice.` : ''}${declarations.length ? `\n\nTools this call: ${declarations.map((d) => d.name).join(', ')}.` : ''}${recap}`;
    if (ended) return; // owner hung up while we were preparing: never open the Gemini session
    up = new WebSocket(`${GEMINI_WS}?key=${encodeURIComponent(env('GEMINI_API_KEY'))}`);
    up.on('open', () => up.send(JSON.stringify({ setup: { model: `models/${model}`, generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceFor(mateKey, cfg) } } } }, systemInstruction: { parts: [{ text: system }] }, ...((declarations.length || call) ? { tools: [{ functionDeclarations: call ? [...declarations, FINISH_DECL] : declarations }] } : {}), inputAudioTranscription: {}, outputAudioTranscription: {} } })));
    up.on('message', (raw) => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.setupComplete) { say({ type: 'ready', mate: mateKey, name: ro.name(mateKey), model }); if (reason || q.get('greet')) up.send(JSON.stringify({ realtimeInput: { text: reason ? 'Start the call now.' : 'Greet the owner briefly.' } })); return; }
      if (m.toolCall?.functionCalls?.length) {
        last = Date.now();
        void Promise.all(m.toolCall.functionCalls.map(async (fc) => {
          say({ type: 'tool', name: fc.name });
          if (fc.name === 'finish_call') { finish = { summary: String(fc.args?.summary ?? ''), answers: [].concat(fc.args?.answers ?? []).map(String), followups: [].concat(fc.args?.followups ?? []).map(String) }; hangAfterTurn = true; return { id: fc.id, name: fc.name, response: { output: 'Recorded. Say a brief goodbye now.' } }; }
          const r = await runTool(fc.name, fc.args ?? {}, { uid: user.uid, settings, mate: mateKey, convId: q.get('conv') || undefined }, allowed);
          return { id: fc.id, name: fc.name, response: r.ok ? { output: r.text.slice(0, 3000) } : { error: r.text.slice(0, 500) } };
        })).then((functionResponses) => { if (up?.readyState === WebSocket.OPEN) up.send(JSON.stringify({ toolResponse: { functionResponses } })); }).catch(() => {});
        return;
      }
      if (m.toolCallCancellation) return;
      const sc = m.serverContent; if (!sc) return;
      // Only real speech counts as activity: transcripts and model turns, not raw audio frames (mic noise never stops).
      if (sc.inputTranscription?.text || sc.outputTranscription?.text || sc.turnComplete) last = Date.now();
      if (sc.interrupted) say({ type: 'interrupted' });
      for (const p of sc.modelTurn?.parts ?? []) if (p.inlineData?.data && ws.readyState === WebSocket.OPEN) ws.send(Buffer.from(p.inlineData.data, 'base64'));
      if (sc.inputTranscription?.text) { say({ type: 'transcript', who: 'you', text: sc.inputTranscription.text }); note('you', sc.inputTranscription.text); }
      if (sc.outputTranscription?.text) { say({ type: 'transcript', who: 'mate', text: sc.outputTranscription.text }); note('mate', sc.outputTranscription.text); }
      if (sc.turnComplete) { say({ type: 'turn' }); if (hangAfterTurn) setTimeout(() => end('done'), 2500); }
    });
    up.on('close', (code, reason2) => end(code === 1000 ? 'done' : `model closed (${code}) ${reason2?.toString().slice(0, 80) ?? ''}`));
    up.on('error', () => end('model error'));
    ws.on('message', (data, isBinary) => {
      if (up?.readyState !== WebSocket.OPEN) return;
      if (isBinary) { up.send(JSON.stringify({ realtimeInput: { audio: { data: Buffer.from(data).toString('base64'), mimeType: 'audio/pcm;rate=16000' } } })); return; }
      let m; try { m = JSON.parse(data.toString()); } catch { return; }
      if (m.type === 'text' && m.text) { last = Date.now(); up.send(JSON.stringify({ realtimeInput: { text: String(m.text).slice(0, 1000) } })); }
      else if (m.type === 'end') end('hangup');
    });
  } catch (e) { end(`failed: ${String(e.message).slice(0, 100)}`); }
}

/** For the status page. */
export const voiceStatus = () => ({ ready: !!env('GEMINI_API_KEY'), active, max: MAX_CALLS });
