'use client';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ago, day } from '../../lib/format';
import { useRepo } from '../../lib/hooks';
import type { MemoryIn } from '../../lib/types';
import { Badge, Btn, Card, confirmThen, Empty, ErrorNote, Input, Item, List, Loading, Page, Select, Tabs, Toggle } from '../ui/ui';

type Kind = MemoryIn['kind'] | 'all';
export function MySpace() {
  const mem = useRepo(api.memories), ev = useRepo(api.events);
  const [kind, setKind] = useState<Kind>('all');
  const [text, setText] = useState('');
  const [mk, setMk] = useState<MemoryIn['kind']>('note');
  const [q, setQ] = useState('');
  const today = day(new Date());
  const todays = ev.items.filter((e) => e.start.slice(0, 10) === today).sort((a, b) => a.start.localeCompare(b.start));
  const shown = mem.items.filter((m) => (kind === 'all' || m.kind === kind) && m.text.toLowerCase().includes(q.toLowerCase()));
  const add = async () => { if (!text.trim()) return; await mem.create({ kind: mk, text: text.trim(), scope: 'private' }); setText(''); };
  return (
    <Page title="My Space" sub="Your private second brain: memories, ideas and today’s plan." actions={<Btn href="/schedule">Open schedule</Btn>}>
      <ErrorNote message={mem.error ?? ev.error} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <form onSubmit={(e) => { e.preventDefault(); void add(); }} style={{ display: 'flex', gap: 8 }}>
            <Select style={{ width: 120 }} value={mk} onChange={(e) => setMk(e.target.value as MemoryIn['kind'])} aria-label="Kind"><option value="note">Note</option><option value="idea">Idea</option><option value="decision">Decision</option><option value="fact">Fact</option></Select>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Remember something…" aria-label="New memory" /><Btn variant="primary" type="submit" disabled={!text.trim()}>Save</Btn>
          </form>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tabs value={kind} onChange={setKind} options={[{ id: 'all', label: 'All' }, { id: 'note', label: 'Notes' }, { id: 'idea', label: 'Ideas' }, { id: 'decision', label: 'Decisions' }, { id: 'fact', label: 'Facts' }]} />
            <Input style={{ width: 200 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" aria-label="Filter memories" />
          </div>
          {mem.loading ? <Loading /> : shown.length === 0 ? <Empty title={mem.items.length ? 'No matches' : 'Nothing remembered yet'} text="Notes you save here are private to you unless you share them with your Mates." /> :
            <List>{shown.map((m) => <Item key={m.id} title={m.text} sub={`${ago(m.createdAt)} · ${m.scope === 'shared' ? 'Shared with Mates' : 'Private'}`}
              right={<><Badge>{m.kind}</Badge><Toggle label="Share with Mates" checked={m.scope === 'shared'} onChange={(v) => mem.update(m.id, { scope: v ? 'shared' : 'private' })} />
                <Btn small variant="danger" onClick={() => confirmThen('Delete this memory?', () => mem.remove(m.id))}>×</Btn></>} />)}</List>}
        </div>
        <Card><b>Today</b>{todays.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing scheduled. Add events in Schedule.</p> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>{todays.map((e) => <div key={e.id} style={{ display: 'flex', gap: 10 }}>
            <span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>{e.title}</span></div>)}</div>}</Card>
      </div>
    </Page>
  );
}
