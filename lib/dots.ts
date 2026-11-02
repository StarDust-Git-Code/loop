export type DotKey =
  | "research" | "code" | "planner" | "writer" | "browser" | "ops"
  | "mimo" | "orbit" | "recall" | "spark" | "zen" | "luna"
  | "scout" | "chef" | "tune" | "data" | "byte" | "halo";

export type Category = "Core" | "Personal" | "Creative" | "Dev";

export interface Dot {
  key: DotKey;
  name: string;
  role: string;
  category: Category;
  tint: string;
  bubble: string;
}

const T = {
  pink: "linear-gradient(160deg,#FFD9E6,#FFF0F5)",
  blue: "linear-gradient(160deg,#D6E8FF,#EEF5FF)",
  yellow: "linear-gradient(160deg,#FFEDB0,#FFF8DF)",
  violet: "linear-gradient(160deg,#E3D9FF,#F6F2FF)",
  mint: "linear-gradient(160deg,#CFF1DC,#EEFAF2)",
  peach: "linear-gradient(160deg,#FFDCC2,#FFF3E8)",
  cyan: "linear-gradient(160deg,#BDEFF2,#E9FAFB)",
};
export const TINTS = T;

export const DOTS: Dot[] = [
  { key: "research", name: "Research", role: "Finds and summarises sources", category: "Core", tint: T.pink, bubble: "#FF8FB5" },
  { key: "code", name: "Code", role: "Writes and runs code", category: "Core", tint: T.blue, bubble: "#5B8CFF" },
  { key: "planner", name: "Planner", role: "Plans the steps", category: "Core", tint: T.yellow, bubble: "#FFB020" },
  { key: "writer", name: "Writer", role: "Scripts, reports, copy", category: "Core", tint: T.yellow, bubble: "#FFB020" },
  { key: "browser", name: "Browser", role: "Works in the browser", category: "Core", tint: T.mint, bubble: "#34B36B" },
  { key: "ops", name: "Ops", role: "Retries and approvals", category: "Core", tint: T.violet, bubble: "#8B6BFF" },
  { key: "mimo", name: "Mimo", role: "Your second-brain buddy", category: "Personal", tint: T.pink, bubble: "#FF8FB5" },
  { key: "orbit", name: "Orbit", role: "Plans your weeks", category: "Personal", tint: T.blue, bubble: "#5B8CFF" },
  { key: "recall", name: "Recall", role: "Finds your memories", category: "Personal", tint: T.cyan, bubble: "#1FA9B5" },
  { key: "zen", name: "Zen", role: "Protects your focus", category: "Personal", tint: T.blue, bubble: "#5B8CFF" },
  { key: "luna", name: "Luna", role: "Evening journal", category: "Personal", tint: T.violet, bubble: "#8B6BFF" },
  { key: "chef", name: "Chef", role: "Meals and routines", category: "Personal", tint: T.peach, bubble: "#FF8A3D" },
  { key: "spark", name: "Spark", role: "Turns ideas into notes", category: "Creative", tint: T.peach, bubble: "#FF8A3D" },
  { key: "tune", name: "Tune", role: "Audio and music", category: "Creative", tint: T.cyan, bubble: "#1FA9B5" },
  { key: "scout", name: "Scout", role: "Explores and plans trips", category: "Creative", tint: T.peach, bubble: "#FF8A3D" },
  { key: "byte", name: "Byte", role: "Ultracode runs", category: "Dev", tint: T.violet, bubble: "#8B6BFF" },
  { key: "data", name: "Data", role: "Tables and charts", category: "Dev", tint: T.violet, bubble: "#8B6BFF" },
  { key: "halo", name: "Halo", role: "Asks before risky actions", category: "Dev", tint: T.violet, bubble: "#8B6BFF" },
];

export const dot = (k: DotKey) => DOTS.find((d) => d.key === k)!;

/** Order of cards in the hero rail (the centre card on load is index 2). */
export const RAIL_ORDER: DotKey[] = [
  "spark", "research", "mimo", "byte", "planner", "code", "browser", "writer", "halo",
  "ops", "orbit", "recall", "zen", "luna", "scout", "chef", "tune", "data",
];
