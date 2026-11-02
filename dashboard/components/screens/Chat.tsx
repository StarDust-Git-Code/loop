'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { ago } from '../../lib/format';
import { useItem, useRepo } from '../../lib/hooks';
import { MATE_DEFS } from '../../lib/mates';
import { Badge, Btn, Empty, Input, Page, Select, confirmThen } from '../ui/ui';

export function Chat() {
  const router = useRouter();
  const cid = useSearchParams().get('c');
  const { items, remove } = useRepo(api.conversations);
  const { item: conv } = useItem(api.conversations, cid);
  const [text, setText] = useState('');
  const [mate, setMate] = useState('planner');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [conv?.messages.length]);

  const newChat = async () => { const c = await api.conversations.create({ title: 'New chat', messages: [] }); router.push(`/chat?c=${c.id}`); };
  const send = async () => {
    const t = text.trim(); if (!t) return;
    let id = cid;
    if (!id) { const c = await api.conversations.create({ title: t.slice(0, 40), messages: [] }); id = c.id; router.replace(`/chat?c=${id}`); }
    else if (conv && conv.messages.length === 0) await api.conversations.update(id, { title: t.slice(0, 40) });
    setText(''); await api.conversations.send(id, t, mate);
  };

  return (
    <Page title="Chat" sub="Talk to any Mate. Chat is where you start; the Mates can hand work to runs." actions={<Btn variant="primary" onClick={newChat}>New chat</Btn>}>
      <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0,1fr)', gap: 16, minHeight: 520 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No chats yet.</p>}
          {items.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 4 }}>
              <Btn small className="" onClick={() => router.push(`/chat?c=${c.id}`)} style={{ flex: 1, justifyContent: 'flex-start', borderColor: c.id === cid ? 'var(--accent)' : undefined, overflow: 'hidden' }}>{c.title}</Btn>
              <Btn small variant="danger" aria-label={`Delete ${c.title}`} onClick={() => confirmThen('Delete this chat?', () => { void remove(c.id); if (c.id === cid) router.replace('/chat'); })}>×</Btn>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line-soft)', borderRadius: 16, minHeight: 520 }}>
          <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', maxHeight: 520 }}>
            {!conv || conv.messages.length === 0 ? <Empty mate="planner" title="Start a conversation" text="Ask a Mate anything or describe a job. Messages are saved to this chat." /> :
              conv.messages.map((m) => (
                <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  <div style={{ background: m.role === 'user' ? 'var(--chip)' : '#fff', border: '1px solid var(--line-soft)', borderRadius: 14, padding: '9px 13px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.text}</div>
                  <small style={{ color: 'var(--muted)' }}>{ago(m.at)} {m.state === 'pending' && <Badge>{api.capabilities.backend ? 'Sending…' : 'Waiting for backend'}</Badge>}{m.state === 'error' && <Badge tone="bad">Failed</Badge>}</small>
                </div>))}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--line-soft)' }}>
            <Select style={{ width: 130 }} value={mate} onChange={(e) => setMate(e.target.value)} aria-label="Mate">{MATE_DEFS.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</Select>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message a Mate…" aria-label="Message" />
            <Btn variant="primary" type="submit" disabled={!text.trim()}>Send</Btn>
          </form>
        </div>
      </div>
    </Page>
  );
}
