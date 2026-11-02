import type { MateKey } from './types';

/** Static product catalogue (what each Mate is). Not user data. */
export type MateDef = { key: MateKey; name: string; role: string; blurb: string; tools: string[]; core: boolean };

export const MATE_DEFS: MateDef[] = [
  { key: 'research', name: 'Research', role: 'Core', core: true, blurb: 'Finds information, analyses sources and keeps notes.', tools: ['Web Search', 'Browser', 'File System', 'Vector Search'] },
  { key: 'code', name: 'Code', role: 'Core', core: true, blurb: 'Writes, reviews and runs code in a contained container.', tools: ['Terminal', 'File System', 'Code Interpreter'] },
  { key: 'planner', name: 'Planner', role: 'Core', core: true, blurb: 'Breaks big jobs into steps and decides who does each one.', tools: ['File System'] },
  { key: 'writer', name: 'Writer', role: 'Core', core: true, blurb: 'Produces reports, scripts and drafts in your voice.', tools: ['File System'] },
  { key: 'browser', name: 'Browser', role: 'Core', core: true, blurb: 'Drives a browser to read pages and fill in forms.', tools: ['Browser'] },
  { key: 'ops', name: 'Ops', role: 'Core', core: true, blurb: 'Coordinates operational tasks, files and approvals.', tools: ['File System', 'Terminal'] },
  { key: 'mimo', name: 'Mimo', role: 'Personal', core: false, blurb: 'Your private second brain: memories, reminders and a daily plan.', tools: ['Memory', 'Calendar'] },
  { key: 'orbit', name: 'Orbit', role: 'Personal', core: false, blurb: 'Plans your week and moves things around when plans change.', tools: ['Calendar'] },
  { key: 'recall', name: 'Recall', role: 'Personal', core: false, blurb: 'Finds anything in your memories, files and sources.', tools: ['Memory', 'Vector Search'] },
  { key: 'spark', name: 'Spark', role: 'Creative', core: false, blurb: 'Brainstorms ideas and turns rough thoughts into clear ones.', tools: ['Memory'] },
  { key: 'zen', name: 'Zen', role: 'Personal', core: false, blurb: 'Protects your focus time and keeps breaks on the calendar.', tools: ['Calendar'] },
  { key: 'luna', name: 'Luna', role: 'Personal', core: false, blurb: 'Reflects on your day and keeps a journal.', tools: ['Memory'] },
  { key: 'scout', name: 'Scout', role: 'Creative', core: false, blurb: 'Explores topics and places, builds reading lists.', tools: ['Web Search', 'Browser'] },
  { key: 'chef', name: 'Chef', role: 'Personal', core: false, blurb: 'Plans meals, grocery lists and routines.', tools: ['Memory'] },
  { key: 'tune', name: 'Tune', role: 'Creative', core: false, blurb: 'Handles audio and music tasks, playlists and notes.', tools: ['File System'] },
  { key: 'data', name: 'Data', role: 'Dev', core: false, blurb: 'Cleans data, builds tables and charts and explains them.', tools: ['Code Interpreter', 'File System'] },
  { key: 'byte', name: 'Byte', role: 'Dev', core: false, blurb: 'Specialist for long coding jobs with checkpoints.', tools: ['Terminal', 'File System', 'Code Interpreter'] },
  { key: 'halo', name: 'Halo', role: 'Dev', core: false, blurb: 'Reviews risky actions and asks for your approval.', tools: ['File System'] },
];

export const MATES = Object.fromEntries(MATE_DEFS.map((m) => [m.key, m])) as Record<MateKey, MateDef>;
export const mateImg = (k: MateKey) => `/dots/${k}.png`;
export const ALL_TOOLS = ['Web Search', 'Browser', 'File System', 'Terminal', 'Code Interpreter', 'Vector Search', 'Memory', 'Calendar'];
export const MODELS = ['Claude Sonnet 5.5', 'Claude Opus 5.5', 'Claude Haiku 5.5'];
