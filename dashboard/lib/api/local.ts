import type { Api, Repo } from './contract';
import type { ID, Run, SettingsData, Message, Connection, McpServer, FileItem } from '../types';
import { now, uid } from '../format';
import { MATE_DEFS } from '../mates';
import { PRESET, fetchModelList } from '../providers';

/** Browser-only adapter: persists to localStorage, starts empty, executes nothing. */
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('storage', emit);

const read = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(`lm:v1:${key}`); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, v: unknown) => {
  try { localStorage.setItem(`lm:v1:${key}`, JSON.stringify(v)); } catch { /* quota or private mode */ }
  emit();
};

function repo<T extends { id: ID; createdAt: string; updatedAt: string }, In>(name: string, seed: () => T[] = () => []): Repo<T, In> {
  const all = () => { const v = read<T[] | null>(name, null); return v ?? seed(); };
  return {
    async list() { return all().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async get(id) { return all().find((x) => x.id === id); },
    async create(input) {
      const t = now();
      const item = { ...(input as object), id: uid(), createdAt: t, updatedAt: t } as T;
      write(name, [item, ...all()]);
      return item;
    },
    async update(id, patch) {
      let out!: T;
      write(name, all().map((x) => (x.id === id ? (out = { ...x, ...(patch as object), updatedAt: now() } as T) : x)));
      return out;
    },
    async remove(id) { write(name, all().filter((x) => x.id !== id)); },
    subscribe(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
  };
}

const DEFAULT_SETTINGS: SettingsData = {
  displayName: '', email: '', workspaceName: 'Personal workspace', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  model: '', askBeforeRisky: true, maxSteps: 40, allowNetwork: true, stopAfterMinutes: 20, notifyTelegram: false, notifyEmail: false,
  permissionMode: 'ask', retriesOnFailure: 2,
  hookBeforeTool: 'Ask me before writing files outside /workspace or sending any message.', hookAfterStep: 'Save new findings to Knowledge with their source.', hookOnFinish: 'Send me a Telegram summary with links to the files.', hookOnFailure: 'Retry twice, then ping me and wait.',
  guardContainer: true, guardPurchases: true, guardLog: true,
  chunkSize: 800, overlap: 100, topK: 6, hybrid: true, rerank: true, citeAlways: true, memoryScope: 'shared',
  prefersShort: true, shareSchedule: false,
  maxContextTokens: 0, maxOutputTokens: 0, defaultThinking: 'high',
};

export function createLocalApi(): Api {
  const runs = repo<Run, never>('runs') as Api['runs'];
  const conversations = repo<never, never>('conversations') as unknown as Api['conversations'];
  const mcp = repo<McpServer, never>('mcp') as Api['mcp'];
  const connections = repo<Connection, never>('connections') as Api['connections'];
  const files = repo<FileItem, never>('files') as Api['files'];

  runs.start = async ({ prompt, workflowId, askFirst, files: fs }) => {
    const created: FileItem[] = [];
    for (const f of fs ?? []) created.push(await files.upload(f));
    return runs.create({
      title: prompt.length > 48 ? `${prompt.slice(0, 48)}…` : prompt, prompt, workflowId, askFirst,
      status: 'queued', steps: [], log: [{ at: now(), source: 'system', text: 'Queued. No backend is connected, so nothing will run yet.' }],
      approvals: [], fileIds: created.map((f) => f.id), sources: [], report: '', notes: '',
    } as never);
  };
  runs.control = async (id, action) => runs.update(id, { status: action === 'stop' ? 'stopped' : action === 'pause' ? 'queued' : 'queued' } as never);
  runs.steer = async (id, text) => { const r = (await runs.get(id))!; return runs.update(id, { log: [...r.log, { at: now(), source: 'you', text }] } as never); };
  runs.decide = async (runId, approvalId, decision) => {
    const r = (await runs.get(runId))!;
    return runs.update(runId, { approvals: r.approvals.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)) } as never);
  };
  runs.stream = () => () => {};

  conversations.send = async (id, text, mate) => {
    const c = (await conversations.get(id))!;
    const m: Message = { id: uid(), role: 'user', text, at: now(), state: 'pending', mate: mate as Message['mate'] };
    await conversations.update(id, { messages: [...c.messages, m] } as never);
    return m;
  };
  conversations.sendStream = async (id, text, mate) => { await conversations.send(id, text, mate); };
  mcp.verify = async (id) => mcp.update(id, { status: 'unverified' } as never);
  connections.chats = async () => [];
  connections.test = async (id) => connections.update(id, { status: 'pending' } as never);
  files.upload = async (file) => files.create({ name: file.name, size: file.size, mime: file.type || 'application/octet-stream', source: 'upload' } as never);
  files.downloadUrl = () => '#';
  files.download = async () => { throw new Error('Files are not stored without the backend.'); };

  const providers = repo<never, never>('providers') as unknown as Api['providers'];
  providers.fetchModels = async (id) => {
    const p = (await providers.get(id))!;
    const models = await fetchModelList({ baseUrl: p.baseUrl, apiKey: p.apiKey, auth: PRESET[p.preset]?.auth ?? 'bearer' });
    await providers.update(id, { models, fetchedAt: now() } as never);
    return models;
  };

  const settingsSubs = new Set<() => void>();
  const defaultsFor = () => MATE_DEFS.map((m) => ({
    id: m.key, createdAt: now(), updatedAt: now(), mate: m.key, enabled: m.core, instructions: '', model: '', tools: m.tools, description: m.blurb, outputFormat: 'Markdown', memoryScope: 'private' as const, thinking: 'default' as const,
  }));

  return {
    capabilities: { backend: false },
    auth: { session: async () => ({ signedIn: false }), signOut: async () => {} },
    tasks: repo('tasks'), workflows: repo('workflows'), automations: repo('automations'), knowledge: repo('knowledge'),
    memories: repo('memories'), skills: repo('skills'), mcp, connections, conversations, events: repo('events'), files,
    mateConfigs: repo('mateConfigs', defaultsFor as never) as never, runs, providers,
    search: { knowledge: async () => [] },
    settings: {
      get: async () => ({ ...DEFAULT_SETTINGS, ...read<Partial<SettingsData>>('settings', {}) }),
      update: async (patch) => { const v = { ...DEFAULT_SETTINGS, ...read('settings', {}), ...patch }; write('settings', v); settingsSubs.forEach((s) => s()); return v; },
      subscribe: (cb) => { settingsSubs.add(cb); listeners.add(cb); return () => { settingsSubs.delete(cb); listeners.delete(cb); }; },
    },
  };
}
