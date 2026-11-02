/** Connector catalogue for MCP. Remote servers use the vendor's endpoint; stdio ones run via a command on the backend host. */
export type Cat = 'Dev' | 'Productivity' | 'Data' | 'Payments' | 'Search & web' | 'Automation' | 'Utilities';
export type CatalogItem = { id: string; name: string; cat: Cat; text: string; transport: 'http' | 'stdio'; url?: string; command?: string; auth: 'OAuth' | 'API key' | 'None' };

export const CATALOG: CatalogItem[] = [
  { id: 'github', name: 'GitHub', cat: 'Dev', text: 'Repos, issues, pull requests and code search.', transport: 'http', url: 'https://api.githubcopilot.com/mcp', auth: 'OAuth' },
  { id: 'linear', name: 'Linear', cat: 'Productivity', text: 'Issues, projects and cycles.', transport: 'http', url: 'https://mcp.linear.app/mcp', auth: 'OAuth' },
  { id: 'notion', name: 'Notion', cat: 'Productivity', text: 'Search and edit pages and databases.', transport: 'http', url: 'https://mcp.notion.com/mcp', auth: 'OAuth' },
  { id: 'atlassian', name: 'Atlassian (Jira + Confluence)', cat: 'Productivity', text: 'Tickets and wiki pages.', transport: 'http', url: 'https://mcp.atlassian.com/v1/sse', auth: 'OAuth' },
  { id: 'asana', name: 'Asana', cat: 'Productivity', text: 'Tasks and projects.', transport: 'http', url: 'https://mcp.asana.com/sse', auth: 'OAuth' },
  { id: 'sentry', name: 'Sentry', cat: 'Dev', text: 'Errors and performance issues.', transport: 'http', url: 'https://mcp.sentry.dev/mcp', auth: 'OAuth' },
  { id: 'vercel', name: 'Vercel', cat: 'Dev', text: 'Projects, deployments and logs.', transport: 'http', url: 'https://mcp.vercel.com/', auth: 'OAuth' },
  { id: 'cloudflare-docs', name: 'Cloudflare Docs', cat: 'Dev', text: 'Search Cloudflare documentation.', transport: 'http', url: 'https://docs.mcp.cloudflare.com/sse', auth: 'None' },
  { id: 'supabase', name: 'Supabase', cat: 'Data', text: 'Databases, auth and edge functions.', transport: 'http', url: 'https://mcp.supabase.com/mcp', auth: 'OAuth' },
  { id: 'huggingface', name: 'Hugging Face', cat: 'Dev', text: 'Models, datasets and Spaces.', transport: 'http', url: 'https://hf.co/mcp', auth: 'None' },
  { id: 'context7', name: 'Context7', cat: 'Dev', text: 'Up-to-date library documentation.', transport: 'http', url: 'https://mcp.context7.com/mcp', auth: 'None' },
  { id: 'playwright', name: 'Playwright', cat: 'Search & web', text: 'Drive a real browser: click, type, screenshot.', transport: 'stdio', command: 'npx @playwright/mcp@latest', auth: 'None' },
  { id: 'fetch', name: 'Fetch', cat: 'Search & web', text: 'Download a URL and turn it into readable text.', transport: 'stdio', command: 'uvx mcp-server-fetch', auth: 'None' },
  { id: 'brave', name: 'Brave Search', cat: 'Search & web', text: 'Web and local search.', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-brave-search', auth: 'API key' },
  { id: 'stripe', name: 'Stripe', cat: 'Payments', text: 'Customers, invoices and payment links.', transport: 'http', url: 'https://mcp.stripe.com/', auth: 'OAuth' },
  { id: 'paypal', name: 'PayPal', cat: 'Payments', text: 'Orders, invoices and transactions.', transport: 'http', url: 'https://mcp.paypal.com/sse', auth: 'OAuth' },
  { id: 'square', name: 'Square', cat: 'Payments', text: 'Sales, catalog and customers.', transport: 'http', url: 'https://mcp.squareup.com/sse', auth: 'OAuth' },
  { id: 'zapier', name: 'Zapier', cat: 'Automation', text: 'Trigger actions in thousands of apps.', transport: 'http', url: 'https://mcp.zapier.com/api/mcp/mcp', auth: 'API key' },
  { id: 'intercom', name: 'Intercom', cat: 'Productivity', text: 'Conversations and contacts.', transport: 'http', url: 'https://mcp.intercom.com/sse', auth: 'OAuth' },
  { id: 'webflow', name: 'Webflow', cat: 'Productivity', text: 'Sites and CMS content.', transport: 'http', url: 'https://mcp.webflow.com/sse', auth: 'OAuth' },
  { id: 'filesystem', name: 'Filesystem', cat: 'Utilities', text: 'Read and write files in folders you allow.', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-filesystem /workspace', auth: 'None' },
  { id: 'memory', name: 'Memory', cat: 'Utilities', text: 'A small knowledge graph the Mates can keep.', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-memory', auth: 'None' },
  { id: 'thinking', name: 'Sequential Thinking', cat: 'Utilities', text: 'Step-by-step reasoning scratchpad.', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-sequential-thinking', auth: 'None' },
  { id: 'postgres', name: 'PostgreSQL', cat: 'Data', text: 'Read-only SQL against a database.', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-postgres postgresql://localhost/db', auth: 'API key' },
];
export const CATS: Cat[] = ['Dev', 'Productivity', 'Data', 'Payments', 'Search & web', 'Automation', 'Utilities'];
