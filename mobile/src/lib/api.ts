import AsyncStorage from '@react-native-async-storage/async-storage';
import { idToken } from './auth';
import { API_URL, DEFAULT_VOICE_URL } from './theme';
import type { CallReport, ChatEvent, Conversation, Memory, MateConfig, Run, Settings, Task, CalEvent, Skill, Workflow, Connection, FileItem } from './types';

export class ApiError extends Error { constructor(m: string, public status = 0) { super(m); } }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const tok = await idToken();
    try {
      return await fetch(`${API_URL}/v1${path}`, {
        method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      // A sleeping free-tier server takes about a minute to wake: retry reads a few times.
      if (method !== 'GET' || attempt >= 3) throw new ApiError('Cannot reach the server. It may be waking up; try again in a minute.');
      await sleep(4000 * (attempt + 1));
    }
  }
}
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await request(method, path, body);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    throw new ApiError(msg, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const repo = <T,>(p: string) => ({
  list: () => call<T[]>('GET', p),
  create: (b: Partial<T>) => call<T>('POST', p, b),
  patch: (id: string, b: Partial<T>) => call<T>('PATCH', `${p}/${id}`, b),
  remove: (id: string) => call<void>('DELETE', `${p}/${id}`),
});

export const api = {
  settings: { get: () => call<Settings>('GET', '/settings'), patch: (b: Partial<Settings>) => call<Settings>('PATCH', '/settings', b) },
  conversations: { ...repo<Conversation>('/conversations'), get: (id: string) => call<Conversation>('GET', `/conversations/${id}`) },
  memories: repo<Memory>('/memories'),
  tasks: repo<Task>('/tasks'),
  events: repo<CalEvent>('/events'),
  mates: repo<MateConfig>('/mates'),
  runs: {
    list: () => call<Run[]>('GET', '/runs'), get: (id: string) => call<Run>('GET', `/runs/${id}`), remove: (id: string) => call<void>('DELETE', `/runs/${id}`),
    start: (prompt: string, askFirst = true) => call<Run>('POST', '/runs', { prompt, askFirst }),
    control: (id: string, a: 'stop' | 'pause' | 'resume') => call<unknown>('POST', `/runs/${id}/${a}`),
    retry: (id: string) => call<unknown>('POST', `/runs/${id}/retry`),
    steer: (id: string, text: string) => call<unknown>('POST', `/runs/${id}/steer`, { text }),
    decide: (id: string, aid: string, decision: 'approved' | 'denied') => call<unknown>('POST', `/runs/${id}/approvals/${aid}`, { decision }),
    update: (id: string, b: Partial<Run>) => call<Run>('PATCH', `/runs/${id}`, b),
  },
  skills: repo<Skill>('/skills'),
  workflows: repo<Workflow>('/workflows'),
  connections: { ...repo<Connection>('/connections'), test: (id: string) => call<{ status: string; message?: string }>('POST', `/connections/${id}/test`) },
  telegramCode: (connectionId?: string) => call<{ code: string; bot?: string | null }>('POST', '/telegram/link-code', { connectionId }).then((r) => ({ code: r.code, link: r.bot ? `https://t.me/${r.bot.replace(/^@/, '')}` : undefined })),
  discordCode: (connectionId?: string) => call<{ code: string; command: string; invite?: string | null }>('POST', '/discord/link-code', { connectionId }),
  calls: { get: (id: string) => call<CallReport>('GET', `/calls/${id}`) },
  files: { list: () => call<FileItem[]>('GET', '/files'), remove: (id: string) => call<void>('DELETE', `/files/${id}`) },
};

/** Uploads one file (multipart). The server answers 501 until Google Drive storage is set up. */
export async function uploadFile(f: { uri: string; name: string; type: string }): Promise<FileItem> {
  const tok = await idToken(); const fd = new FormData();
  fd.append('file', { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
  const res = await fetch(`${API_URL}/v1/files`, { method: 'POST', headers: tok ? { authorization: `Bearer ${tok}` } : {}, body: fd });
  if (!res.ok) { let m = res.status === 501 ? 'File storage is not set up on the server yet (Google Drive).' : `Upload failed (${res.status})`; try { const j = await res.json(); if (j?.error) m = j.error; } catch { /* default */ } throw new ApiError(m, res.status); }
  return (await res.json()) as FileItem;
}

/** Streams a chat turn over Server-Sent Events. React Native's fetch cannot stream, so this reads XHR progress. Returns an abort function. */
export function sendStream(convId: string, text: string, mate: string, on: (e: ChatEvent) => void, onEnd: (err?: string) => void): () => void {
  const xhr = new XMLHttpRequest();
  let seen = 0, buf = '', finished = false;
  const end = (err?: string) => { if (!finished) { finished = true; onEnd(err); } };
  const pump = () => {
    const chunk = xhr.responseText.slice(seen); seen = xhr.responseText.length; buf += chunk;
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
      if (!data) continue;
      try { on(JSON.parse(data) as ChatEvent); } catch { /* ignore a malformed frame */ }
    }
  };
  (async () => {
    const tok = await idToken();
    xhr.open('POST', `${API_URL}/v1/conversations/${convId}/messages?stream=1`);
    xhr.setRequestHeader('content-type', 'application/json'); xhr.setRequestHeader('accept', 'text/event-stream');
    if (tok) xhr.setRequestHeader('authorization', `Bearer ${tok}`);
    xhr.onprogress = pump;
    xhr.onreadystatechange = () => { if (xhr.readyState === 3) pump(); };
    xhr.onload = () => { pump(); if (xhr.status >= 400) { let m = `Request failed (${xhr.status})`; try { m = JSON.parse(xhr.responseText).error ?? m; } catch { /* default */ } end(m); } else end(); };
    xhr.onerror = () => end('Cannot reach the server. It may be waking up; try again in a minute.');
    xhr.ontimeout = () => end('The server took too long to answer.');
    xhr.timeout = 180_000;
    xhr.send(JSON.stringify({ text, mate }));
  })();
  return () => { finished = true; try { xhr.abort(); } catch { /* already done */ } };
}

export const getVoiceUrl = async () => (await AsyncStorage.getItem('voiceUrl')) || DEFAULT_VOICE_URL;
export const setVoiceUrl = (u: string) => AsyncStorage.setItem('voiceUrl', u.trim().replace(/\/$/, ''));
