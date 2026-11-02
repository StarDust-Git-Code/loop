import { uid } from './format';
import type { FlowEdge, FlowNode, MateKey, WorkflowIn } from './types';

/** Starter chains. They are only blueprints: creating one writes a normal workflow the user can edit. */
export type Template = { name: string; description: string; mates: MateKey[]; tint: string; trigger: string };
export const TEMPLATES: Template[] = [
  { name: 'Inbox to Telegram', description: 'Agents watch selected chats and message you only when something needs a decision.', mates: ['research', 'ops'], tint: '#F1ECFF', trigger: 'new message' },
  { name: 'Ultracode feature build', description: 'Plan a feature, let Code Mate work in long runs with checkpoints, review the diff.', mates: ['planner', 'code'], tint: '#E8EEFF', trigger: 'manual' },
  { name: 'Research to knowledge graph', description: 'Collect sources, extract entities, link them into your knowledge graph.', mates: ['research', 'browser', 'planner'], tint: '#E7F4E8', trigger: 'manual' },
];

export function chain(mates: MateKey[], names: (k: MateKey) => string): Pick<WorkflowIn, 'nodes' | 'edges'> {
  const nodes: FlowNode[] = [{ id: uid(), type: 'trigger', label: 'Trigger', x: 40, y: 80 }, ...mates.map((m, i): FlowNode => ({ id: uid(), type: 'mate', mate: m, label: names(m), x: 40 + (i + 1) * 220, y: 80 })), { id: uid(), type: 'output', label: 'Output', x: 40 + (mates.length + 1) * 220, y: 80 }];
  const edges: FlowEdge[] = nodes.slice(1).map((n, i) => ({ id: uid(), from: nodes[i].id, to: n.id }));
  return { nodes, edges };
}
