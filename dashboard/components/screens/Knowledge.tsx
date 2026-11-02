'use client';
import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import { ago, bytes } from '../../lib/format';
import { useRepo } from '../../lib/hooks';
import type { KnowledgeIn } from '../../lib/types';
import { Badge, Btn, confirmThen, Empty, ErrorNote, Field, Input, Item, List, Loading, Modal, Page, Textarea } from '../ui/ui';

export function Knowledge() {
  const { items, loading, error, create, remove } = useRepo(api.knowledge);
  const [add, setAdd] = useState<'url' | 'note' | null>(null);
  const [form, setForm] = useState({ name: '', url: '', text: '' });
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: string; name: string; snippet: string }[] | null>(null);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const d: KnowledgeIn = add === 'url' ? { kind: 'url', name: form.name || form.url, url: form.url, status: 'pending' } : { kind: 'note', name: form.name, text: form.text, status: 'pending' };
    await create(d); setAdd(null); setForm({ name: '', url: '', text: '' });
  };
  const search = async () => { try { setHits(await api.search.knowledge(q)); setSearchErr(null); } catch (e) { setSearchErr(e instanceof Error ? e.message : 'Search failed'); } };
  return (
    <Page title="Knowledge" sub="What your Mates know: files, pages and notes they can search and cite." actions={<>
      <Btn onClick={() => setAdd('url')}>Add URL</Btn><Btn onClick={() => setAdd('note')}>Add note</Btn><Btn variant="primary" onClick={() => pick.current?.click()}>Upload file</Btn>
      <input ref={pick} type="file" hidden multiple onChange={async (e) => { for (const f of Array.from(e.target.files ?? [])) { const up = await api.files.upload(f); await create({ kind: 'file', name: f.name, size: f.size, url: up.id, status: 'pending' }); } e.target.value = ''; }} /></>}>
      <ErrorNote message={error ?? searchErr} />
      <form onSubmit={(e) => { e.preventDefault(); void search(); }} style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 560 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your knowledge…" aria-label="Search knowledge" /><Btn type="submit" disabled={!q.trim()}>Search</Btn>
      </form>
      {hits && (hits.length === 0 ? <p style={{ color: 'var(--muted)' }}>{api.capabilities.backend ? 'No matches.' : 'Search needs the backend (indexing and retrieval).'}</p> : <List>{hits.map((h) => <Item key={h.id} title={h.name} sub={h.snippet} />)}</List>)}
      {loading ? <Loading /> : items.length === 0 ? <Empty mate="recall" title="Nothing here yet" text="Add a file, a web page or a note. Your Mates will be able to search it once a backend indexes it." /> : (
        <List>{items.map((k) => (
          <Item key={k.id} title={k.name} sub={`${k.kind}${k.size ? ` · ${bytes(k.size)}` : ''}${k.kind === 'url' ? ` · ${k.url}` : ''} · added ${ago(k.createdAt)}`}
            right={<><Badge tone={k.status === 'indexed' ? 'ok' : k.status === 'error' ? 'bad' : undefined}>{k.status === 'pending' ? 'Not indexed' : k.status}</Badge><Btn small variant="danger" onClick={() => confirmThen(`Remove “${k.name}”?`, () => remove(k.id))}>Remove</Btn></>} />))}
        </List>
      )}
      {add && (
        <Modal title={add === 'url' ? 'Add a web page' : 'Add a note'} onClose={() => setAdd(null)} onSubmit={submit} canSubmit={add === 'url' ? /^https?:\/\//.test(form.url) : !!form.name.trim() && !!form.text.trim()}>
          {add === 'url' ? <Field label="URL"><Input type="url" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field> : null}
          <Field label={add === 'url' ? 'Name (optional)' : 'Title'}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          {add === 'note' && <Field label="Note"><Textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></Field>}
        </Modal>
      )}
    </Page>
  );
}
