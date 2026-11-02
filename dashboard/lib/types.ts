export type ID = string;
export type Timestamps = { createdAt: string; updatedAt: string };
export type Entity<T> = T & { id: ID } & Timestamps;

export type MateKey =
  | 'planner' | 'research' | 'code' | 'writer' | 'browser' | 'ops' | 'mimo' | 'orbit' | 'recall'
  | 'spark' | 'zen' | 'luna' | 'scout' | 'chef' | 'tune' | 'data' | 'byte' | 'halo';

/* ---------- workflows ---------- */
export type NodeType = 'trigger' | 'mate' | 'tool' | 'condition' | 'output';
export type FlowNode = { id: ID; type: NodeType; label: string; mate?: MateKey; x: number; y: number; config?: Record<string, string> };
export type FlowEdge = { id: ID; from: ID; to: ID };
export type WorkflowIn = { name: string; description: string; nodes: FlowNode[]; edges: FlowEdge[] };
export type Workflow = Entity<WorkflowIn>;

/* ---------- runs ---------- */
export type RunStatus = 'queued' | 'running' | 'waiting_approval' | 'done' | 'failed' | 'stopped';
export type StepStatus = 'waiting' | 'running' | 'done' | 'failed';
export type RunStep = { id: ID; mate: MateKey; label: string; status: StepStatus; startedAt?: string; finishedAt?: string };
export type LogLine = { at: string; source: string; text: string };
export type Approval = { id: ID; mate: MateKey; text: string; paths: string[]; status: 'pending' | 'approved' | 'denied' };
export type RunIn = {
  title: string; prompt: string; workflowId?: ID; askFirst: boolean; status: RunStatus;
  steps: RunStep[]; log: LogLine[]; approvals: Approval[]; fileIds: ID[]; sources: string[]; error?: string;
};
export type Run = Entity<RunIn>;
export type RunEvent =
  | { type: 'status'; status: RunStatus }
  | { type: 'step'; step: RunStep }
  | { type: 'log'; line: LogLine }
  | { type: 'approval'; approval: Approval }
  | { type: 'file'; fileId: ID };

/* ---------- other collections ---------- */
export type TaskIn = { title: string; detail: string; status: 'todo' | 'doing' | 'done'; mate?: MateKey; dueAt?: string };
export type Task = Entity<TaskIn>;

export type Schedule = { kind: 'manual' | 'daily' | 'weekly' | 'cron'; time?: string; days?: number[]; cron?: string };
export type AutomationIn = { name: string; description: string; workflowId?: ID; schedule: Schedule; enabled: boolean; lastRunAt?: string };
export type Automation = Entity<AutomationIn>;

export type KnowledgeIn = { kind: 'file' | 'url' | 'note'; name: string; url?: string; text?: string; size?: number; status: 'pending' | 'indexed' | 'error' };
export type Knowledge = Entity<KnowledgeIn>;

export type MemoryIn = { kind: 'note' | 'idea' | 'decision' | 'fact'; text: string; scope: 'private' | 'shared' };
export type Memory = Entity<MemoryIn>;

export type SkillIn = { name: string; description: string; instructions: string; enabled: boolean; mates: MateKey[] };
export type Skill = Entity<SkillIn>;

export type McpIn = { name: string; url: string; description: string; enabled: boolean; status: 'unverified' | 'connected' | 'error'; tools: string[] };
export type McpServer = Entity<McpIn>;

export type Provider = 'telegram' | 'whatsapp' | 'gdrive' | 'github' | 'email';
export type ConnectionIn = { provider: Provider; label: string; status: 'disconnected' | 'pending' | 'connected' | 'error'; config: Record<string, string> };
export type Connection = Entity<ConnectionIn>;

export type Message = { id: ID; role: 'user' | 'mate' | 'system'; mate?: MateKey; text: string; at: string; state: 'sent' | 'pending' | 'error' };
export type ConversationIn = { title: string; messages: Message[] };
export type Conversation = Entity<ConversationIn>;

export type CalEventIn = { title: string; start: string; end: string; kind: 'event' | 'reminder' | 'run' | 'automation'; notes: string };
export type CalEvent = Entity<CalEventIn>;

export type FileIn = { name: string; size: number; mime: string; source: 'upload' | 'run'; runId?: ID };
export type FileItem = Entity<FileIn>;

export type MateConfigIn = { mate: MateKey; enabled: boolean; instructions: string; model: string; tools: string[] };
export type MateConfig = Entity<MateConfigIn>;

export type SettingsData = {
  displayName: string; email: string; workspaceName: string; timezone: string; model: string;
  askBeforeRisky: boolean; maxSteps: number; allowNetwork: boolean; stopAfterMinutes: number;
  notifyTelegram: boolean; notifyEmail: boolean;
};

export type Session = { signedIn: boolean; name?: string; email?: string; plan?: string };
