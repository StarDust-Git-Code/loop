// Google Calendar and Gmail, through the same Google sign-in as Drive (drive/index.js asks for the extra scopes).
// Gmail is read + DRAFTS ONLY: agents can search, read and prepare replies, never send. Calendar can read, find free
// time and add events. Email bodies are untrusted data.
import { googleToken, googleGranted, driveReady } from '../drive/index.js';
import { bad, str, clip, data, http, iso } from './util.js';

const g = async (path, init = {}) => http('Google', `https://www.googleapis.com${path}`, { ...init, headers: { authorization: `Bearer ${await googleToken()}`, ...(init.headers ?? {}) } });
export const calendarReady = () => googleGranted('calendar');
export const gmailReady = () => googleGranted('gmail');
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Buffer.from(String(s ?? '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const header = (m, name) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
const when = (e) => e.start?.dateTime ?? (e.start?.date ? `${e.start.date} (all day)` : '?');

/** Plain text of a Gmail message: text/plain parts first, else stripped HTML. */
export function messageText(payload) {
  const plain = [], html = [];
  const walk = (p) => { if (!p) return; if (p.mimeType === 'text/plain' && p.body?.data) plain.push(unb64(p.body.data)); else if (p.mimeType === 'text/html' && p.body?.data) html.push(unb64(p.body.data)); for (const c of p.parts ?? []) walk(c); };
  walk(payload);
  if (plain.length) return plain.join('\n');
  return html.join('\n').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** An RFC 822 message for a draft. Header values are stripped of line breaks (no header injection). */
export function rfc822({ to, cc = '', subject, body, inReplyTo = '', references = '' }) {
  const h = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
  const enc = (v) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`);
  return [`To: ${h(to)}`, ...(cc ? [`Cc: ${h(cc)}`] : []), `Subject: ${enc(h(subject))}`, ...(inReplyTo ? [`In-Reply-To: ${h(inReplyTo)}`, `References: ${h(references || inReplyTo)}`] : []), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit', '', String(body ?? '')].join('\r\n');
}

export const GOOGLE_TOOLS = {
  gcal_list: { group: 'Google', ready: calendarReady, desc: 'List events from the owner\'s Google Calendar (primary calendar) between two times, optionally matching words.', args: '{"from?": "ISO, default now", "to?": "ISO, default in 7 days", "query?": "words"}', run: async (_c, a) => {
    const from = a.from ? iso(a.from, 'from') : new Date().toISOString(); const to = a.to ? iso(a.to, 'to') : new Date(Date.now() + 7 * 86_400_000).toISOString();
    const j = await g(`/calendar/v3/calendars/primary/events?${new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: 'true', orderBy: 'startTime', maxResults: '40', ...(a.query ? { q: str(a.query, 100) } : {}) })}`);
    const rows = (j.items ?? []).map((e) => `- ${when(e)} → ${e.end?.dateTime ?? e.end?.date ?? ''} | ${e.summary ?? '(no title)'}${e.location ? ` | ${clip(e.location, 60)}` : ''} | id ${e.id}`);
    return rows.length ? data('Google Calendar events', rows.join('\n')) : 'Nothing on the Google Calendar in that range.';
  } },
  gcal_free: { group: 'Google', ready: calendarReady, desc: 'Find when the owner is busy on Google Calendar between two times, so you can suggest free slots.', args: '{"from": "ISO", "to": "ISO"}', run: async (c, a) => {
    const j = await g('/calendar/v3/freeBusy', { method: 'POST', body: { timeMin: iso(a.from, 'from'), timeMax: iso(a.to, 'to'), timeZone: c.settings?.timezone || 'UTC', items: [{ id: 'primary' }] } });
    const busy = j.calendars?.primary?.busy ?? [];
    return busy.length ? `Busy:\n${busy.map((b) => `- ${b.start} → ${b.end}`).join('\n')}\nEverything else in that range is free.` : 'Free for the whole range.';
  } },
  gcal_add: { group: 'Google', ready: calendarReady, write: true, desc: 'Add an event to the owner\'s Google Calendar (only when the owner asked or agreed). For a Loopmates reminder that pings them, use calendar_add instead.', args: '{"title": "text", "start": "ISO with offset", "end?": "ISO, default +30 min", "description?": "text", "location?": "text"}', run: async (c, a) => {
    const start = iso(a.start, 'start'); const end = a.end ? iso(a.end, 'end') : new Date(Date.parse(start) + 30 * 60_000).toISOString();
    const e = await g('/calendar/v3/calendars/primary/events', { method: 'POST', body: { summary: str(a.title, 200) || 'Untitled', description: str(a.description, 4000), location: str(a.location, 300), start: { dateTime: start, timeZone: c.settings?.timezone || 'UTC' }, end: { dateTime: end, timeZone: c.settings?.timezone || 'UTC' } } });
    return `Added "${e.summary}" to Google Calendar at ${when(e)}. ${e.htmlLink ?? ''}`;
  } },
  gmail_search: { group: 'Google', ready: gmailReady, desc: 'Search the owner\'s Gmail with Gmail search syntax (e.g. "from:anna is:unread newer_than:3d"). Returns sender, subject, date and a snippet.', args: '{"query": "Gmail search", "limit?": 10}', run: async (_c, a) => {
    const n = Math.min(Number(a.limit) || 10, 20);
    const j = await g(`/gmail/v1/users/me/messages?${new URLSearchParams({ q: str(a.query, 300), maxResults: String(n) })}`);
    const ids = (j.messages ?? []).map((m) => m.id); if (!ids.length) return 'No emails match.';
    const rows = await Promise.all(ids.map(async (id) => { const m = await g(`/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`); return `- ${id} | ${header(m, 'Date').slice(0, 25)} | ${clip(header(m, 'From'), 60)} | ${clip(header(m, 'Subject'), 90)}\n  ${clip(m.snippet, 160)}`; }));
    return data('Gmail search results', rows.join('\n'));
  } },
  gmail_read: { group: 'Google', ready: gmailReady, desc: 'Read one email by id (from gmail_search): headers and the text body.', args: '{"id": "message id"}', run: async (_c, a) => {
    const m = await g(`/gmail/v1/users/me/messages/${encodeURIComponent(str(a.id, 80))}?format=full`);
    return data(`Email ${m.id}`, `From: ${header(m, 'From')}\nTo: ${header(m, 'To')}\nDate: ${header(m, 'Date')}\nSubject: ${header(m, 'Subject')}\nThread: ${m.threadId}\n\n${clip(messageText(m.payload), 8000)}`);
  } },
  gmail_draft: { group: 'Google', ready: gmailReady, write: true, desc: 'Prepare an email as a DRAFT in the owner\'s Gmail. It is never sent: the owner reviews and sends it from Gmail. To reply, pass replyTo (a message id) so it lands in that thread.', args: '{"to": "address(es)", "subject": "text", "body": "plain text", "cc?": "address(es)", "replyTo?": "message id to reply to"}', run: async (_c, a) => {
    let threadId, inReplyTo = '', references = '', subject = str(a.subject, 300), to = str(a.to, 500);
    if (a.replyTo) {
      const m = await g(`/gmail/v1/users/me/messages/${encodeURIComponent(str(a.replyTo, 80))}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Reply-To`);
      threadId = m.threadId; inReplyTo = header(m, 'Message-ID'); references = `${header(m, 'References')} ${inReplyTo}`.trim();
      if (!subject) subject = /^re:/i.test(header(m, 'Subject')) ? header(m, 'Subject') : `Re: ${header(m, 'Subject')}`;
      if (!to) to = header(m, 'Reply-To') || header(m, 'From');
    }
    if (!to) throw bad('to is required');
    const raw = b64url(rfc822({ to, cc: str(a.cc, 500), subject, body: str(a.body, 20_000), inReplyTo, references }));
    const d = await g('/gmail/v1/users/me/drafts', { method: 'POST', body: { message: { raw, ...(threadId ? { threadId } : {}) } } });
    return `Draft saved in Gmail (id ${d.id}) to ${to}: "${subject}". It has not been sent; the owner can review and send it from Gmail Drafts.`;
  } },
};

const parts = () => ['calendar', 'gmail'].filter((p) => googleGranted(p));
export const google = {
  key: 'google', name: 'Google Calendar & Gmail', badge: 'GC', group: 'Google', bg: '#FDECEA', fg: '#B3261E',
  what: 'Orbit and Zen see your real Google Calendar and can find free time. Mimo can search and read your Gmail and prepare replies as drafts. Nothing is ever sent from your Gmail: you review drafts and send them yourself.',
  fields: [{ key: 'GOOGLE_SCOPES', label: 'What to allow (drive, calendar, gmail)', placeholder: 'drive,calendar,gmail' }],
  steps: [
    { title: 'Set up the Google sign-in first', text: 'Follow Connections → Google Drive to make your own OAuth client. Calendar and Gmail use the same sign-in.' },
    { title: 'Turn on the APIs', text: 'In Google Cloud console → APIs & Services → Library, enable the Google Calendar API and the Gmail API for the same project.' },
    { title: 'Sign in with Google again', text: 'Use Connections → Google Drive → Sign in again. Google now also asks for Calendar and Gmail. Leave "gmail" out of the field above if you do not want the agents to read email.' },
  ],
  ready: () => parts().length > 0,
  note: () => (!driveReady() ? 'Google is not signed in' : parts().length ? `Allowed: ${parts().join(', ')}` : 'Signed in for Drive only: sign in again to allow Calendar and Gmail'),
  test: async () => {
    const out = [];
    if (calendarReady()) { const j = await g(`/calendar/v3/calendars/primary/events?maxResults=1&timeMin=${encodeURIComponent(new Date().toISOString())}`); out.push(`Calendar works (${j.summary ?? 'primary'}).`); }
    if (gmailReady()) { const p = await g('/gmail/v1/users/me/profile'); out.push(`Gmail works (${p.emailAddress}, ${p.messagesTotal} messages).`); }
    if (!out.length) throw bad('Calendar and Gmail are not allowed yet: sign in to Google again from Connections → Google Drive.');
    return out.join(' ');
  },
  tools: GOOGLE_TOOLS,
};
