// Routes for the screens ported from the design files (see components/dashboard/screens/*.html).
export const SCREENS: Record<string, { title: string; links?: Record<string, string> }> = {
  studio: { title: 'Agent Studio', links: { 'Save to Knowledge': '/dashboard/knowledge' } },
  chat: { title: 'Chat', links: { 'Open in Studio': '/dashboard/studio', 'Change permissions': '/dashboard/skills' } },
  run: {
    title: 'Run',
    links: { Runs: '/dashboard/workflows', 'Save to Knowledge': '/dashboard/knowledge', 'Save as workflow': '/dashboard/workflows' },
  },
  agents: { title: 'Agents', links: { Configure: '/dashboard/studio', '+New agent': '/dashboard/studio' } },
  workflows: { title: 'Workflows', links: { Open: '/dashboard/studio', Run: '/dashboard/run', '+New workflow': '/dashboard/studio' } },
  knowledge: { title: 'Knowledge' },
  skills: { title: 'Skills & MCP' },
  connections: { title: 'Connections' },
  tasks: { title: 'Tasks', links: { '+New task': '/dashboard' } },
  automations: { title: 'Automations', links: { 'Edit in Studio': '/dashboard/studio', 'Run now': '/dashboard/run' } },
  'my-space': { title: 'My Space', links: { 'Plan my day': '/dashboard/schedule' } },
  schedule: { title: 'Schedule', links: { 'My Space': '/dashboard/my-space' } },
};
