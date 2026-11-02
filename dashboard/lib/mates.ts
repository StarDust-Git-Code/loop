import type { MateKey } from './types';

/** Static product catalogue (what each Mate is). Not user data. */
export type MateDef = { key: MateKey; name: string; role: string; blurb: string; tools: string[]; core: boolean; tint: string };

export const MATE_DEFS: MateDef[] = [
  { key: 'research', tint: '#ffe6e3', name: 'Research', role: 'Core', core: true, blurb: 'Finds information, analyses sources and keeps notes.', tools: ['Web Search', 'Browser', 'File System', 'Vector Search'] },
  { key: 'code', tint: '#e3ebff', name: 'Code', role: 'Core', core: true, blurb: 'Writes, reviews and runs code in a contained container.', tools: ['Terminal', 'File System', 'Code Interpreter'] },
  { key: 'planner', tint: '#f4ecdd', name: 'Planner', role: 'Core', core: true, blurb: 'Breaks big jobs into steps and decides who does each one.', tools: ['File System'] },
  { key: 'writer', tint: '#fff1c9', name: 'Writer', role: 'Core', core: true, blurb: 'Produces reports, scripts and drafts in your voice.', tools: ['File System'] },
  { key: 'browser', tint: '#e2f4d3', name: 'Browser', role: 'Core', core: true, blurb: 'Drives a browser to read pages and fill in forms.', tools: ['Browser'] },
  { key: 'ops', tint: '#ece3ff', name: 'Ops', role: 'Core', core: true, blurb: 'Coordinates operational tasks, files and approvals.', tools: ['File System', 'Terminal'] },
  { key: 'mimo', tint: '#ffe1ee', name: 'Mimo', role: 'Personal', core: false, blurb: 'Your private second brain: memories, reminders and a daily plan.', tools: ['Memory', 'Calendar'] },
  { key: 'orbit', tint: '#e5e9f2', name: 'Orbit', role: 'Personal', core: false, blurb: 'Plans your week and moves things around when plans change.', tools: ['Calendar'] },
  { key: 'recall', tint: '#d6f2f3', name: 'Recall', role: 'Personal', core: false, blurb: 'Finds anything in your memories, files and sources.', tools: ['Memory', 'Vector Search'] },
  { key: 'spark', tint: '#ffe6d3', name: 'Spark', role: 'Creative', core: false, blurb: 'Brainstorms ideas and turns rough thoughts into clear ones.', tools: ['Memory'] },
  { key: 'zen', tint: '#dfecff', name: 'Zen', role: 'Personal', core: false, blurb: 'Protects your focus time and keeps breaks on the calendar.', tools: ['Calendar'] },
  { key: 'luna', tint: '#eadfff', name: 'Luna', role: 'Personal', core: false, blurb: 'Reflects on your day and keeps a journal.', tools: ['Memory'] },
  { key: 'scout', tint: '#f0e2d2', name: 'Scout', role: 'Creative', core: false, blurb: 'Explores topics and places, builds reading lists.', tools: ['Web Search', 'Browser'] },
  { key: 'chef', tint: '#ffebd9', name: 'Chef', role: 'Personal', core: false, blurb: 'Plans meals, grocery lists and routines.', tools: ['Memory'] },
  { key: 'tune', tint: '#d5f1ef', name: 'Tune', role: 'Creative', core: false, blurb: 'Handles audio and music tasks, playlists and notes.', tools: ['File System'] },
  { key: 'data', tint: '#e2dfea', name: 'Data', role: 'Dev', core: false, blurb: 'Cleans data, builds tables and charts and explains them.', tools: ['Code Interpreter', 'File System'] },
  { key: 'byte', tint: '#e1def2', name: 'Byte', role: 'Dev', core: false, blurb: 'Specialist for long coding jobs with checkpoints.', tools: ['Terminal', 'File System', 'Code Interpreter'] },
  { key: 'halo', tint: '#ecebfb', name: 'Halo', role: 'Dev', core: false, blurb: 'Reviews risky actions and asks for your approval.', tools: ['File System'] },
];

export const MATES = Object.fromEntries(MATE_DEFS.map((m) => [m.key, m])) as Record<MateKey, MateDef>;
export const mateImg = (k: MateKey) => `/dots/${k}.png`;
export const ALL_TOOLS = ['Web Search', 'Browser', 'File System', 'Terminal', 'Code Interpreter', 'Vector Search', 'Memory', 'Calendar', 'Run Control'];

/** Card header gradients, from the design boards. */
export const GRAD: Record<MateKey, string> = {
  research: 'linear-gradient(160deg,#FFE1DF,#FFF3EE)', code: 'linear-gradient(160deg,#DCE4FF,#F1F4FF)', planner: 'linear-gradient(160deg,#F1ECFA,#FBF6EA)',
  writer: 'linear-gradient(160deg,#FFEDB0,#FFF8DF)', browser: 'linear-gradient(160deg,#D3F0D1,#EEF9EC)', ops: 'linear-gradient(160deg,#E3D9FF,#F5F1FF)',
  mimo: 'linear-gradient(160deg,#FFD9E6,#FFF0F5)', orbit: 'linear-gradient(160deg,#E4E6EA,#F5F6F8)', recall: 'linear-gradient(160deg,#C9F1F4,#EAFAFB)',
  spark: 'linear-gradient(160deg,#FFD9BF,#FFF1E6)', zen: 'linear-gradient(160deg,#D6E4FF,#F0F5FF)', luna: 'linear-gradient(160deg,#E3D9FF,#F5F1FF)',
  scout: 'linear-gradient(160deg,#EBD3BE,#F8EEE4)', chef: 'linear-gradient(160deg,#FFE2C2,#FFF4E4)', tune: 'linear-gradient(160deg,#BDEFE8,#E6F9F6)',
  data: 'linear-gradient(160deg,#DCD3F5,#F1EDFB)', byte: 'linear-gradient(160deg,#D9D3EE,#EFECF8)', halo: 'linear-gradient(160deg,#E8E4FA,#FBF7FF)',
};
export const mateName = (k: MateKey) => `${MATES[k].name}${MATES[k].core ? ' Mate' : ''}`;
