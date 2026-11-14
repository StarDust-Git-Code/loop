export type MateKey =
  | "research" | "code" | "planner" | "writer" | "browser" | "ops"
  | "mimo" | "orbit" | "recall" | "spark" | "zen" | "luna"
  | "scout" | "chef" | "tune" | "data" | "byte" | "halo" | "flow";

export const mateSrc = (k: MateKey) => `/dots/${k}.png`;

export interface RosterMate {
  key: MateKey;
  name: string;
  role: string;
  tag: string;
  /** Glow colour behind the mascot on the roster stage. */
  color: string;
  about: string;
  ask: string;
}

/** The Mates shown on the landing page roster. The product ships 19 built-in Mates. */
export const TOTAL_MATES = 19;

export const ROSTER: RosterMate[] = [
  { key: "mimo", name: "Mimo", role: "Leader and second brain", tag: "Leader", color: "#F27AA8", about: "Hands work out to the team, remembers what you tell it, and decides what is worth a message or a call.", ask: "What did I decide about the hackathon demo last week?" },
  { key: "research", name: "Research", role: "Finds and cites sources", tag: "Core", color: "#E8382F", about: "Digs through the web and your documents, cross-checks claims and hands back a summary with every source linked.", ask: "Compare the top three court-booking apps and cite your sources." },
  { key: "code", name: "Code", role: "Writes and runs code", tag: "Core", color: "#3D5BF0", about: "Reads your repo, edits in small steps, runs the tests in a sandbox and explains what changed, so you can review every diff.", ask: "Add dark mode to the settings page and run the tests." },
  { key: "planner", name: "Planner", role: "Splits the work", tag: "Core", color: "#E3D3C1", about: "Breaks a big goal into clear steps and picks the right Mate for each one. You approve the plan before anything starts.", ask: "Plan a launch week for the new landing page." },
  { key: "writer", name: "Writer", role: "Scripts, reports, copy", tag: "Core", color: "#F3BB3C", about: "Turns notes and research into scripts, reports, posts and emails in your voice. Drafts first, then tightens it with you.", ask: "Turn these notes into a one-page project brief." },
  { key: "luna", name: "Luna", role: "Evening journal", tag: "Personal", color: "#A56BDB", about: "Wraps up the day, journals into your daily note and runs overnight jobs, with a summary waiting in the morning.", ask: "Wrap up my day and start the report overnight." },
  { key: "orbit", name: "Orbit", role: "Plans your weeks", tag: "Personal", color: "#9DB7E8", about: "Looks at your real calendar and shapes the week: deadlines, projects and rest. Moves things when plans change.", ask: "Fit two lab sessions and a project sprint into my week." },
  { key: "halo", name: "Halo", role: "Asks before risky actions", tag: "Safety", color: "#E3C9F2", about: "Steps in before anything is sent, deleted, spent or posted. Shows exactly what will happen and waits for your yes.", ask: "Ask me before any message leaves my account." },
];

export interface TeamMate {
  key: MateKey;
  name: string;
  /** One plain sentence, from the product's own Mate table. */
  role: string;
  /** Switched on when you first install. Every Mate can be switched on or off. */
  on: boolean;
}

/** All 19 built-in Mates. */
export const ALL_MATES: TeamMate[] = [
  { key: "mimo", name: "Mimo", role: "Your second brain and team lead: memories, reminders and a daily plan.", on: false },
  { key: "research", name: "Research", role: "Finds information, checks sources and keeps notes.", on: true },
  { key: "code", name: "Code", role: "Writes, reviews and runs code in a sealed sandbox.", on: true },
  { key: "planner", name: "Planner", role: "Breaks big jobs into steps and decides who does each one.", on: true },
  { key: "flow", name: "Flow", role: "Builds your automations from a plain-language goal.", on: true },
  { key: "writer", name: "Writer", role: "Writes reports, scripts and drafts in your voice.", on: true },
  { key: "browser", name: "Browser", role: "Opens websites, reads pages and fills in forms.", on: true },
  { key: "ops", name: "Ops", role: "Keeps track of files, tasks and approvals.", on: true },
  { key: "halo", name: "Halo", role: "Checks risky actions and asks for your yes first.", on: false },
  { key: "orbit", name: "Orbit", role: "Plans your week and moves things when plans change.", on: false },
  { key: "recall", name: "Recall", role: "Finds anything in your memories, files and sources.", on: false },
  { key: "spark", name: "Spark", role: "Brainstorms ideas and turns rough thoughts into clear ones.", on: false },
  { key: "zen", name: "Zen", role: "Protects your focus time and keeps breaks on the calendar.", on: false },
  { key: "luna", name: "Luna", role: "Looks back on your day and keeps a journal.", on: false },
  { key: "scout", name: "Scout", role: "Explores topics and places and builds reading lists.", on: false },
  { key: "chef", name: "Chef", role: "Plans meals, grocery lists and routines.", on: false },
  { key: "tune", name: "Tune", role: "Handles music, playlists and audio notes.", on: false },
  { key: "data", name: "Data", role: "Cleans data, builds tables and charts and explains them.", on: false },
  { key: "byte", name: "Byte", role: "Takes on long coding jobs with checkpoints along the way.", on: false },
];
