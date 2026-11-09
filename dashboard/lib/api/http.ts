import type { Api, Repo } from './contract';
import type { CallReport, ChatEvent, ID, RunEvent } from '../types';
import { idToken } from '../auth';
import { resolveServer } from '../serverUrl';

/** REST + SSE adapter for the owner's Loopmates server. `server` returns its current base URL. Endpoints: see BACKEND.md. */
export function createHttpApi(server: () => string): Api {
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((s) => s());

  async function request(method: string, path: string, body?: unknown): Promise<Response> {
    const isForm = body instanceof FormData;
    const base = server();
    if (!base) throw new Error('Your Loopmates server is not paired yet.');
    for (let attempt = 0; ; attempt++) {
      const tok = await idToken();
      try {
        return await fetch(`${base}/v1${path}`, {
          method,
          headers: { ...(isForm || body === undefined ? {} : { 'content-type': 'application/json' }), ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
          body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        });
      } catch {
        // Network error: retry reads once (flaky network), and look up the server's address again in case it moved.
        if (method !== 'GET' || attempt >= 1) throw new Error('Cannot reach your Loopmates server. Check that it is running on your computer.');
        void resolveServer(true);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await request(method, path, body);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = text; try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { /* plain text */ }
      throw new Error(msg || `${method} ${path} failed (${res.status})`);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  function repo<T extends { id: ID }, In>(path: string): Repo<T, In> {
    return {
      list: () => call('GET', path),
      get: (id) => call<T>('GET', `${path}/${id}`).catch(() => undefined),
      create: async (input) => { const r = await call<T>('POST', path, input); emit(); return r; },
      update: async (id, patch) => { const r = await call<T>('PATCH', `${path}/${id}`, patch); emit(); return r; },
      remove: async (id) => { await call('DELETE', `${path}/${id}`); emit(); },
      subscribe: (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    };
  }
  const act = <T,>(path: string, body?: unknown) => call<T>('POST', path, body).then((r) => { emit(); return r; });

  const runs = repo('/runs') as Api['runs'];
  runs.start = async ({ files, ...rest }) => {
    const ids: ID[] = [];
    for (const f of files ?? []) { const fd = new FormData(); fd.append('file', f); ids.push((await call<{ id: ID }>('POST', '/files', fd)).id); }
    return act('/runs', { ...rest, fileIds: ids });
  };
  runs.control = (id, action) => act(`/runs/${id}/${action}`);
  runs.retry = (id) => act(`/runs/${id}/retry`);
  runs.steer = (id, text) => act(`/runs/${id}/steer`, { text });
  runs.decide = (runId, approvalId, decision) => act(`/runs/${runId}/approvals/${approvalId}`, { decision });
  runs.stream = (id, onEvent) => {
    // EventSource cannot send an Authorization header, so read the SSE stream with fetch.
    const ctl = new AbortController();
    (async () => {
      const tok = await idToken();
      const res = await fetch(`${server()}/v1/runs/${id}/events`, { headers: tok ? { authorization: `Bearer ${tok}` } : {}, signal: ctl.signal });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          for (const line of chunk.split('\n')) if (line.startsWith('data:')) { try { onEvent(JSON.parse(line.slice(5)) as RunEvent); } catch { /* ignore malformed event */ } emit(); }
        }
      }
    })().catch(() => { /* aborted or offline: the stored run still loads */ });
    return () => ctl.abort();
  };
  const conversations = repo('/conversations') as Api['conversations'];
  conversations.send = (id, text, mate) => act(`/conversations/${id}/messages`, { text, mate });
  conversations.sendStream = async (id, text, mate, onEvent) => {
    const res = await request('POST', `/conversations/${id}/messages?stream=1`, { text, mate });
    if (!res.ok || !res.body) {
      let msg = `Could not send (${res.status})`; try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* keep default */ }
      throw new Error(msg);
    }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        for (const line of chunk.split('\n')) if (line.startsWith('data:')) {
          try { const e = JSON.parse(line.slice(5)) as ChatEvent; onEvent(e); if (e.type === 'start' || e.type === 'done') emit(); } catch { /* ignore malformed event */ }
        }
      }
    }
    emit();
  };
  const mcp = repo('/mcp-servers') as Api['mcp'];
  mcp.verify = (id) => act(`/mcp-servers/${id}/verify`);
  const connections = repo('/connections') as Api['connections'];
  connections.chats = (id) => call("GET", `/connections/${id}/chats`);
  connections.test = (id) => act(`/connections/${id}/test`);
  const callsApi = { get: (id: ID) => call<CallReport>('GET', `/calls/${id}`).catch(() => undefined), list: () => call<CallReport[]>('GET', '/calls?limit=30'), now: (mate: string, convId = '') => call<{ id: ID; mate: string; reason: string }>('POST', '/calls/now', { mate, convId }), cancel: (id: ID) => call<{ ok: boolean }>('POST', `/calls/${id}/cancel`, {}) };
  connections.discordLinkCode = () => call('POST', '/discord/link-code', {});
  connections.telegramLinkCode = () => call('POST', '/telegram/link-code', {});
  const files = repo('/files') as Api['files'];
  files.upload = async (file) => { const fd = new FormData(); fd.append('file', file); return act('/files', fd); };
  files.downloadUrl = (id) => `${server()}/v1/files/${id}/content`;
  files.download = async (id, name) => {
    const res = await request('GET', `/files/${id}/content`);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const providers = repo('/providers') as Api['providers'];
  providers.fetchModels = (id) => act(`/providers/${id}/fetch-models`);

  return {
    capabilities: { backend: true },
    auth: { session: async () => ({ signedIn: true }), signOut: async () => {} },
    tasks: repo('/tasks'), workflows: repo('/workflows'), automations: repo('/automations'), knowledge: repo('/knowledge'),
    memories: repo('/memories'), watches: repo('/watches'), people: repo('/people'), teams: repo('/teams'), assignments: repo('/assignments'), checkins: repo('/checkins'),
    company: { importCsv: (csv) => call('POST', '/people/import', { csv }), invite: (id) => call('POST', `/people/${id}/invite`, {}), sendCheckin: (id) => call('POST', `/checkins/${id}/send`, {}) },
    leader: { get: () => call('GET', '/leader'), check: (id) => call('POST', `/watches/${id}/check`, {}), briefing: () => call('POST', '/leader/briefing', {}), standup: () => act('/leader/standup', {}), standups: () => call('GET', '/standups') },
    integrations: {
      list: () => call('GET', '/integrations'),
      test: (key) => call('POST', `/integrations/${key}/test`, {}),
      linkCode: (key) => call('POST', `/integrations/${key}/link-code`, {}),
      spotifyStart: (local = false) => call('GET', `/integrations/spotify/start${local ? '?local=1' : ''}`),
      obsidianSync: () => call('POST', '/integrations/obsidian/sync', {}),
      healthKey: () => call('POST', '/health/key', {}),
      healthImport: (csv) => call('POST', '/health/import', { csv }),
    },
    voicePreview: async (mate, voice = '', personality = '') => {
      const res = await request('GET', `/voice/preview?${new URLSearchParams({ mate, ...(voice ? { voice } : {}), ...(personality ? { personality } : {}) })}`);
      if (!res.ok) { let msg = `Preview failed (${res.status})`; try { msg = (await res.json()).error ?? msg; } catch { /* keep */ } throw new Error(msg); }
      return URL.createObjectURL(await res.blob());
    },
    graph: {
      get: (history = false) => call('GET', `/graph${history ? '?history=1' : ''}`),
      removeNode: async (id) => { await call('DELETE', `/graph/nodes/${id}`); },
      merge: async (from, into) => { await call('POST', '/graph/merge', { from, into }); },
    }, skills: repo('/skills'), mcp, connections, calls: callsApi, conversations, events: repo('/events'), files,
    mateConfigs: repo('/mates'), runs, providers,
    search: { knowledge: (q) => call('GET', `/knowledge/search?q=${encodeURIComponent(q)}`) },
    server: {
      status: () => call('GET', '/server/status'),
      config: () => call('GET', '/server/config'),
      saveConfig: (p) => call('PATCH', '/server/config', p),
      driveStart: () => call('GET', '/drive/oauth/start'),
      driveFolders: (parent = '') => call('GET', `/drive/folders?parent=${encodeURIComponent(parent)}`),
      driveFolder: (id, name) => call('POST', '/drive/folder', { id, name }),
      mateCards: () => call('GET', '/mates/cards'),
      restoreAgent: async (key) => { await call('POST', `/mates/${key}/restore`, {}); },
      harnesses: (fresh = false) => call('GET', `/coder/harnesses${fresh ? '?fresh=1' : ''}`),
      testHarness: (harness, sandbox) => call('POST', '/coder/test', { harness, sandbox }),
    },
    inbox: {
      questions: () => call('GET', '/questions'),
      answer: async (id, answer) => { const r = await call<{ ok: boolean; text: string }>('POST', `/questions/${id}/answer`, { answer }); emit(); return r; },
      list: () => call('GET', '/inbox'),
      markRead: async () => { await call('POST', '/inbox/read', {}); },
      pushKey: async () => (await call<{ publicKey: string }>('GET', '/push/key')).publicKey,
      devices: () => call('GET', '/devices'),
      addDevice: (d) => call('POST', '/devices', d),
      removeDevice: (id) => call('DELETE', `/devices/${id}`),
    },
    settings: {
      get: () => call('GET', '/settings'),
      update: async (p) => { const r = await call<never>('PATCH', '/settings', p); emit(); return r; },
      subscribe: (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    },
  };
}
