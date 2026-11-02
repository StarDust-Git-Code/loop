// Routes for the screens ported from the design files (see components/dashboard/screens/*.html).
export const SCREENS: Record<string, { title: string; links?: Record<string, string> }> = {
  studio: { title: 'Agent Studio', links: { 'Save to Knowledge': '/knowledge' } },
  chat: { title: 'Chat', links: { 'Open in Studio': '/studio', 'Change permissions': '/skills' } },
  run: {
    title: 'Run',
    links: { Runs: '/workflows', 'Save to Knowledge': '/knowledge', 'Save as workflow': '/workflows' },
  },
  agents: { title: 'Agents', links: { Configure: '/studio', '+New agent': '/studio' } },
  workflows: { title: 'Workflows', links: { Open: '/studio', Run: '/run', '+New workflow': '/studio' } },
  knowledge: { title: 'Knowledge' },
  skills: { title: 'Skills & MCP' },
  connections: { title: 'Connections' },
  tasks: { title: 'Tasks', links: { '+New task': '/' } },
  automations: { title: 'Automations', links: { 'Edit in Studio': '/studio', 'Run now': '/run' } },
  'my-space': { title: 'My Space', links: { 'Plan my day': '/schedule' } },
  schedule: { title: 'Schedule', links: { 'My Space': '/my-space' } },
};
