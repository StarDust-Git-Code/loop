import type { Api, Repo } from './contract';
import type { ID, RunEvent } from '../types';

/** REST + SSE adapter. Set NEXT_PUBLIC_API_URL to switch the dashboard to it. Endpoints: see BACKEND.md. */
export function createHttpApi(base: string): Api {
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((s) => s());

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}/v1${path}`, {
      method, credentials: 'include',
      headers: body instanceof FormData ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || `${method} ${path} failed (${res.status})`);
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
  runs.steer = (id, text) => act(`/runs/${id}/steer`, { text });
  runs.decide = (runId, approvalId, decision) => act(`/runs/${runId}/approvals/${approvalId}`, { decision });
  runs.stream = (id, onEvent) => {
    const es = new EventSource(`${base}/v1/runs/${id}/events`, { withCredentials: true });
    es.onmessage = (m) => { try { onEvent(JSON.parse(m.data) as RunEvent); } catch { /* ignore malformed event */ } emit(); };
    return () => es.close();
  };
  const conversations = repo('/conversations') as Api['conversations'];
  conversations.send = (id, text, mate) => act(`/conversations/${id}/messages`, { text, mate });
  const mcp = repo('/mcp-servers') as Api['mcp'];
  mcp.verify = (id) => act(`/mcp-servers/${id}/verify`);
  const connections = repo('/connections') as Api['connections'];
  connections.chats = (id) => call("GET", `/connections/${id}/chats`);
  connections.test = (id) => act(`/connections/${id}/test`);
  const files = repo('/files') as Api['files'];
  files.upload = async (file) => { const fd = new FormData(); fd.append('file', file); return act('/files', fd); };
  files.downloadUrl = (id) => `${base}/v1/files/${id}/content`;

  const providers = repo('/providers') as Api['providers'];
  providers.fetchModels = (id) => act(`/providers/${id}/fetch-models`);

  return {
    capabilities: { backend: true },
    auth: { session: () => call('GET', '/auth/session'), signOut: () => call('POST', '/auth/sign-out') },
    tasks: repo('/tasks'), workflows: repo('/workflows'), automations: repo('/automations'), knowledge: repo('/knowledge'),
    memories: repo('/memories'), skills: repo('/skills'), mcp, connections, conversations, events: repo('/events'), files,
    mateConfigs: repo('/mates'), runs, providers,
    search: { knowledge: (q) => call('GET', `/knowledge/search?q=${encodeURIComponent(q)}`) },
    settings: {
      get: () => call('GET', '/settings'),
      update: async (p) => { const r = await call<never>('PATCH', '/settings', p); emit(); return r; },
      subscribe: (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    },
  };
}
