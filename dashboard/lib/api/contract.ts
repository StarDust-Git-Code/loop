import type {
  Approval, Automation, CallReport, AutomationIn, CalEvent, CalEventIn, Connection, ConnectionIn, Conversation, ConversationIn,
  FileIn, FileItem, ID, Knowledge, KnowledgeIn, McpIn, McpServer, MateConfig, MateConfigIn, Memory, MemoryIn,
  ChatEvent, Device, InboxItem, Message, ProviderCfg, Question, ServerField, ServerStatus, ProviderIn, Run, RunEvent, RunIn, Session, SettingsData, Skill, SkillIn, Task, TaskIn, Workflow, WorkflowIn, GraphNode, GraphEdge, Harnesses, HarnessKey, HarnessTest, LeaderState, Watch, WatchIn, Person, PersonIn, Team, TeamIn, Assignment, AssignmentIn, Checkin, CheckinIn, Integration, Standup, StandupLine } from '../types';

/**
 * The whole backend surface the UI needs. `local.ts` implements it in the browser (no execution),
 * `http.ts` maps it onto REST + SSE. See BACKEND.md for the endpoint list.
 */
export interface Repo<T extends { id: ID }, In> {
  list(): Promise<T[]>;
  get(id: ID): Promise<T | undefined>;
  create(input: In): Promise<T>;
  update(id: ID, patch: Partial<In>): Promise<T>;
  remove(id: ID): Promise<void>;
  /** Called after any change (own or remote). Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void;
}

export type StartRun = { prompt: string; workflowId?: ID; askFirst: boolean; files?: File[] };
export type RunControl = 'stop' | 'pause' | 'resume';

export interface Api {
  /** false while running on the local adapter: nothing is executed, runs stay queued. */
  capabilities: { backend: boolean };
  auth: { session(): Promise<Session>; signOut(): Promise<void> };

  tasks: Repo<Task, TaskIn>;
  workflows: Repo<Workflow, WorkflowIn>;
  automations: Repo<Automation, AutomationIn>;
  knowledge: Repo<Knowledge, KnowledgeIn>;
  memories: Repo<Memory, MemoryIn>;
  watches: Repo<Watch, WatchIn>;
  people: Repo<Person, PersonIn>; teams: Repo<Team, TeamIn>; assignments: Repo<Assignment, AssignmentIn>; checkins: Repo<Checkin, CheckinIn>;
  company: { importCsv(csv: string): Promise<{ added: number; updated: number; teams: number }>; invite(personId: ID): Promise<{ code: string; command: string; expiresInDays: number }>; sendCheckin(id: ID): Promise<Checkin> };
  leader: { get(): Promise<LeaderState>; check(id: ID): Promise<{ raised: unknown[] }>; briefing(): Promise<{ delivered: string; text: string }>; /** Every agent that worked this week writes one line; the round-up goes to the owner. */ standup(): Promise<{ text: string; lines: StandupLine[] }>; standups(): Promise<Standup[]> };
  /** Optional apps (Obsidian, Slack, Home Assistant…): setup steps, status, test, link codes, sign-ins. */
  integrations: {
    list(): Promise<Integration[]>;
    test(key: string): Promise<{ ok: boolean; text: string }>;
    linkCode(key: string): Promise<{ code: string; command: string; expiresInMinutes: number }>;
    spotifyStart(local?: boolean): Promise<{ url: string; redirectUri: string }>;
    obsidianSync(): Promise<{ ok: boolean; text: string }>;
    healthKey(): Promise<{ key: string; url: string }>;
    healthImport(csv: string): Promise<{ saved: number }>;
  };
  /** A spoken sample of a call voice, as an object URL to play. */
  voicePreview(mate: string, voice?: string, personality?: string): Promise<string>;
  graph: { get(history?: boolean): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>; removeNode(id: ID): Promise<void>; merge(from: ID, into: ID): Promise<void> };
  skills: Repo<Skill, SkillIn>;
  mcp: Repo<McpServer, McpIn> & { verify(id: ID): Promise<McpServer> };
  /** Voice call missions: the report a voice sub-agent filed after calling you. */
  calls: { get(id: ID): Promise<CallReport | undefined>; list(): Promise<CallReport[]>; /** A call with this Mate that carries the chat context. */ now(mate: string, convId?: string): Promise<{ id: ID; mate: string; reason: string }>; cancel(id: ID): Promise<{ ok: boolean }> };
  connections: Repo<Connection, ConnectionIn> & { /** One-time code to send to the Telegram bot as /start CODE. */ telegramLinkCode(): Promise<{ code: string; bot: string | null; expiresInMinutes: number }>; /** One-time code to use with the /link command of the Discord bot. */ discordLinkCode(): Promise<{ code: string; command: string; invite: string | null; expiresInMinutes: number }>; test(id: ID): Promise<Connection>; /** Chats the bridge can see (WhatsApp). Empty until the backend lists them. */ chats(id: ID): Promise<{ id: string; name: string; meta: string }[]> };
  conversations: Repo<Conversation, ConversationIn> & { send(id: ID, text: string, mate?: string): Promise<Message>; /** Same as send, but the reply arrives live through onEvent. Resolves when the answer is complete. */ sendStream(id: ID, text: string, mate: string | undefined, onEvent: (e: ChatEvent) => void): Promise<void> };
  events: Repo<CalEvent, CalEventIn>;
  files: Repo<FileItem, FileIn> & { upload(file: File): Promise<FileItem>; downloadUrl(id: ID): string; /** Authenticated download: fetches with the sign-in token and saves the file. */ download(id: ID, name: string): Promise<void> };
  mateConfigs: Repo<MateConfig, MateConfigIn>;
  /** LLM providers. `fetchModels` asks the provider for its model list and stores it on the provider. */
  providers: Repo<ProviderCfg, ProviderIn> & { fetchModels(id: ID): Promise<string[]> };
  runs: Repo<Run, RunIn> & {
    start(input: StartRun): Promise<Run>;
    control(id: ID, action: RunControl): Promise<Run>;
    /** Send a steering message to a live run. */
    steer(id: ID, text: string): Promise<Run>;
    /** Resume a failed or stopped run from its first unfinished step. */
    retry(id: ID): Promise<Run>;
    decide(runId: ID, approvalId: ID, decision: Approval['status']): Promise<Run>;
    /** Live events for one run (SSE / WebSocket on the http adapter). */
    stream(id: ID, onEvent: (e: RunEvent) => void): () => void;
  };
  search: { knowledge(query: string): Promise<{ id: ID; name: string; snippet: string }[]> };
  /** The owner's server: status, settings the dashboard may change, Drive sign-in, role cards. */
  server: {
    status(): Promise<ServerStatus>;
    config(): Promise<ServerField[]>;
    saveConfig(patch: Record<string, string>): Promise<ServerField[]>;
    driveStart(): Promise<{ url: string; redirectUri: string }>;
    driveFolders(parent?: string): Promise<{ parent: string; items: { id: string; name: string }[] }>;
    driveFolder(id: string, name: string): Promise<{ ok: boolean }>;
    mateCards(): Promise<Record<string, string>>; restoreAgent(key: string): Promise<void>;
    harnesses(fresh?: boolean): Promise<Harnesses>; testHarness(harness: HarnessKey, sandbox: 'auto' | 'docker' | 'host'): Promise<HarnessTest>;
  };
  /** ask_owner questions, the notification inbox and push devices. */
  inbox: {
    questions(): Promise<Question[]>;
    answer(id: ID, answer: string): Promise<{ ok: boolean; text: string }>;
    list(): Promise<InboxItem[]>;
    markRead(): Promise<void>;
    pushKey(): Promise<string>;
    devices(): Promise<Device[]>;
    addDevice(d: { kind: 'web'; subscription: PushSubscriptionJSON; label: string }): Promise<{ id: ID }>;
    removeDevice(id: ID): Promise<void>;
  };
  settings: { get(): Promise<SettingsData>; update(patch: Partial<SettingsData>): Promise<SettingsData>; subscribe(cb: () => void): () => void };
}
