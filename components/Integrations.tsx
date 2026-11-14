import SectionHead from "./SectionHead";

const ITEMS: [string, string][] = [
  ["Obsidian", "Search, read and write your vault in place. Your [[links]] become the knowledge graph."],
  ["Notion", "Search and read the pages you share. Create pages for drafts and plans."],
  ["Google", "Drive files in one folder you pick, your real calendar, and Gmail with drafts only. Never sent."],
  ["Slack", "DM your Mates or @mention them. Each answers under its own name and mascot."],
  ["WhatsApp", "Chat with your Mates through Meta's official Cloud API."],
  ["Telegram & Discord", "Chat, run updates, tap-to-answer questions and call links."],
  ["GitHub", "Coding runs on the repositories you allow, ending in a pull request."],
  ["Todoist & Linear", "To-dos, grocery lists and issues, straight from plans."],
  ["Spotify", "Tune builds real playlists from your actual taste."],
  ["RSS & YouTube", "Read feeds and transcripts. Watch a feed for relevant new items."],
  ["Health", "Daily sleep, steps and heart-rate totals, so Zen and Luna can adapt."],
  ["Home Assistant", "Read sensors and switch devices. Locks, alarms and garage doors always ask first."],
  ["MCP servers", "Any HTTP or stdio MCP server, with per-agent access."],
  ["Models", "Gemini, NVIDIA NIM, Groq, Cerebras, OpenRouter or any OpenAI-compatible provider, with failover."],
];

export default function Integrations() {
  return (
    <section id="integrations" className="sec">
      <div className="wrap stack">
        <SectionHead
          label="Integrations"
          lede="All optional. Each one is set up step by step in the dashboard, with a Test button. Its tools reach only the Mates whose job fits."
        >
          Plugged into<br />your real life.
        </SectionHead>

        <dl className="ilist" style={{ margin: 0 }}>
          {ITEMS.map(([name, text]) => (
            <div className="irow" key={name} data-reveal>
              <dt className="iname">{name}</dt>
              <dd className="idesc" style={{ margin: 0 }}>{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
