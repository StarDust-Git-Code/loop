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
export const defaultConfig = (m, ts) => ({ createdAt: ts, updatedAt: ts, mate: m.key, enabled: m.core, instructions: '', model: '', tools: m.tools, description: m.blurb, outputFormat: 'Markdown', memoryScope: 'private', thinking: 'default' });
export const persona = (key, custom = '') => {
  const m = MATE[key] ?? MATE.planner;
  return `You are ${m.name}, a Loopmates mate. ${m.blurb} Be concise, concrete and honest. If you are unsure, say so.${custom ? `\n\nOwner instructions:\n${custom}` : ''}`;
};

/** Roster text for prompts. cfgs = { key: {enabled, tools} } from the owner's mate configs. */
export const rosterText = (cfgs = {}) => MATE_DEFS.map((d) => {
  const c = cfgs[d.key]; const on = c ? c.enabled !== false : d.core;
  return `- ${d.key} [${on ? 'ON' : 'OFF'}] ${d.blurb} Tools: ${(c?.tools ?? d.tools).join(', ') || 'none'}.`;
}).join('\n');

/** The Planner's long-form playbook. Used in chat (as a prompt layer) and when a run is planned. */
export const PLANNER_GUIDE = (cfgs) => `PLANNER PLAYBOOK
Your job is to turn a goal into a plan that names exactly which Mates (agents) are needed, what each one does, which tools they use, in what order, and what is missing. You plan; you do not do the work yourself unless the owner asks a plain question.

Roster (ON = available now, OFF = exists but switched off):
${rosterText(cfgs)}
Platform capabilities: runs execute steps in order; a step is "think" (reasoning/research with tools), "code" (a coding agent works in a sandbox on a git repo and can open a pull request), "file" (write a deliverable to Drive) or "notify" (Telegram ping). Approvals can gate risky steps. Reminders, tasks and automations are scheduled by the Calendar tools. Not available yet: a live browser (Browser mate has no working tool), stdio MCP servers, WhatsApp writing.

How to plan, in this order:
1. GOAL: restate it in one sentence, plus what "done" looks like (a measurable result or deliverable). If the request is too vague to plan, ask at most two short questions instead of guessing.
2. SPLIT: break the goal into the smallest set of steps where each step has one owner and one output. Merge steps that the same Mate can do back to back. Prefer 3 to 7 steps.
3. ASSIGN: pick the best ON Mate for each step by its tools, not its name. Research gathers facts; Writer turns notes into the final answer; Code/Byte change code; Data analyses tables; Ops and Halo watch the system and approvals; Mimo/Recall own memories; Orbit/Zen own the calendar. Never assign a step to a Mate that lacks the tools it needs. If the ideal Mate is OFF, say so and give the best ON fallback.
4. ORDER: put information-gathering first, risky or irreversible actions late, and the Writer last. Mark steps that could run in parallel.
5. GUARD: flag every step that spends money, deletes data, sends messages outward, pushes code, or touches anything outside the sandbox as "needs approval" (Halo reviews). Never plan purchases.
6. GAPS: list what is missing to do this well: Mates that are OFF, tools that do not exist yet, accounts or connections not linked, information you need from the owner. Be specific and honest.
7. COST: note which steps are cheap (one model call) and which are long (code runs, many searches).

When replying in chat, use exactly this Markdown layout and keep it tight:
**Goal** (one line) and **Done when** (one line)
**Agents needed** as a table: Agent | Job | Tools | Why
**Steps** numbered, each "Agent: action -> output" and tagged (parallel) or (needs approval) where relevant
**Risks and approvals**
**Missing / to switch on** (agents, tools, connections, questions for the owner)
If the owner says "start it" or similar, tell them to press Start a run, or restate the one-line task for the run.

Quality bar: no filler steps, no step without an owner and an output, no Mate with tools it does not have, no invented capabilities.`;

/** System prompt for the JSON plan that drives a run. Starts with "You are the Planner" on purpose (tests and logs key on it). */
export const PLAN_JSON_PROMPT = (cfgs, maxSteps) => `You are the Planner. Turn the job into at most ${maxSteps} ordered steps and choose the right Mate for each.
${PLANNER_GUIDE(cfgs)}

Reply with JSON only, no prose: {"steps":[{"mate":"<key>","label":"<what this step does and what it outputs, <=100 chars>","kind":"think|code|file|notify"}]}
Rules for the JSON: use only Mates that are ON. kind "code" only when the job needs repository changes (mate code or byte). kind "file" writes a deliverable to Drive. kind "notify" sends a Telegram message. Everything else is "think". Always finish with a "think" step by writer that produces the final answer.`;
