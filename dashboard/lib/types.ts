export type ID = string;
export type Timestamps = { createdAt: string; updatedAt: string };
export type Entity<T> = T & { id: ID } & Timestamps;

/** Built-in Mates, plus custom agents the owner created (any lowercase key). */
export type BuiltinMateKey =
  | 'planner' | 'flow' | 'research' | 'code' | 'writer' | 'browser' | 'ops' | 'mimo' | 'orbit' | 'recall'
  | 'spark' | 'zen' | 'luna' | 'scout' | 'chef' | 'tune' | 'data' | 'byte' | 'halo';
export type MateKey = string;

/* ---------- workflows ---------- */
export type NodeType = 'trigger' | 'knowledge' | 'input' | 'mate' | 'tool' | 'condition' | 'transform' | 'filter' | 'output';
export type FlowNode = { id: ID; type: NodeType; label: string; mate?: MateKey; x: number; y: number; config?: Record<string, string> };
export type FlowEdge = { id: ID; from: ID; to: ID };
export type WorkflowIn = { name: string; description: string; nodes: FlowNode[]; edges: FlowEdge[]; trigger?: string; state?: 'active' | 'scheduled' | 'manual' | 'draft' };
export type Workflow = Entity<WorkflowIn>;

/* ---------- runs ---------- */
export type RunStatus = 'queued' | 'running' | 'waiting_approval' | 'done' | 'failed' | 'stopped';
export type StepStatus = 'waiting' | 'running' | 'done' | 'failed';
export type RunStep = { id: ID; mate: MateKey; label: string; status: StepStatus; startedAt?: string; finishedAt?: string; attempt?: number; error?: string };
export type LogLine = { at: string; source: string; text: string };
export type CallReport = { id: ID; mate: MateKey; mateName?: string; reason?: string; scheduledFor?: string; createdAt?: string; status: 'ringing' | 'answered' | 'done' | 'missed' | 'scheduled' | 'held' | 'cancelled'; goal?: string; questions: string[]; report: { summary: string; answers: string[]; followups: string[]; outcome: string } | null };
export type Approval = { id: ID; mate: MateKey; text: string; paths: string[]; status: 'pending' | 'approved' | 'denied' };
export type RunIn = {
  title: string; prompt: string; workflowId?: ID; askFirst: boolean; status: RunStatus;
  steps: RunStep[]; log: LogLine[]; approvals: Approval[]; fileIds: ID[]; sources: string[]; report: string; notes: string; error?: string; failure?: { step: string | null; stepId: string | null; error: string; attempts: number; at: string } | null;
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

export type KnowledgeIn = { kind: 'file' | 'url' | 'note'; name: string; url?: string; text?: string; size?: number; status: 'pending' | 'indexed' | 'error'; /** Employees may be told this (company assistant on Telegram). */ company?: boolean };
export type Knowledge = Entity<KnowledgeIn>;

/** scope 'shared' = every agent may use it; 'personal' = only `mate` sees it. Old 'private' docs count as shared. */
export type MemoryIn = { kind: 'note' | 'idea' | 'decision' | 'fact' | 'journal' | 'link'; text: string; scope: 'private' | 'shared' | 'personal'; mate?: MateKey; by?: string; pinned?: boolean };
/** What an agent may reach. Enforced on the server. */
export type Access = { memory: { personal: boolean; shared: 'none' | 'read' | 'write' }; graph: 'none' | 'read' | 'write'; skills: 'all' | 'none' | ID[]; mcp: 'all' | 'none' | ID[]; knowledge: boolean };
export type GraphNode = { id: ID; name: string; type: string; aliases: string[]; summary: string; mentions: number; by?: string; updatedAt: string };
export type GraphEdge = { id: ID; from: ID; rel: string; to: ID; confidence: number; by?: string; updatedAt: string; endedAt?: string };
export type Memory = Entity<MemoryIn>;

export type SkillIn = { name: string; description: string; instructions: string; enabled: boolean; mates: MateKey[] };
export type Skill = Entity<SkillIn>;

export type McpIn = { name: string; transport: 'http' | 'stdio'; url: string; command: string; description: string; /** Sealed on the server: HTTP headers, or env vars for a command. Values come back masked. */ config?: Record<string, string>; catalogId?: string; enabled: boolean; status: 'unverified' | 'connected' | 'error'; tools: string[] };
export type McpServer = Entity<McpIn>;

export type Provider = 'telegram' | 'discord' | 'whatsapp' | 'gdrive' | 'github' | 'email' | 'slack' | 'wacloud';
export type ConnectionIn = { provider: Provider; label: string; status: 'disconnected' | 'pending' | 'connected' | 'error'; config: Record<string, string> };
export type Connection = Entity<ConnectionIn>;

export type Message = { id: ID; role: 'user' | 'mate' | 'system'; mate?: MateKey; text: string; at: string; state: 'sent' | 'pending' | 'error'; /** The Mate's reasoning, when the model shared it. */ thought?: string; /** Brainstorm: which round this turn belongs to, and whether it is the closing summary. */ round?: number; summary?: boolean };
export type ConversationIn = { title: string; mate?: MateKey; messages: Message[]; mode?: 'chat' | 'plan' | 'ultracode' | 'brainstorm'; /** Brainstorm rounds for this chat (1 to 4). */ rounds?: number; detached?: ID[]; members?: MateKey[]; /** Thinking level for this chat. Empty or 'default' uses the Mate's own, then the workspace default. */ thinking?: 'default' | 'low' | 'medium' | 'high' | 'xhigh' };
export type Conversation = Entity<ConversationIn>;

export type CalEventIn = { title: string; start: string; end: string; kind: 'event' | 'reminder' | 'run' | 'automation'; notes: string };
export type CalEvent = Entity<CalEventIn>;

export type FileIn = { name: string; size: number; mime: string; source: 'upload' | 'run'; runId?: ID };
export type FileItem = Entity<FileIn>;

export type MateConfigIn = { mate: MateKey; enabled: boolean; access?: Access; /** Custom agents: created by the owner. */ custom?: boolean; name?: string; avatar?: BuiltinMateKey; /** Built-ins the owner removed (restorable). */ removed?: boolean; /** Role card: what this Mate does, what it must not do, who it hands off to. Empty = the built-in card. */ card?: string; /** One line on how this agent sounds; overrides the card's Voice line. Empty = the card's own voice. */ personality?: string; /** Gemini Live call voice. Empty = the built-in voice, or a spare one for a custom agent. */ voice?: string; instructions: string; model: string; tools: string[]; description: string; outputFormat: string; memoryScope: 'private' | 'shared' | 'project'; /** Reasoning effort. 'default' means high. */ thinking?: 'default' | 'low' | 'medium' | 'high' | 'xhigh' };
export type MateConfig = Entity<MateConfigIn>;

export type ProviderIn = { preset: string; name: string; baseUrl: string; apiKey: string; models: string[]; enabled: boolean; fetchedAt?: string };
export type ProviderCfg = Entity<ProviderIn>;

export type SettingsData = {
  displayName: string; email: string; workspaceName: string; timezone: string; model: string;
  askBeforeRisky: boolean; maxSteps: number; allowNetwork: boolean; stopAfterMinutes: number;
  notifyTelegram: boolean; notifyEmail: boolean; notifyApp: boolean; notifyDiscord: boolean; notifySlack?: boolean; notifyWhatsapp?: boolean;
  /** Weekly team stand-up from the leader: day 0 = Sunday, time HH:MM in the owner's timezone. */
  standupOn?: boolean; standupDay?: number; standupAt?: string;
  /** Quiet hours in the owner's timezone, HH:MM. Only the app inbox gets messages then, unless urgent. */
  quietHoursOn: boolean; quietFrom: string; quietTo: string;
  /** The agent that leads the team (default mimo). */
  leader: MateKey;
  /** Which engine does coding steps, and where it runs. */
  coderHarness: HarnessKey; coderSandbox: 'auto' | 'docker' | 'host';
  /** Jarvis mode: call limits and the morning briefing. */
  maxCallsPerDay: number; urgentBreaksQuiet: boolean; briefingOn: boolean; briefingAt: string; briefingCall: boolean;
  /** Company: send check-ins without asking first; AI calls per day for employee chats. */
  companyCheckinsAuto: boolean; companyDailyLlmBudget: number;
  permissionMode: 'ask' | 'auto' | 'plan'; retriesOnFailure: number; verifySteps: boolean; autoMemory: boolean; /** Learn entities and relations into the knowledge graph. */ autoGraph: boolean; /** Memories put in every prompt (0 = none, pinned only). */ autoRecall: number;
  hookBeforeTool: string; hookAfterStep: string; hookOnFinish: string; hookOnFailure: string;
  guardContainer: boolean; guardPurchases: boolean; guardLog: boolean;
  chunkSize: number; overlap: number; topK: number; hybrid: boolean; rerank: boolean; citeAlways: boolean; memoryScope: 'private' | 'shared' | 'project';
  prefersShort: boolean; shareSchedule: boolean;
  /** Developer options. 0 = automatic. Tokens, roughly 4 characters each. */
  maxContextTokens: number; maxOutputTokens: number; defaultThinking: 'low' | 'medium' | 'high' | 'xhigh'; showReasoning: boolean; brainstormRounds: number;
};

export type Session = { signedIn: boolean; name?: string; email?: string; plan?: string };

/** Live events while a Mate answers (server-sent). */
export type ChatEvent = { type: 'start' } | { type: 'delta'; text: string } | { type: 'mate'; mate: MateKey; summary?: boolean } | { type: 'round'; n: number; of: number } | { type: 'reset' } | { type: 'think'; text: string } | { type: 'tool'; name: string } | { type: 'tool_result'; name: string; ok: boolean } | { type: 'done'; message: Message };

/* ---------- the owner's Loopmates server ---------- */
export type ServerFeature = { key: string; label: string; ready: boolean; note: string; fix: string };
export type ServerStatus = { commit: string; url: string; uptime: number; at: string; pairing: { paired: boolean; code: string | null; url: string }; features: ServerFeature[] };
export type ServerField = { key: string; group: string; label: string; help?: string; secret?: boolean; set: boolean; value: string; fromEnv: boolean };
/** A multiple-choice question a Mate asked with ask_owner. */
export type Question = { id: ID; mate: MateKey; question: string; options: string[]; fallback: string; runId: string; status: 'open' | 'answered' | 'expired'; answer: string | null; createdAt: string; expiresAt: string };
export type InboxItem = { id: ID; text: string; title: string; url: string; kind: string; read: boolean; at: string };
export type Device = { id: ID; kind: 'web' | 'expo'; label: string; createdAt: string };

export type HarnessKey = 'builtin' | 'claude' | 'codex' | 'opencode';
export type HarnessInfo = { ok: boolean; version?: string; install?: string; error?: string };
export type Harnesses = Record<HarnessKey, HarnessInfo> & { docker: { ok: boolean; image?: string; error?: string } };
export type HarnessTest = { ok: boolean; summary: string; files: string[]; logs: string[] };

export type WatchIn = { kind: 'runs' | 'calendar' | 'topic' | 'github' | 'feed' | 'home'; label: string; config: { query?: string; repo?: string; url?: string; entity?: string; state?: string; above?: number; below?: number; forMinutes?: number; score?: number }; everyMinutes: number; enabled: boolean; createdBy?: string; lastCheckedAt?: string };
export type Watch = Entity<WatchIn>;
export type Alert = { id: ID; key: string; source: string; title: string; detail: string; score: number; delivered: 'digest' | 'notify' | 'call' | 'held'; url: string; at: string };
/** One optional app from GET /v1/integrations. The steps and fields come from the server, so the guide lives in one place. */
export type Integration = {
  key: string; name: string; badge: string; bg: string; fg: string; group: string; what: string;
  fields: { key: string; label: string; placeholder?: string }[]; steps: { title: string; text: string }[];
  ready: boolean; note: string; tools: string[];
  manifest?: string; webhookUrl?: string; linkCode?: boolean; ingestUrl?: string;
  oauth?: { label: string; redirect: string; publicRedirect: string };
  actions?: { id: string; label: string }[];
};
export type StandupLine = { mate: MateKey; name: string; line: string };
export type Standup = { id: ID; at: string; text: string; lines: StandupLine[] };
export type LeaderState ={ leader: MateKey; name: string; watches: Watch[]; alerts: Alert[] };

export type PersonIn = { name: string; role: string; teamId: ID; managerId?: ID; contact: { email?: string; telegramChatId?: string; telegramUser?: string }; timezone?: string; skills: string[]; status: 'active' | 'away' | 'left' };
export type Person = Entity<PersonIn>;
export type TeamIn = { name: string; description: string; leadId?: ID };
export type Team = Entity<TeamIn>;
export type AssignmentIn = { title: string; detail: string; assigneeId: ID; projectId?: ID; due?: string; status: 'todo' | 'doing' | 'done' | 'blocked'; note?: string; by?: string };
export type Assignment = Entity<AssignmentIn>;
export type CheckinIn = { personId: ID; assignmentId?: ID; question: string; status: 'draft' | 'sent' | 'answered' | 'discarded'; reply?: string; replyStatus?: string; error?: string; sentAt?: string; answeredAt?: string; by?: string };
export type Checkin = Entity<CheckinIn>;
