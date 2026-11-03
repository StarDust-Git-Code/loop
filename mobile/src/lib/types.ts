import type { MateKey } from './mates';
export type Message = { id: string; role: 'user' | 'mate' | 'system'; mate?: MateKey; text: string; at: string; state?: 'sent' | 'pending' | 'error'; thought?: string; round?: number; summary?: boolean };
export type Conversation = { id: string; title: string; mate?: MateKey; messages: Message[]; mode?: 'chat' | 'plan' | 'ultracode' | 'brainstorm'; rounds?: number; members?: MateKey[]; thinking?: string; createdAt: string; updatedAt?: string };
export type Memory = { id: string; kind: 'note' | 'idea' | 'decision' | 'fact' | 'journal' | 'link'; text: string; scope: string; pinned?: boolean; createdAt: string; by?: string };
export type Task = { id: string; title: string; detail?: string; status: 'todo' | 'doing' | 'done'; dueAt?: string };
export type CalEvent = { id: string; title: string; start: string; end?: string; kind?: string };
export type Run = { id: string; title: string; status: string; updatedAt?: string };
export type MateConfig = { id: string; mate: MateKey; enabled: boolean; thinking?: string };
export type Settings = { displayName?: string; defaultThinking?: string; showReasoning?: boolean; brainstormRounds?: number };
export type ChatEvent =
  | { type: 'start' } | { type: 'delta'; text: string } | { type: 'think'; text: string } | { type: 'mate'; mate: MateKey; summary?: boolean }
  | { type: 'round'; n: number; of: number } | { type: 'reset' } | { type: 'tool'; name: string } | { type: 'tool_result'; name: string }
  | { type: 'done'; message: Message } | { type: 'error'; message: string };
