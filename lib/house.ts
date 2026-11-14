import type { MateKey } from "./mates";

/**
 * Everything the house film needs to know about its pictures.
 * Coordinates are in each picture's own pixels (the "logical" size below), so a sharper
 * replacement image only needs the same framing, not new numbers.
 */

export type Rect = readonly [x0: number, y0: number, x1: number, y1: number];

/** The cottage at night, lights on (night.webp) and off (night-off.webp). Same camera. */
export const EXT = { w: 1672, h: 941 } as const;
/** The cutaway: the house with its front taken off (inside.webp). */
export const INT = { w: 1536, h: 1024 } as const;
/** The foreground grass strip (grass.webp). */
export const GRASS = { w: 2172, h: 263 } as const;

export const ext = {
  /** The whole cottage with the trees either side. */
  house: [880, 470, 1330, 880] as Rect,
  /** The big upstairs window the camera flies into. */
  window: [1092, 618, 1152, 678] as Rect,
  door: [996, 712, 1040, 790] as Rect,
  /** Where new chimney smoke starts. */
  chimney: [1200, 488] as const,
};

/**
 * Lit windows, found by subtracting the lights-off picture from the lights-on one.
 * Listed in the order they go dark.
 */
export const WINDOWS: Rect[] = [
  [1058, 540, 1120, 606], // round attic window
  [984, 602, 1078, 682], // upstairs left
  [1080, 606, 1164, 690], // upstairs middle
  [1204, 612, 1272, 690], // upstairs right
  [1200, 700, 1272, 778], // downstairs right
  [1050, 694, 1166, 800], // downstairs middle
  [820, 660, 1070, 880], // porch, lantern and front door
];

/** Real stars in night.webp, brightest first. They twinkle in place. */
export const STARS: [number, number][] = [
  [278, 24], [1164, 28], [66, 123], [174, 138], [1308, 40], [196, 56], [1017, 42], [767, 95],
  [99, 206], [136, 89], [23, 195], [1324, 144], [31, 331], [1446, 325], [513, 98], [1651, 195],
  [194, 366], [1340, 329], [1641, 253], [987, 199], [1370, 252], [774, 21], [272, 143], [1219, 92],
  [33, 411], [441, 78], [705, 72], [823, 84], [117, 291], [901, 152],
];

/** Extra stars for the sky above the picture, seen on tall phone screens. */
export const SKY_STARS: [number, number][] = [
  [742, -40], [812, -180], [905, -96], [968, -310], [1040, -22], [1102, -210], [1180, -120], [1236, -350],
  [1290, -64], [1352, -250], [1418, -150], [1470, -30], [860, -420], [1010, -470], [1320, -440], [780, -300],
];

export const int = {
  house: [372, 8, 1244, 905] as Rect,
  door: [882, 708, 978, 856] as Rect,
  mailSlot: [930, 779] as const,
  fire: [872, 512] as const,
};

/** Where each Mate stands in the cutaway: centre x, the floor under its feet, width. */
export const SPOTS: Record<MateKey, { x: number; y: number; w: number }> = {
  luna: { x: 740, y: 272, w: 64 },
  orbit: { x: 905, y: 268, w: 64 },
  research: { x: 546, y: 404, w: 64 },
  scout: { x: 625, y: 428, w: 62 },
  code: { x: 740, y: 428, w: 64 },
  byte: { x: 885, y: 428, w: 62 },
  planner: { x: 1000, y: 428, w: 62 },
  flow: { x: 1135, y: 428, w: 62 },
  writer: { x: 525, y: 556, w: 62 },
  mimo: { x: 750, y: 522, w: 74 },
  spark: { x: 912, y: 556, w: 60 },
  chef: { x: 1010, y: 556, w: 64 },
  tune: { x: 600, y: 678, w: 62 },
  data: { x: 740, y: 678, w: 62 },
  recall: { x: 1000, y: 678, w: 62 },
  ops: { x: 1150, y: 678, w: 62 },
  zen: { x: 700, y: 858, w: 62 },
  halo: { x: 860, y: 858, w: 66 },
  browser: { x: 1110, y: 858, w: 64 },
};

/** Width / height of each trimmed Mate picture in /house/m/. */
export const MATE_AR: Record<MateKey, number> = {
  browser: 0.891, byte: 1.128, chef: 0.972, code: 1.059, data: 1.175, flow: 1.241, halo: 1.103,
  luna: 1.019, mimo: 1.212, ops: 1.131, orbit: 1.166, planner: 1.241, recall: 1.156, research: 1.234,
  scout: 1.169, spark: 1.15, tune: 1.159, writer: 1.225, zen: 1.169,
};

export const mateImg = (k: MateKey) => `/house/m/${k}.webp`;

/** Order the Mates appear in when the house first opens: from the living room outwards. */
export const POP_ORDER: MateKey[] = [
  "mimo", "spark", "writer", "chef", "code", "byte", "research", "scout", "planner", "flow",
  "data", "tune", "recall", "ops", "luna", "orbit", "halo", "zen", "browser",
];

export interface Room {
  id: string;
  name: string;
  rect: Rect;
  mates: MateKey[];
  /** Mate names as the card title. */
  title: string;
  line: string;
  ask?: string;
}

/** The tour, in the order the camera visits. Every built-in Mate except Halo appears; Halo gets the door scene. */
export const ROOMS: Room[] = [
  {
    id: "living", name: "The living room", rect: [652, 443, 952, 558], mates: ["mimo", "spark"], title: "Mimo and Spark",
    line: "Mimo is your second brain and the team lead. Chat with one Mate or a few at once, or pick up the phone and talk. Spark turns rough thoughts into clear ideas.",
    ask: "@Research @Spark which of these three names is best?",
  },
  {
    id: "writing", name: "The writing nook", rect: [437, 443, 645, 558], mates: ["writer"], title: "Writer",
    line: "Turns notes and research into reports, scripts, posts and emails, in your voice.",
    ask: "Turn these notes into a one-page project brief.",
  },
  {
    id: "library", name: "The library", rect: [437, 290, 678, 430], mates: ["research", "scout"], title: "Research and Scout",
    line: "Research digs through the web and your documents, and links every source. Scout explores topics and builds reading lists.",
    ask: "Compare the top three court-booking apps and cite your sources.",
  },
  {
    id: "workshop", name: "The workshop", rect: [688, 290, 945, 430], mates: ["code", "byte"], title: "Code and Byte",
    line: "Code writes and runs code in a sealed sandbox, runs the tests, and you review every change. Byte takes on long coding jobs, with checkpoints along the way.",
    ask: "Add dark mode to the settings page and run the tests.",
  },
  {
    id: "planning", name: "The planning room", rect: [955, 290, 1188, 430], mates: ["planner", "flow"], title: "Planner and Flow",
    line: "Give it a big goal: Planner splits it into steps, picks a Mate for each and retries what fails. Flow turns one sentence into a routine that repeats.",
    ask: "Every Monday at 9, check my projects and send me a summary.",
  },
  {
    id: "rooftop", name: "The rooftop", rect: [560, 105, 1075, 272], mates: ["orbit", "luna"], title: "Orbit and Luna",
    line: "Orbit plans your week from your real calendar and moves things when plans change. Luna wraps up your day, keeps a journal and runs overnight jobs.",
    ask: "Fit two lab sessions and a project sprint into my week.",
  },
  {
    id: "kitchen", name: "The kitchen", rect: [960, 443, 1188, 558], mates: ["chef"], title: "Chef",
    line: "Plans meals, grocery lists and routines.",
    ask: "Plan dinners for the week and make the grocery list.",
  },
  {
    id: "archive", name: "The archive", rect: [960, 570, 1188, 680], mates: ["recall", "ops"], title: "Recall and Ops",
    line: "It remembers for you. Recall finds anything in your memories, files and sources. Ops keeps track of files, tasks and approvals.",
    ask: "What did I decide about the demo last week?",
  },
  {
    id: "lab", name: "The lab", rect: [683, 570, 952, 680], mates: ["data"], title: "Data",
    line: "Cleans up messy data, builds tables and charts, and explains what they show.",
    ask: "Chart this week’s sign-ups.",
  },
  {
    id: "music", name: "The music room", rect: [437, 570, 678, 680], mates: ["tune"], title: "Tune",
    line: "Handles music, playlists and audio notes, with your Spotify connected.",
    ask: "Make me a focus playlist for tonight.",
  },
  {
    id: "greenhouse", name: "The greenhouse", rect: [437, 692, 785, 860], mates: ["zen"], title: "Zen",
    line: "Protects your focus time and keeps breaks on the calendar.",
    ask: "Keep my mornings free for deep work.",
  },
  {
    id: "hall", name: "The front hall", rect: [790, 692, 1188, 860], mates: ["browser"], title: "Browser",
    line: "Opens websites, reads pages, compares options and fills in forms. You still sign in yourself.",
    ask: "Book the tennis court for Saturday at 10.",
  },
  {
    id: "extension", name: "One more room", rect: [1232, 396, 1430, 572], mates: [], title: "Your own Mate",
    line: "There’s always room for one more. Give it a name, a job and a voice, and it joins the team like any other.",
  },
];

/** How it works: who gets a paper plane, and what they do with it. */
export const JOBS: { k: MateKey; text: string }[] = [
  { k: "research", text: "compares three similar apps" },
  { k: "writer", text: "drafts the launch post" },
  { k: "code", text: "fixes the sign-up bug" },
  { k: "orbit", text: "clears Friday morning" },
  { k: "data", text: "charts the sign-ups" },
  { k: "browser", text: "fills in the launch-site form" },
];

export const LIMITS = [
  { h: "It can’t work while your computer is off.", p: "It runs on your own computer. Off or asleep means the Mates are too." },
  { h: "It won’t do anything risky on its own.", p: "Sending, deleting, spending and posting all wait for your yes." },
  { h: "It won’t type your passwords.", p: "The browser refuses password boxes. You sign in yourself." },
  { h: "It can’t use apps you haven’t connected.", p: "Google, Telegram, Discord, GitHub and the rest each need a one-time setup." },
  { h: "It needs a Windows or Linux computer.", p: "Windows 10 or 11, or Linux. Your phone and browser connect to it from anywhere." },
  { h: "Calls have limits.", p: "A call lasts up to 10 minutes, with at most three at once." },
];

export const APPS = [
  "Google", "Notion", "Obsidian", "Slack", "WhatsApp", "Telegram", "Discord", "Spotify", "GitHub",
  "Home Assistant", "health data", "MCP servers",
];
