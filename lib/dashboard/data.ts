import { AGENT } from './brand';

export type MateKey = 'planner' | 'research' | 'code' | 'writer' | 'browser' | 'ops';

export const MATES: Record<MateKey, { name: string; src: string }> = {
  planner: { name: 'Planner', src: '/dashboard/mates/planner.png' },
  research: { name: 'Research', src: '/dashboard/mates/research.png' },
  code: { name: 'Code', src: '/dashboard/mates/code.png' },
  writer: { name: 'Writer', src: '/dashboard/mates/writer.png' },
  browser: { name: 'Browser', src: '/dashboard/mates/browser.png' },
  ops: { name: 'Ops', src: '/dashboard/mates/ops.png' },
};

export const HERO_MATES: MateKey[] = ['planner', 'research', 'code', 'writer', 'browser', 'ops'];

export const SIDEBAR_MATES: MateKey[] = ['research', 'code', 'planner', 'writer', 'browser', 'ops'];

export const GEAR_PATH =
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z';

export const NAV: { label: string; d: string; href?: string }[] = [
  { label: 'Home', href: '/dashboard', d: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { label: 'My Space', d: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z' },
  { label: 'Chat', d: 'M21 12a8 8 0 0 1-11.5 7.2L4 20l1.1-4.3A8 8 0 1 1 21 12z' },
  { label: 'Agents', d: 'M12 3l2.5 5.5 5.5.8-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.5-.8z' },
  { label: 'Workflows', d: 'M5 4h5v5H5zM14 15h5v5h-5zM10 6.5h2a3 3 0 0 1 3 3V15' },
  { label: 'Knowledge', d: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 8h6' },
  { label: 'Files', d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5' },
  { label: 'Tasks', d: 'M9 12l2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z' },
  {
    label: 'Skills & MCP',
    d: 'M10 4a2 2 0 1 1 4 0v1h3a1 1 0 0 1 1 1v3h-1a2 2 0 1 0 0 4h1v3a1 1 0 0 1-1 1h-3v-1a2 2 0 1 0-4 0v1H7a1 1 0 0 1-1-1v-3h1a2 2 0 1 0 0-4H6V6a1 1 0 0 1 1-1h3z',
  },
  {
    label: 'Connections',
    d: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  },
  { label: 'Automations', d: 'M13 2L4 14h7l-1 8 9-12h-7z' },
];

export const SAVED_WORKFLOWS: { title: string; sub: string; meta: string; mates: MateKey[] }[] = [
  {
    title: 'Research and compare',
    sub: 'Plan, gather sources, write a sourced comparison.',
    meta: 'Planner → Research → Writer',
    mates: ['planner', 'research', 'writer'],
  },
  {
    title: 'Code review pass',
    sub: 'Plan the checks, run the tests, summarise findings.',
    meta: 'Planner → Code',
    mates: ['planner', 'code'],
  },
  {
    title: 'Weekly digest',
    sub: 'Browse saved sites and write a Monday summary.',
    meta: 'Scheduled · Mondays',
    mates: ['browser', 'research', 'writer'],
  },
];

export type StepStatus = 'Done' | 'Running' | 'Waiting';

export const RUN_TITLE = 'SkillCourt vs SmartCourt';

export const RUN_STEPS: { mate: MateKey; label: string; status: StepStatus }[] = [
  { mate: 'planner', label: 'Plan the comparison', status: 'Done' },
  { mate: 'research', label: 'Gather sources', status: 'Done' },
  { mate: 'browser', label: 'Browse product pages', status: 'Running' },
  { mate: 'code', label: 'Build comparison table', status: 'Waiting' },
  { mate: 'writer', label: 'Write the report', status: 'Waiting' },
];

export const APPROVAL = {
  mate: 'ops' as MateKey,
  text: `${MATES.ops.name} ${AGENT} wants to write 3 files to`,
  path: '/workspace/research/skillcourt',
};

export const RECENT_RUNS: {
  mate: MateKey;
  title: string;
  meta: string;
  status: 'Done' | 'Failed';
}[] = [
  { mate: 'research', title: 'Competitor scan', meta: `Research ${AGENT} · 12 sources · 2h ago`, status: 'Done' },
  { mate: 'code', title: 'Parse sensor logs', meta: `Code ${AGENT} · 1 file · Yesterday`, status: 'Done' },
  { mate: 'writer', title: 'Draft weekly update', meta: `Writer ${AGENT} · Yesterday`, status: 'Failed' },
  { mate: 'browser', title: 'Pricing page snapshot', meta: `Browser ${AGENT} · Mon`, status: 'Done' },
];
