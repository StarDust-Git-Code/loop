'use client';
import { useRef } from 'react';
import { api } from '../../lib/api';
import { ago, bytes } from '../../lib/format';
import { useRepo } from '../../lib/hooks';
import { Badge, Btn, confirmThen, Empty, ErrorNote, Item, List, Loading, Page } from '../ui/ui';

export function Files() {
  const { items, loading, error, remove } = useRepo(api.files);
  const pick = useRef<HTMLInputElement>(null);
  return (
    <Page title="Files" sub="Files you upload and files your Mates create." actions={<><Btn variant="primary" onClick={() => pick.current?.click()}>Upload</Btn>
      <input ref={pick} type="file" multiple hidden onChange={async (e) => { for (const f of Array.from(e.target.files ?? [])) await api.files.upload(f); e.target.value = ''; }} /></>}>
      <ErrorNote message={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty mate="chef" title="No files yet" text="Upload something, or run a task that produces a report." /> :
        <List>{items.map((f) => <Item key={f.id} title={api.capabilities.backend ? <a href={api.files.downloadUrl(f.id)}>{f.name}</a> : f.name} sub={`${bytes(f.size)} · ${f.mime} · ${ago(f.createdAt)}`}
          right={<>{f.source === 'run' && <Badge>From a run</Badge>}<Btn small variant="danger" onClick={() => confirmThen(`Delete ${f.name}?`, () => remove(f.id))}>Delete</Btn></>} />)}</List>}
      {!api.capabilities.backend && <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 12 }}>File contents are not stored without a backend; only names and sizes are kept here.</p>}
    </Page>
  );
}
