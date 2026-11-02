import type {
  Approval, Automation, AutomationIn, CalEvent, CalEventIn, Connection, ConnectionIn, Conversation, ConversationIn,
  FileIn, FileItem, ID, Knowledge, KnowledgeIn, McpIn, McpServer, MateConfig, MateConfigIn, Memory, MemoryIn,
  Message, Run, RunEvent, RunIn, Session, SettingsData, Skill, SkillIn, Task, TaskIn, Workflow, WorkflowIn,
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
  connections: Repo<Connection, ConnectionIn> & { test(id: ID): Promise<Connection> };
  conversations: Repo<Conversation, ConversationIn> & { send(id: ID, text: string, mate?: string): Promise<Message> };
  events: Repo<CalEvent, CalEventIn>;
  files: Repo<FileItem, FileIn> & { upload(file: File): Promise<FileItem>; downloadUrl(id: ID): string };
  mateConfigs: Repo<MateConfig, MateConfigIn>;
  runs: Repo<Run, RunIn> & {
    start(input: StartRun): Promise<Run>;
    control(id: ID, action: RunControl): Promise<Run>;
    decide(runId: ID, approvalId: ID, decision: Approval['status']): Promise<Run>;
    /** Live events for one run (SSE / WebSocket on the http adapter). */
    stream(id: ID, onEvent: (e: RunEvent) => void): () => void;
  };
  search: { knowledge(query: string): Promise<{ id: ID; name: string; snippet: string }[]> };
  settings: { get(): Promise<SettingsData>; update(patch: Partial<SettingsData>): Promise<SettingsData>; subscribe(cb: () => void): () => void };
}
