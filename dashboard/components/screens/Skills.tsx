'use client';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { MATE_DEFS } from '../../lib/mates';
import type { McpIn, MateKey, SkillIn } from '../../lib/types';
import { Badge, Btn, Chips, confirmThen, Empty, ErrorNote, Field, Input, Item, List, Loading, Modal, Page, Tabs, Textarea, Toggle } from '../ui/ui';

const blankSkill: SkillIn = { name: '', description: '', instructions: '', enabled: true, mates: [] };
const blankMcp: McpIn = { name: '', url: '', description: '', enabled: true, status: 'unverified', tools: [] };

export function Skills() {
  const [tab, setTab] = useState<'skills' | 'mcp'>('skills');
  const skills = useRepo(api.skills), mcp = useRepo(api.mcp);
  const [sk, setSk] = useState<(SkillIn & { id?: string }) | null>(null);
  const [mc, setMc] = useState<(McpIn & { id?: string }) | null>(null);
  const names = MATE_DEFS.map((m) => m.name);
  return (
    <Page title="Skills & MCP" sub="Skills teach Mates how to do a job. MCP servers give them tools to reach other systems."
      actions={<><Tabs value={tab} onChange={setTab} options={[{ id: 'skills', label: 'Skills' }, { id: 'mcp', label: 'MCP servers' }]} />
        <Btn variant="primary" onClick={() => (tab === 'skills' ? setSk({ ...blankSkill }) : setMc({ ...blankMcp }))}>{tab === 'skills' ? 'New skill' : 'Add server'}</Btn></>}>
      <ErrorNote message={skills.error ?? mcp.error} />
      {tab === 'skills' ? (skills.loading ? <Loading /> : skills.items.length === 0 ? <Empty mate="spark" title="No skills yet" text="Write instructions once, such as how you like reports formatted, and attach them to Mates." action={<Btn variant="primary" onClick={() => setSk({ ...blankSkill })}>New skill</Btn>} /> :
        <List>{skills.items.map((s) => <Item key={s.id} title={s.name} sub={`${s.description} · ${s.mates.length ? s.mates.join(', ') : 'all Mates'}`}
          right={<><Btn small onClick={() => setSk(s)}>Edit</Btn><Btn small variant="danger" onClick={() => confirmThen(`Delete “${s.name}”?`, () => skills.remove(s.id))}>×</Btn><Toggle label={`Enable ${s.name}`} checked={s.enabled} onChange={(v) => skills.update(s.id, { enabled: v })} /></>} />)}</List>)
      : (mcp.loading ? <Loading /> : mcp.items.length === 0 ? <Empty mate="byte" title="No MCP servers" text="Add a server URL to give your Mates new tools. It stays unverified until a backend checks it." action={<Btn variant="primary" onClick={() => setMc({ ...blankMcp })}>Add server</Btn>} /> :
        <List>{mcp.items.map((m) => <Item key={m.id} title={m.name} sub={`${m.url}${m.tools.length ? ` · ${m.tools.length} tools` : ''}`}
          right={<><Badge tone={m.status === 'connected' ? 'ok' : m.status === 'error' ? 'bad' : undefined}>{m.status}</Badge><Btn small onClick={() => mcp.reload().then(() => api.mcp.verify(m.id))}>Verify</Btn><Btn small onClick={() => setMc(m)}>Edit</Btn>
            <Btn small variant="danger" onClick={() => confirmThen(`Remove “${m.name}”?`, () => mcp.remove(m.id))}>×</Btn><Toggle label={`Enable ${m.name}`} checked={m.enabled} onChange={(v) => mcp.update(m.id, { enabled: v })} /></>} />)}</List>)}
      {sk && <Modal title={sk.id ? 'Edit skill' : 'New skill'} onClose={() => setSk(null)} canSubmit={!!sk.name.trim() && !!sk.instructions.trim()} onSubmit={async () => { const { id, ...d } = sk; await (id ? skills.update(id, d) : skills.create(d)); setSk(null); }}>
        <Field label="Name"><Input value={sk.name} onChange={(e) => setSk({ ...sk, name: e.target.value })} /></Field>
        <Field label="When should it be used?"><Input value={sk.description} onChange={(e) => setSk({ ...sk, description: e.target.value })} /></Field>
        <Field label="Instructions"><Textarea value={sk.instructions} onChange={(e) => setSk({ ...sk, instructions: e.target.value })} /></Field>
        <Field label="Mates (none selected = all)"><Chips options={names} value={sk.mates.map((k) => MATE_DEFS.find((m) => m.key === k)!.name)} onChange={(v) => setSk({ ...sk, mates: v.map((n) => MATE_DEFS.find((m) => m.name === n)!.key as MateKey) })} /></Field></Modal>}
      {mc && <Modal title={mc.id ? 'Edit server' : 'Add MCP server'} onClose={() => setMc(null)} canSubmit={!!mc.name.trim() && /^https?:\/\//.test(mc.url)} onSubmit={async () => { const { id, ...d } = mc; await (id ? mcp.update(id, { ...d, status: 'unverified' }) : mcp.create(d)); setMc(null); }}>
        <Field label="Name"><Input value={mc.name} onChange={(e) => setMc({ ...mc, name: e.target.value })} /></Field>
        <Field label="Server URL"><Input type="url" placeholder="https://…" value={mc.url} onChange={(e) => setMc({ ...mc, url: e.target.value })} /></Field>
        <Field label="What does it do?"><Input value={mc.description} onChange={(e) => setMc({ ...mc, description: e.target.value })} /></Field></Modal>}
    </Page>
  );
}
