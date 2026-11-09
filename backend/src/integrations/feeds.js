// RSS / Atom feeds and YouTube transcripts for Scout and Research. No keys. Every address goes through the same
// SSRF guard as fetch_url (safeFetch, bound from tools.js), because the agent chooses it.
import { bad, str, clip, data, textOf } from './util.js';

let safeFetch = async () => { throw bad('Web access is not ready'); };
export const bindFeedFetch = (fn) => { safeFetch = fn; };

const tag = (xml, name) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml); return m ? textOf(m[1]) : ''; };
const attr = (xml, name, a) => new RegExp(`<${name}\\b[^>]*\\b${a}="([^"]*)"`, 'i').exec(xml)?.[1] ?? '';

/** Parse RSS 2.0, RSS 1.0 (RDF) or Atom into { title, items: [{ title, link, date, summary, id }] }. */
export function parseFeed(xml) {
  const s = String(xml ?? '');
  const atom = /<feed[\s>]/i.test(s) && /<entry[\s>]/i.test(s);
  const blocks = [...s.matchAll(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const first = s.search(atom ? /<entry[\s>]/i : /<item[\s>]/i);
  const head = first > 0 ? s.slice(0, first) : s;
  const items = blocks.slice(0, 100).map((b) => {
    const link = atom ? (attr(b.replace(/<link\b[^>]*rel="(?!alternate)[^"]*"[^>]*>/gi, ''), 'link', 'href') || attr(b, 'link', 'href')) : tag(b, 'link') || attr(b, 'link', 'href');
    const date = tag(b, atom ? 'updated' : 'pubDate') || tag(b, 'published') || tag(b, 'dc:date');
    return { title: tag(b, 'title') || '(untitled)', link, date, summary: clip(textOf(tag(b, atom ? 'summary' : 'description') || tag(b, 'content') || tag(b, 'media:description')), 400) /* descriptions are often escaped HTML */, id: tag(b, atom ? 'id' : 'guid') || link };
  });
  return { title: tag(head, 'title'), items };
}

export async function readFeed(url) {
  const res = await safeFetch(String(url), { headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } });
  if (!res.ok) throw bad(`The feed answered ${res.status}`);
  const f = parseFeed((await res.text()).slice(0, 2_000_000));
  if (!f.items.length) throw bad('That address is not an RSS or Atom feed (or it is empty). Try the site\'s /feed, /rss or /atom.xml.');
  return f;
}

const videoId = (v) => { const s = String(v ?? '').trim(); return /^[\w-]{11}$/.test(s) ? s : /(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/.exec(s)?.[1] ?? ''; };

/** Pull the caption track list out of a watch page, pick English (or the first), return plain text. */
export function captionTracks(html) {
  const m = /"captionTracks":(\[.*?\])\s*,\s*"(?:audioTracks|translationLanguages|defaultAudioTrackIndex)"/s.exec(html);
  if (!m) return [];
  try { return JSON.parse(m[1]); } catch { return []; }
}
export function transcriptText(xml) {
  return [...String(xml).matchAll(/<(?:text|p)\b[^>]*>([\s\S]*?)<\/(?:text|p)>/g)].map((x) => textOf(textOf(x[1]))).filter(Boolean) /* captions are XML-escaped twice */.join(' ').replace(/\s+/g, ' ').trim();
}

const FEED_TOOLS = {
  feed_read: { group: 'Feeds', net: true, desc: 'Read an RSS or Atom feed (a blog, news site, podcast, or a YouTube channel feed https://www.youtube.com/feeds/videos.xml?channel_id=…). Returns the newest items with links.', args: '{"url": "feed address", "limit?": 10}', run: async (_c, a) => {
    const f = await readFeed(str(a.url, 500)); const n = Math.min(Number(a.limit) || 10, 30);
    return data(`Feed "${f.title || a.url}"`, f.items.slice(0, n).map((i) => `- ${i.date ? `${i.date.slice(0, 16)} ` : ''}${i.title}\n  ${i.link}${i.summary ? `\n  ${clip(i.summary, 200)}` : ''}`).join('\n'));
  } },
  youtube_transcript: { group: 'Feeds', net: true, desc: 'Get the transcript (captions) of a YouTube video, to summarise or quote it. Works only when the video has captions.', args: '{"url": "YouTube link or video id", "lang?": "en"}', run: async (_c, a) => {
    const id = videoId(a.url); if (!id) throw bad('That is not a YouTube video link');
    const res = await safeFetch(`https://www.youtube.com/watch?v=${id}&hl=en`, { headers: { 'accept-language': 'en-US,en;q=0.8' } });
    if (!res.ok) throw bad(`YouTube answered ${res.status}`);
    const html = await res.text();
    const title = textOf(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? '').replace(/ - YouTube$/, '');
    const tracks = captionTracks(html); if (!tracks.length) throw bad('This video has no captions that can be read.');
    const want = str(a.lang, 10) || 'en';
    const t = tracks.find((x) => x.languageCode === want && x.kind !== 'asr') ?? tracks.find((x) => x.languageCode === want) ?? tracks.find((x) => x.languageCode?.startsWith('en')) ?? tracks[0];
    const cap = await safeFetch(String(t.baseUrl).replace(/\\u0026/g, '&'));
    const text = transcriptText(await cap.text());
    if (!text) throw bad('YouTube did not return the captions (it sometimes blocks automated requests). Try again later.');
    return data(`Transcript of "${title}" (${t.languageCode}${t.kind === 'asr' ? ', auto-generated' : ''})`, clip(text, 12_000));
  } },
};

export const feeds = {
  key: 'feeds', name: 'RSS & YouTube', badge: 'RSS', group: 'Feeds', bg: '#FFF1E0', fg: '#A35200',
  what: 'Scout and Research read blogs, news sites, podcasts and YouTube channels from their feeds, and read YouTube transcripts. The leader can keep watch on a feed and tell you when something new and relevant appears. No account needed.',
  fields: [],
  steps: [
    { title: 'Nothing to set up', text: 'Give an agent a feed address, or ask the leader to "watch this feed". For a YouTube channel, use https://www.youtube.com/feeds/videos.xml?channel_id=… (the id is on the channel\'s About page → Share → Copy channel ID).' },
  ],
  ready: () => true, note: () => 'Always on (needs network access)',
  test: async () => { const f = await readFeed('https://news.ycombinator.com/rss'); return `Working: read ${f.items.length} items from Hacker News.`; },
  tools: FEED_TOOLS,
};
