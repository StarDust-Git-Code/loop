'use client';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import type { Connection, Provider } from '../../lib/types';
import { Badge, Btn, Card, confirmThen, ErrorNote, Field, Grid, Input, Loading, Modal, Page } from '../ui/ui';

const PROVIDERS: Record<Provider, { name: string; text: string; fields: { key: string; label: string; secret?: boolean }[] }> = {
  telegram: { name: 'Telegram', text: 'Chat with your Mates and get a ping when a run finishes.', fields: [{ key: 'botToken', label: 'Bot token', secret: true }, { key: 'chatId', label: 'Chat ID' }] },
  whatsapp: { name: 'WhatsApp', text: 'Let Mates read chats you choose to share.', fields: [{ key: 'phone', label: 'Phone number' }] },
  gdrive: { name: 'Google Drive', text: 'Search and read files from your Drive.', fields: [{ key: 'folder', label: 'Folder to share (optional)' }] },
  github: { name: 'GitHub', text: 'Let Code Mate open pull requests and read repos.', fields: [{ key: 'token', label: 'Personal access token', secret: true }, { key: 'repo', label: 'Default repo (owner/name)' }] },
  email: { name: 'Email', text: 'Send summaries to your inbox.', fields: [{ key: 'address', label: 'Email address' }] },
};

export function Connections() {
  const { items, loading, error, create, update, remove } = useRepo(api.connections);
  const [open, setOpen] = useState<Provider | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const of = (p: Provider) => items.find((c) => c.provider === p);
  const start = (p: Provider) => { setCfg(of(p)?.config ?? {}); setOpen(p); };
  const save = async () => {
    if (!open) return; const ex = of(open);
    const d = { provider: open, label: PROVIDERS[open].name, status: 'pending' as Connection['status'], config: cfg };
    const c = ex ? await update(ex.id, d) : await create(d); setOpen(null); await api.connections.test(c.id);
  };
  const def = open && PROVIDERS[open];
  return (
    <Page title="Connections" sub="Choose where Mates can read and where they can send results. Credentials are only sent to your backend.">
      <ErrorNote message={error} />
      {loading ? <Loading /> : (
        <Grid>{(Object.keys(PROVIDERS) as Provider[]).map((p) => { const c = of(p); return (
          <Card key={p}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><b style={{ flex: 1 }}>{PROVIDERS[p].name}</b><Badge tone={c?.status === 'connected' ? 'ok' : c?.status === 'error' ? 'bad' : undefined}>{c ? (c.status === 'pending' ? 'Waiting for backend' : c.status) : 'Not connected'}</Badge></div>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>{PROVIDERS[p].text}</p>
            <div style={{ display: 'flex', gap: 6 }}><Btn small variant={c ? undefined : 'primary'} onClick={() => start(p)}>{c ? 'Edit' : 'Connect'}</Btn>
              {c && <><Btn small onClick={() => api.connections.test(c.id)}>Test</Btn><Btn small variant="danger" onClick={() => confirmThen(`Disconnect ${PROVIDERS[p].name}?`, () => remove(c.id))}>Disconnect</Btn></>}</div>
          </Card>); })}</Grid>
      )}
      {open && def && <Modal title={`Connect ${def.name}`} submitLabel="Save and test" onClose={() => setOpen(null)} onSubmit={save} canSubmit={def.fields.some((f) => cfg[f.key]?.trim())}>
        {def.fields.map((f) => <Field key={f.key} label={f.label}><Input type={f.secret ? 'password' : 'text'} autoComplete="off" value={cfg[f.key] ?? ''} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })} /></Field>)}
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{api.capabilities.backend ? '' : 'Saved in this browser only until a backend is connected. Do not enter real secrets in this mode.'}</p></Modal>}
    </Page>
  );
}
