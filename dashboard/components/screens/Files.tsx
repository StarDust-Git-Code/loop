'use client';
import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import { ago, bytes } from '../../lib/format';
import { useRepo } from '../../lib/hooks';
import { useToast } from '../ui/toast';
import { Btn, confirmThen, Empty, ErrorNote, Loading, Page, Tabs } from '../ui/ui';
import { Icon } from '../ui/Icon';

type F = 'all' | 'upload' | 'run';
const ext = (n: string) => (n.includes('.') ? n.split('.').pop()!.slice(0, 4).toUpperCase() : 'FILE');
const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

export function Files() {
  const { items, loading, error, remove } = useRepo(api.files); const toast = useToast();
  const [f, setF] = useState<F>('all'); const [q, setQ] = useState(''); const [over, setOver] = useState(false); const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const up = async (list: File[]) => { setBusy(true); try { for (const x of list) await api.files.upload(x); toast(`${list.length} file${list.length > 1 ? 's' : ''} added`); } finally { setBusy(false); } };
  const shown = items.filter((x) => (f === 'all' || x.source === f) && x.name.toLowerCase().includes(q.toLowerCase()));
  const total = items.reduce((a, x) => a + x.size, 0);
  return (
    <Page fill title="Files" sub={items.length ? `${items.length} files · ${bytes(total)}` : 'Files you upload and files your Mates create.'} actions={<>
      <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search files" placeholder="Search files" style={{ width: 240, height: 42, border: '1px solid rgba(27,24,34,.17)', borderRadius: 10, padding: '0 14px', font: 'inherit', fontSize: 14, background: '#fff' }} />
      <Tabs value={f} onChange={setF} options={[{ id: 'all', label: 'All' }, { id: 'upload', label: 'Uploads' }, { id: 'run', label: 'From runs' }]} />
      <Btn variant="primary" onClick={() => pick.current?.click()} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</Btn>
      <input ref={pick} type="file" multiple hidden onChange={(e) => { void up(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></>}>
      <ErrorNote message={error} />
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void up(Array.from(e.dataTransfer.files)); }}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `2px dashed ${over ? '#6A4DF4' : 'transparent'}`, background: over ? '#F4F0FF' : 'none', borderRadius: 18, padding: over ? 14 : 0, transition: 'all .2s' }}>
        {loading ? <Loading /> : items.length === 0 ? <Empty mate="chef" title="No files yet" text="Drop files anywhere on this page, or press Upload. Files your Mates create in a run land here too." action={<Btn variant="primary" onClick={() => pick.current?.click()}>Upload a file</Btn>} /> : shown.length === 0 ? <p style={{ color: '#6B6572' }}>No files match.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14 }}>
            {shown.map((x, i) => (
              <article key={x.id} style={{ background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, boxShadow: '0 2px 6px rgba(31,26,23,.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, animation: `lm-up .3s ${Math.min(i, 10) * 30}ms ease both`, transition: 'transform .2s' }} onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')} onMouseLeave={(e) => (e.currentTarget.style.transform = '')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 11, background: `hsl(${hue(ext(x.name))} 80% 93%)`, color: `hsl(${hue(ext(x.name))} 55% 35%)`, fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flex: 'none' }}>{ext(x.name)}</span>
                  <div style={{ minWidth: 0 }}><b style={{ fontSize: 14.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.name}>{x.name}</b><span style={{ color: '#6B6572', fontSize: 12.5 }}>{bytes(x.size)} · {ago(x.createdAt)}</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: x.source === 'run' ? '#E6F4EA' : '#ECE7FF', color: x.source === 'run' ? '#1E7A46' : '#4F34D6', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{x.source === 'run' ? 'From a run' : 'Upload'}</span>
                  <span style={{ flex: 1 }} />
                  {api.capabilities.backend && <a href="#" onClick={(e) => { e.preventDefault(); api.files.download(x.id, x.name).catch((err: Error) => toast(err.message)); }} style={{ fontSize: 13, color: '#4F34D6', fontWeight: 600 }}>Download</a>}
                  <button aria-label={`Delete ${x.name}`} onClick={() => confirmThen(`Delete ${x.name}?`, () => remove(x.id))} style={{ border: 0, background: 'none', color: '#6B6572', cursor: 'pointer' }}><Icon name="close" size={16} /></button>
                </div>
              </article>))}
          </div>)}
        {!api.capabilities.backend && items.length > 0 && <p style={{ color: '#6B6572', fontSize: 12.5, marginTop: 14 }}>File contents are not stored without a backend; only names and sizes are kept here.</p>}
      </div>
    </Page>
  );
}
