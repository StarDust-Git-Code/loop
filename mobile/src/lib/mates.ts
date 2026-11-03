import { IMAGES } from './images';

export type MateKey = 'research' | 'flow' | 'code' | 'planner' | 'writer' | 'browser' | 'ops' | 'mimo' | 'orbit' | 'recall' | 'spark' | 'zen' | 'luna' | 'scout' | 'chef' | 'tune' | 'data' | 'byte' | 'halo';
export type MateDef = { key: MateKey; name: string; blurb: string; core: boolean; tint: string };

export const MATE_DEFS: MateDef[] = [
  { key: 'research', tint: '#ffe6e3', name: 'Research', core: true, blurb: 'Finds information, analyses sources and keeps notes.' },
  { key: 'flow', tint: '#dff5ec', name: 'Flow', core: true, blurb: 'Designs and edits your workflow canvas from a plain-language goal.' },
  { key: 'code', tint: '#e3ebff', name: 'Code', core: true, blurb: 'Writes, reviews and runs code in a contained container.' },
  { key: 'planner', tint: '#f4ecdd', name: 'Planner', core: true, blurb: 'Breaks big jobs into steps and decides who does each one.' },
  { key: 'writer', tint: '#fff1c9', name: 'Writer', core: true, blurb: 'Produces reports, scripts and drafts in your voice.' },
  { key: 'browser', tint: '#e2f4d3', name: 'Browser', core: true, blurb: 'Drives a browser to read pages and fill in forms.' },
  { key: 'ops', tint: '#ece3ff', name: 'Ops', core: true, blurb: 'Coordinates operational tasks, files and approvals.' },
  { key: 'mimo', tint: '#ffe1ee', name: 'Mimo', core: false, blurb: 'Your private second brain: memories, reminders and a daily plan.' },
  { key: 'orbit', tint: '#e5e9f2', name: 'Orbit', core: false, blurb: 'Plans your week and moves things around when plans change.' },
  { key: 'recall', tint: '#d6f2f3', name: 'Recall', core: false, blurb: 'Finds anything in your memories, files and sources.' },
  { key: 'spark', tint: '#ffe6d3', name: 'Spark', core: false, blurb: 'Brainstorms ideas and turns rough thoughts into clear ones.' },
  { key: 'zen', tint: '#dfecff', name: 'Zen', core: false, blurb: 'Protects your focus time and keeps breaks on the calendar.' },
  { key: 'luna', tint: '#eadfff', name: 'Luna', core: false, blurb: 'Reflects on your day and keeps a journal.' },
  { key: 'scout', tint: '#f0e2d2', name: 'Scout', core: false, blurb: 'Explores topics and places, builds reading lists.' },
  { key: 'chef', tint: '#ffebd9', name: 'Chef', core: false, blurb: 'Plans meals, grocery lists and routines.' },
  { key: 'tune', tint: '#d5f1ef', name: 'Tune', core: false, blurb: 'Handles audio and music tasks, playlists and notes.' },
  { key: 'data', tint: '#e2dfea', name: 'Data', core: false, blurb: 'Cleans data, builds tables and charts and explains them.' },
  { key: 'byte', tint: '#e1def2', name: 'Byte', core: false, blurb: 'Specialist for long coding jobs with checkpoints.' },
  { key: 'halo', tint: '#ecebfb', name: 'Halo', core: false, blurb: 'Reviews risky actions and asks for your approval.' },
];
export const MATES = Object.fromEntries(MATE_DEFS.map((m) => [m.key, m])) as Record<MateKey, MateDef>;
export const mateName = (k: string) => (MATES[k as MateKey] ? `${MATES[k as MateKey].name}${MATES[k as MateKey].core ? ' Mate' : ''}` : k);
export const mateImg = (k: string) => IMAGES[k] ?? IMAGES.planner;
