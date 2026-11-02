export type ID = string;
export type Timestamps = { createdAt: string; updatedAt: string };
export type Entity<T> = T & { id: ID } & Timestamps;

export type MateKey =
  | 'planner' | 'research' | 'code' | 'writer' | 'browser' | 'ops' | 'mimo' | 'orbit' | 'recall'
  | 'spark' | 'zen' | 'luna' | 'scout' | 'chef' | 'tune' | 'data' | 'byte' | 'halo';

/* ---------- workflows ---------- */
export type NodeType = 'trigger' | 'knowledge' | 'input' | 'mate' | 'tool' | 'condition' | 'transform' | 'filter' | 'output';
export type FlowNode = { id: ID; type: NodeType; label: string; mate?: MateKey; x: number; y: number; config?: Record<string, string> };
export type FlowEdge = { id: ID; from: ID; to: ID };
export type WorkflowIn = { name: string; description: string; nodes: FlowNode[]; edges: FlowEdge[]; trigger?: string; state?: 'active' | 'scheduled' | 'manual' | 'draft' };
export type Workflow = Entity<WorkflowIn>;

/* ---------- runs ---------- */
export type RunStatus = 'queued' | 'running' | 'waiting_approval' | 'done' | 'failed' | 'stopped';
export type StepStatus = 'waiting' | 'running' | 'done' | 'failed';
export type RunStep = { id: ID; mate: MateKey; label: string; status: StepStatus; startedAt?: string; finishedAt?: string };
export type LogLine = { at: string; source: string; text: string };
export type Approval = { id: ID; mate: MateKey; text: string; paths: string[]; status: 'pending' | 'approved' | 'denied' };
export type RunIn = {
  title: string; prompt: string; workflowId?: ID; askFirst: boolean; status: RunStatus;
  steps: RunStep[]; log: LogLine[]; approvals: Approval[]; fileIds: ID[]; sources: string[]; report: string; notes: string; error?: string;
};
export type Run = Entity<RunIn>;
export type RunEvent =
  | { type: 'status'; status: RunStatus }
  | { type: 'step'; step: RunStep }
  | { type: 'log'; line: LogLine }
  | { type: 'approval'; approval: Approval }
  | { type: 'file'; fileId: ID };

/* ---------- other collections ---------- */
export type TaskIn = { title: string; detail: string; status: 'todo' | 'doing' | 'done'; mate?: MateKey; dueAt?: string; tags: string[] };
export type Task = Entity<TaskIn>;

export type Schedule = { kind: 'manual' | 'daily' | 'weekly' | 'cron'; time?: string; days?: number[]; cron?: string };
export type AutomationIn = { name: string; description: string; workflowId?: ID; schedule: Schedule; enabled: boolean; lastRunAt?: string };
export type Automation = Entity<AutomationIn>;

export type KnowledgeIn = { kind: 'file' | 'url' | 'note'; name: string; url?: string; text?: string; size?: number; status: 'pending' | 'indexed' | 'error' };
export type Knowledge = Entity<KnowledgeIn>;

export type MemoryIn = { kind: 'note' | 'idea' | 'decision' | 'fact' | 'journal' | 'link'; text: string; scope: 'private' | 'shared'; pinned?: boolean };
export type Memory = Entity<MemoryIn>;

export type SkillIn = { name: string; description: string; instructions: string; enabled: boolean; mates: MateKey[] };
export type Skill = Entity<SkillIn>;

export type McpIn = { name: string; transport: 'http' | 'stdio'; url: string; command: string; description: string; catalogId?: string; enabled: boolean; status: 'unverified' | 'connected' | 'error'; tools: string[] };
export type McpServer = Entity<McpIn>;

export type Provider = 'telegram' | 'whatsapp' | 'gdrive' | 'github' | 'email';
export type ConnectionIn = { provider: Provider; label: string; status: 'disconnected' | 'pending' | 'connected' | 'error'; config: Record<string, string> };
export type Connection = Entity<ConnectionIn>;

export type Message = { id: ID; role: 'user' | 'mate' | 'system'; mate?: MateKey; text: string; at: string; state: 'sent' | 'pending' | 'error' };
export type ConversationIn = { title: string; mate?: MateKey; messages: Message[]; mode?: 'chat' | 'plan' | 'ultracode'; detached?: ID[]; members?: MateKey[] };
export type Conversation = Entity<ConversationIn>;

export type CalEventIn = { title: string; start: string; end: string; kind: 'event' | 'reminder' | 'run' | 'automation'; notes: string };
export type CalEvent = Entity<CalEventIn>;

export type FileIn = { name: string; size: number; mime: string; source: 'upload' | 'run'; runId?: ID };
export type FileItem = Entity<FileIn>;

export type MateConfigIn = { mate: MateKey; enabled: boolean; instructions: string; model: string; tools: string[]; description: string; outputFormat: string; memoryScope: 'private' | 'shared' | 'project' };
export type MateConfig = Entity<MateConfigIn>;

export type ProviderIn = { preset: string; name: string; baseUrl: string; apiKey: string; models: string[]; enabled: boolean; fetchedAt?: string };
export type ProviderCfg = Entity<ProviderIn>;

export type SettingsData = {
  displayName: string; email: string; workspaceName: string; timezone: string; model: string;
  askBeforeRisky: boolean; maxSteps: number; allowNetwork: boolean; stopAfterMinutes: number;
  notifyTelegram: boolean; notifyEmail: boolean;
  permissionMode: 'ask' | 'auto' | 'plan'; retriesOnFailure: number;
  hookBeforeTool: string; hookAfterStep: string; hookOnFinish: string; hookOnFailure: string;
  guardContainer: boolean; guardPurchases: boolean; guardLog: boolean;
  chunkSize: number; overlap: number; topK: number; hybrid: boolean; rerank: boolean; citeAlways: boolean; memoryScope: 'private' | 'shared' | 'project';
  prefersShort: boolean; shareSchedule: boolean;
};

export type Session = { signedIn: boolean; name?: string; email?: string; plan?: string };

/** Live events while a Mate answers (server-sent). */
export type ChatEvent = { type: 'start' } | { type: 'delta'; text: string } | { type: 'tool'; name: string } | { type: 'tool_result'; name: string; ok: boolean } | { type: 'done'; message: Message };
