// Notion (notes and pages), Todoist (personal to-dos) and Linear (team issues). Token-based APIs, one key each.
import { env } from '../lib/env.js';
import { bad, str, clip, data, http } from './util.js';

/* ================= Notion ================= */
const NOTION_VERSION = '2022-06-28';
const notionReady = () => !!env('NOTION_TOKEN');
const nf = (path, init = {}) => http('Notion', `https://api.notion.com/v1${path}`, { ...init, headers: { authorization: `Bearer ${env('NOTION_TOKEN')}`, 'notion-version': NOTION_VERSION, ...(init.headers ?? {}) } });
const rich = (arr) => (arr ?? []).map((t) => t.plain_text ?? t.text?.content ?? '').join('');
const pageTitle = (p) => { for (const v of Object.values(p.properties ?? {})) if (v?.type === 'title') return rich(v.title) || 'Untitled'; return rich(p.title) || 'Untitled'; };
const pageId = (v) => { const s = String(v ?? '').trim(); const m = /([0-9a-f]{32})(?:\?|$)/i.exec(s.replace(/-/g, '')) ; return m ? m[1] : s; };

/** Notion blocks → plain Markdown-ish text. */
export function blocksText(blocks) {
  return (blocks ?? []).map((b) => {
    const v = b[b.type] ?? {}; const t = rich(v.rich_text);
    switch (b.type) {
      case 'heading_1': return `# ${t}`; case 'heading_2': return `## ${t}`; case 'heading_3': return `### ${t}`;
      case 'bulleted_list_item': return `- ${t}`; case 'numbered_list_item': return `1. ${t}`;
      case 'to_do': return `- [${v.checked ? 'x' : ' '}] ${t}`; case 'quote': return `> ${t}`;
      case 'code': return `\`\`\`${v.language ?? ''}\n${t}\n\`\`\``; case 'child_page': return `[page] ${v.title}`; case 'divider': return '---';
      default: return t;
    }
  }).filter(Boolean).join('\n');
}
/** Markdown lines → Notion blocks (headings, bullets, to-dos, quotes, paragraphs). */
export function markdownBlocks(md) {
  const txt = (s) => [{ type: 'text', text: { content: String(s).slice(0, 1900) } }];
  return String(md ?? '').split('\n').filter((l) => l.trim()).slice(0, 95).map((l) => {
    let m;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(l))) { const k = `heading_${m[1].length}`; return { object: 'block', type: k, [k]: { rich_text: txt(m[2]) } }; }
    if ((m = /^\s*[-*]\s+\[( |x)\]\s+(.*)$/i.exec(l))) return { object: 'block', type: 'to_do', to_do: { rich_text: txt(m[2]), checked: m[1].toLowerCase() === 'x' } };
    if ((m = /^\s*[-*]\s+(.*)$/.exec(l))) return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: txt(m[1]) } };
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) return { object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: txt(m[1]) } };
    if ((m = /^>\s?(.*)$/.exec(l))) return { object: 'block', type: 'quote', quote: { rich_text: txt(m[1]) } };
    return { object: 'block', type: 'paragraph', paragraph: { rich_text: txt(l) } };
  });
}

const NOTION_TOOLS = {
  notion_search: { group: 'Notes', ready: notionReady, desc: 'Search the Notion pages the owner shared with Loopmates.', args: '{"query": "words"}', run: async (_c, a) => {
    const j = await nf('/search', { method: 'POST', body: { query: str(a.query, 200), page_size: 10, filter: { property: 'object', value: 'page' } } });
    const rows = (j.results ?? []).map((p) => `- ${pageTitle(p)} | id ${p.id} | edited ${String(p.last_edited_time).slice(0, 10)} | ${p.url}`);
    return rows.length ? rows.join('\n') : 'No Notion pages match. Pages must be shared with the Loopmates integration (••• → Connections) to be found.';
  } },
  notion_read: { group: 'Notes', ready: notionReady, desc: 'Read a Notion page (by id or URL) as text.', args: '{"id": "page id or URL"}', run: async (_c, a) => {
    const id = pageId(a.id); const p = await nf(`/pages/${id}`); const b = await nf(`/blocks/${id}/children?page_size=100`);
    return data(`Notion page "${pageTitle(p)}"`, `${clip(blocksText(b.results), 8000)}${b.has_more ? '\n…[the page continues]' : ''}`);
  } },
  notion_add: { group: 'Notes', ready: notionReady, write: true, desc: 'Create a Notion page with Markdown content, under a parent page (default: the page set in Connections → Notion), or append to an existing page.', args: '{"title": "page title", "content": "Markdown", "parent?": "parent page id or URL", "appendTo?": "existing page id to append to instead"}', run: async (_c, a) => {
    const children = markdownBlocks(a.content);
    if (a.appendTo) { await nf(`/blocks/${pageId(a.appendTo)}/children`, { method: 'PATCH', body: { children } }); return `Appended ${children.length} block(s) to the Notion page.`; }
    const parent = pageId(a.parent || env('NOTION_PARENT_PAGE'));
    if (!parent) throw bad('Which page should this go under? Pass parent, or set a default page in Connections → Notion.');
    const p = await nf('/pages', { method: 'POST', body: { parent: { page_id: parent }, properties: { title: { title: [{ type: 'text', text: { content: str(a.title, 200) || 'Untitled' } }] } }, children } });
    return `Created the Notion page "${str(a.title, 200)}": ${p.url}`;
  } },
};
export const notion = {
  key: 'notion', name: 'Notion', badge: 'N', group: 'Notes', bg: '#F1F1EF', fg: '#191919',
  what: 'Agents search and read the Notion pages you share with them, and Writer or Mimo can create pages for drafts, notes and plans.',
  fields: [{ key: 'NOTION_TOKEN', label: 'Internal integration secret', placeholder: 'ntn_…' }, { key: 'NOTION_PARENT_PAGE', label: 'Page for new notes (id or URL, optional)' }],
  steps: [
    { title: 'Create an internal integration', text: 'Open notion.so/my-integrations → New integration (type Internal, your workspace). Give it Read, Update and Insert content. Copy the Internal Integration Secret.' },
    { title: 'Share pages with it', text: 'Open each page the agents may use (a top page shares its sub-pages too) → ••• → Connections → add your integration. The agents cannot see anything you do not share.' },
  ],
  ready: notionReady, note: () => (notionReady() ? 'Token set' : 'No token'),
  test: async () => { const me = await nf('/users/me'); const s = await nf('/search', { method: 'POST', body: { page_size: 100, filter: { property: 'object', value: 'page' } } }); return `Working as ${me.name ?? 'the integration'}; ${s.results?.length ?? 0} page(s) shared${s.has_more ? ' (more than 100)' : ''}.`; },
  tools: NOTION_TOOLS,
};

/* ================= Todoist ================= */
const todoReady = () => !!env('TODOIST_TOKEN');
const td = (path, init = {}) => http('Todoist', `https://api.todoist.com/api/v1${path}`, { ...init, headers: { authorization: `Bearer ${env('TODOIST_TOKEN')}`, ...(init.headers ?? {}) } });
const results = (j) => (Array.isArray(j) ? j : j?.results ?? []);
const TODOIST_TOOLS = {
  todoist_list: { group: 'Task Apps', ready: todoReady, desc: 'List the owner\'s Todoist tasks with a Todoist filter (e.g. "today | overdue", "#Groceries", "p1").', args: '{"filter?": "Todoist filter, default today | overdue"}', run: async (_c, a) => {
    const j = await td(`/tasks/filter?${new URLSearchParams({ query: str(a.filter, 200) || 'today | overdue', limit: '50' })}`);
    const rows = results(j).map((t) => `- ${t.content}${t.due ? ` (due ${t.due.string ?? t.due.date})` : ''}${t.priority > 1 ? ` [p${5 - t.priority}]` : ''} | id ${t.id}`);
    return rows.length ? rows.join('\n') : 'No Todoist tasks match.';
  } },
  todoist_add: { group: 'Task Apps', ready: todoReady, write: true, desc: 'Add a task to Todoist. due is natural language ("tomorrow 9am", "every friday").', args: '{"content": "task", "due?": "natural language", "description?": "text", "priority?": "1 (urgent) to 4 (normal)", "project?": "project name"}', run: async (_c, a) => {
    const body = { content: str(a.content, 500), ...(a.due ? { due_string: str(a.due, 100) } : {}), ...(a.description ? { description: str(a.description, 2000) } : {}), ...(a.priority ? { priority: 5 - Math.min(4, Math.max(1, Number(a.priority) || 4)) } : {}) };
    if (!body.content) throw bad('content is required');
    if (a.project) { const p = results(await td('/projects?limit=200')).find((x) => x.name.toLowerCase() === str(a.project, 100).toLowerCase()); if (!p) throw bad(`No Todoist project called "${a.project}"`); body.project_id = p.id; }
    const t = await td('/tasks', { method: 'POST', body });
    return `Added to Todoist: "${t.content}"${t.due ? ` (due ${t.due.string ?? t.due.date})` : ''}.`;
  } },
  todoist_done: { group: 'Task Apps', ready: todoReady, write: true, desc: 'Mark a Todoist task as done (by id from todoist_list).', args: '{"id": "task id"}', run: async (_c, a) => { await td(`/tasks/${encodeURIComponent(str(a.id, 60))}/close`, { method: 'POST' }); return 'Marked done in Todoist.'; } },
};
export const todoist = {
  key: 'todoist', name: 'Todoist', badge: 'TD', group: 'Task Apps', bg: '#FDECE8', fg: '#C2361F',
  what: 'Mimo, Planner and Chef read and add to your Todoist: today\'s list, overdue items, grocery lists and recurring chores.',
  fields: [{ key: 'TODOIST_TOKEN', label: 'API token' }],
  steps: [{ title: 'Copy your API token', text: 'Todoist → Settings → Integrations → Developer → copy the API token. It acts as you, so keep it on your server only.' }],
  ready: todoReady, note: () => (todoReady() ? 'Token set' : 'No token'),
  test: async () => { const p = results(await td('/projects?limit=200')); return `Working: ${p.length} project(s).`; },
  tools: TODOIST_TOOLS,
};

/* ================= Linear ================= */
const linReady = () => !!env('LINEAR_API_KEY');
async function lq(query, variables = {}) {
  const j = await http('Linear', 'https://api.linear.app/graphql', { method: 'POST', headers: { authorization: env('LINEAR_API_KEY') }, body: { query, variables } });
  if (j?.errors?.length) throw bad(`Linear: ${j.errors[0].message}`);
  return j.data;
}
const issueLine = (i) => `- ${i.identifier} | ${i.title} | ${i.state?.name ?? ''}${i.assignee ? ` | ${i.assignee.name}` : ''}${i.dueDate ? ` | due ${i.dueDate}` : ''} | ${i.url}`;
const ISSUE = 'identifier title url dueDate priority state { name } assignee { name }';
const LINEAR_TOOLS = {
  linear_issues: { group: 'Task Apps', ready: linReady, desc: 'List Linear issues: the owner\'s open issues by default, or issues whose title matches words.', args: '{"query?": "words in the title", "mine?": "true (default) for issues assigned to the owner", "limit?": 15}', run: async (_c, a) => {
    const filter = { state: { type: { nin: ['completed', 'canceled'] } }, ...(a.mine === false || a.mine === 'false' ? {} : { assignee: { isMe: { eq: true } } }), ...(a.query ? { title: { containsIgnoreCase: str(a.query, 100) } } : {}) };
    const d = await lq(`query($f: IssueFilter, $n: Int) { issues(filter: $f, first: $n, orderBy: updatedAt) { nodes { ${ISSUE} } } }`, { f: filter, n: Math.min(Number(a.limit) || 15, 40) });
    const rows = d.issues.nodes.map(issueLine);
    return rows.length ? data('Linear issues', rows.join('\n')) : 'No open Linear issues match.';
  } },
  linear_create: { group: 'Task Apps', ready: linReady, write: true, desc: 'Create a Linear issue in a team (by team key like "ENG"; the first team if not given).', args: '{"title": "text", "description?": "Markdown", "team?": "team key"}', run: async (_c, a) => {
    const teams = (await lq('{ teams(first: 50) { nodes { id key name } } }')).teams.nodes;
    const t = a.team ? teams.find((x) => x.key.toLowerCase() === str(a.team, 20).toLowerCase() || x.name.toLowerCase() === str(a.team, 60).toLowerCase()) : teams[0];
    if (!t) throw bad(`No Linear team "${a.team}". Teams: ${teams.map((x) => x.key).join(', ')}`);
    const d = await lq(`mutation($i: IssueCreateInput!) { issueCreate(input: $i) { success issue { ${ISSUE} } } }`, { i: { teamId: t.id, title: str(a.title, 250), description: str(a.description, 10_000) } });
    if (!d.issueCreate.success) throw bad('Linear did not create the issue');
    return `Created ${d.issueCreate.issue.identifier} in ${t.name}: ${d.issueCreate.issue.url}`;
  } },
};
export const linear = {
  key: 'linear', name: 'Linear', badge: 'LN', group: 'Task Apps', bg: '#EDEBFF', fg: '#4B47D6',
  what: 'Planner can turn a plan into Linear issues, and the team can see what is assigned to you and what is due.',
  fields: [{ key: 'LINEAR_API_KEY', label: 'Personal API key', placeholder: 'lin_api_…' }],
  steps: [{ title: 'Make a personal API key', text: 'Linear → Settings → Security & access → Personal API keys → New key. It acts as you, so it sees the teams you can see.' }],
  ready: linReady, note: () => (linReady() ? 'Key set' : 'No key'),
  test: async () => { const d = await lq('{ viewer { name } teams(first: 50) { nodes { key } } }'); return `Working as ${d.viewer.name}; teams: ${d.teams.nodes.map((t) => t.key).join(', ') || 'none'}.`; },
  tools: LINEAR_TOOLS,
};
