// Default Mate roster (mirrors dashboard/lib/mates.ts). Seeded per user on first read.
const D = (key, name, core, blurb, tools) => ({ key, name, core, blurb, tools });
export const MATE_DEFS = [
  D('research', 'Research', true, 'Finds information, analyses sources and keeps notes.', ['Web Search', 'Browser', 'File System', 'Vector Search']),
  D('code', 'Code', true, 'Writes, reviews and runs code in a contained container.', ['Terminal', 'File System', 'Code Interpreter']),
  D('planner', 'Planner', true, 'Breaks big jobs into steps and decides who does each one.', ['File System']),
  D('writer', 'Writer', true, 'Produces reports, scripts and drafts in your voice.', ['File System']),
  D('browser', 'Browser', true, 'Drives a browser to read pages and fill in forms.', ['Browser']),
  D('ops', 'Ops', true, 'Coordinates operational tasks, files and approvals.', ['File System', 'Terminal']),
  D('mimo', 'Mimo', false, 'Your private second brain: memories, reminders and a daily plan.', ['Memory', 'Calendar']),
  D('orbit', 'Orbit', false, 'Plans your week and moves things around when plans change.', ['Calendar']),
  D('recall', 'Recall', false, 'Finds anything in your memories, files and sources.', ['Memory', 'Vector Search']),
  D('spark', 'Spark', false, 'Brainstorms ideas and turns rough thoughts into clear ones.', ['Memory']),
  D('zen', 'Zen', false, 'Protects your focus time and keeps breaks on the calendar.', ['Calendar']),
  D('luna', 'Luna', false, 'Reflects on your day and keeps a journal.', ['Memory']),
  D('scout', 'Scout', false, 'Explores topics and places, builds reading lists.', ['Web Search', 'Browser']),
  D('chef', 'Chef', false, 'Plans meals, grocery lists and routines.', ['Memory']),
  D('tune', 'Tune', false, 'Handles audio and music tasks, playlists and notes.', ['File System']),
  D('data', 'Data', false, 'Cleans data, builds tables and charts and explains them.', ['Code Interpreter', 'File System']),
  D('byte', 'Byte', false, 'Specialist for long coding jobs with checkpoints.', ['Terminal', 'File System', 'Code Interpreter']),
  D('halo', 'Halo', false, 'Reviews risky actions and asks for your approval.', ['File System']),
];
export const MATE = Object.fromEntries(MATE_DEFS.map((m) => [m.key, m]));
export const defaultConfig = (m, ts) => ({ createdAt: ts, updatedAt: ts, mate: m.key, enabled: m.core, instructions: '', model: '', tools: m.tools, description: m.blurb, outputFormat: 'Markdown', memoryScope: 'private' });
export const persona = (key, custom = '') => {
  const m = MATE[key] ?? MATE.planner;
  return `You are ${m.name}, a Loopmates mate. ${m.blurb} Be concise, concrete and honest. If you are unsure, say so.${custom ? `\n\nOwner instructions:\n${custom}` : ''}`;
};
