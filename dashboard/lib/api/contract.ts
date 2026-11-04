import type {
  Approval, Automation, CallReport, AutomationIn, CalEvent, CalEventIn, Connection, ConnectionIn, Conversation, ConversationIn,
  FileIn, FileItem, ID, Knowledge, KnowledgeIn, McpIn, McpServer, MateConfig, MateConfigIn, Memory, MemoryIn,
  ChatEvent, Message, ProviderCfg, ProviderIn, Run, RunEvent, RunIn, Session, SettingsData, Skill, SkillIn, Task, TaskIn, Workflow, WorkflowIn,
} from '../types';

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
  skills: Repo<Skill, SkillIn>;
  mcp: Repo<McpServer, McpIn> & { verify(id: ID): Promise<McpServer> };
  /** Voice call missions: the report a voice sub-agent filed after calling you. */
  calls: { get(id: ID): Promise<CallReport | undefined> };
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
  settings: { get(): Promise<SettingsData>; update(patch: Partial<SettingsData>): Promise<SettingsData>; subscribe(cb: () => void): () => void };
}
