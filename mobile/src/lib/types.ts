import type { MateKey } from './mates';
export type Message = { id: string; role: 'user' | 'mate' | 'system'; mate?: MateKey; text: string; at: string; state?: 'sent' | 'pending' | 'error'; thought?: string; round?: number; summary?: boolean };
export type Conversation = { id: string; title: string; mate?: MateKey; messages: Message[]; mode?: 'chat' | 'plan' | 'ultracode' | 'brainstorm'; rounds?: number; members?: MateKey[]; thinking?: string; pinned?: boolean; createdAt: string; updatedAt?: string };
export type Memory = { id: string; kind: 'note' | 'idea' | 'decision' | 'fact' | 'journal' | 'link'; text: string; scope: string; pinned?: boolean; createdAt: string; by?: string };
export type Task = { id: string; title: string; detail?: string; status: 'todo' | 'doing' | 'done'; dueAt?: string; mate?: MateKey; tags?: string[] };
export type CalEvent = { id: string; title: string; start: string; end?: string; kind?: 'event' | 'reminder' | 'run' | 'automation'; notes?: string };
export type RunStatus = 'queued' | 'running' | 'waiting_approval' | 'done' | 'failed' | 'stopped';
export type RunStep = { id: string; mate: MateKey; label: string; status: 'waiting' | 'running' | 'done' | 'failed'; startedAt?: string; finishedAt?: string };
export type Approval = { id: string; mate: MateKey; text: string; paths: string[]; status: 'pending' | 'approved' | 'denied' };
export type Run = { id: string; title: string; prompt: string; status: RunStatus; steps: RunStep[]; log: { at: string; source: string; text: string }[]; approvals: Approval[]; sources: string[]; report: string; notes: string; error?: string; createdAt: string; updatedAt: string };
export type Skill = { id: string; name: string; description: string; instructions: string; enabled: boolean; mates: MateKey[] };
export type Workflow = { id: string; name: string; description: string; nodes: { id: string; type: string; label: string; mate?: MateKey }[]; edges: unknown[]; state?: string };
export type Connection = { id: string; provider: 'telegram' | 'whatsapp' | 'gdrive' | 'github' | 'email'; label: string; status: 'disconnected' | 'pending' | 'connected' | 'error'; config: Record<string, string> };
export type FileItem = { id: string; name: string; size: number; mime: string; source: string; createdAt: string };
export type MateConfig = { id: string; mate: MateKey; enabled: boolean; thinking?: string; instructions?: string; model?: string; tools?: string[]; description?: string; outputFormat?: string; memoryScope?: string };
export type Settings = { displayName?: string; defaultThinking?: string; showReasoning?: boolean; brainstormRounds?: number };
export type ChatEvent =
  | { type: 'start' } | { type: 'delta'; text: string } | { type: 'think'; text: string } | { type: 'mate'; mate: MateKey; summary?: boolean }
  | { type: 'round'; n: number; of: number } | { type: 'reset' } | { type: 'tool'; name: string } | { type: 'tool_result'; name: string }
  | { type: 'done'; message: Message } | { type: 'error'; message: string };
