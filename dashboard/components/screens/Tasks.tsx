'use client';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { MATE_DEFS } from '../../lib/mates';
import type { MateKey, Task, TaskIn } from '../../lib/types';
import { Btn, Card, confirmThen, ErrorNote, Field, Input, Loading, MateAvatar, Modal, Page, Select, Textarea } from '../ui/ui';

const COLS: { id: Task['status']; label: string }[] = [{ id: 'todo', label: 'To do' }, { id: 'doing', label: 'In progress' }, { id: 'done', label: 'Done' }];
const blank: TaskIn = { title: '', detail: '', status: 'todo' };

export function Tasks() {
  const { items, loading, error, create, update, remove } = useRepo(api.tasks);
  const [edit, setEdit] = useState<(TaskIn & { id?: string }) | null>(null);
  const save = async () => { if (!edit) return; const { id, ...d } = edit; await (id ? update(id, d) : create(d)); setEdit(null); };
  return (
    <Page title="Tasks" sub="Your to-dos and the jobs your Mates are working on, in one place." actions={<Btn variant="primary" onClick={() => setEdit({ ...blank })}>New task</Btn>}>
      <ErrorNote message={error} />
      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
          {COLS.map((c) => {
            const list = items.filter((t) => t.status === c.id);
            return (
              <div key={c.id} style={{ background: '#faf9fd', borderRadius: 16, padding: 12, minHeight: 200 }}>
                <b style={{ fontSize: 13 }}>{c.label} <span style={{ color: 'var(--muted)' }}>{list.length}</span></b>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {list.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: 0 }}>Nothing here.</p>}
                  {list.map((t) => (
                    <Card key={t.id}>
                      <div style={{ display: 'flex', gap: 8 }}>{t.mate && <MateAvatar mate={t.mate} size={26} />}<b style={{ flex: 1, fontSize: 13.5 }}>{t.title}</b></div>
                      {t.detail && <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 12.5 }}>{t.detail}</p>}
                      {t.dueAt && <p style={{ margin: '6px 0 0', fontSize: 12 }}>Due {new Date(t.dueAt).toLocaleDateString()}</p>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        {COLS.filter((x) => x.id !== t.status).map((x) => <Btn key={x.id} small onClick={() => update(t.id, { status: x.id })}>→ {x.label}</Btn>)}
                        <Btn small onClick={() => setEdit(t)}>Edit</Btn>
                        <Btn small variant="danger" onClick={() => confirmThen('Delete this task?', () => remove(t.id))}>×</Btn>
                      </div>
                    </Card>))}
                </div>
              </div>);
          })}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Edit task' : 'New task'} onClose={() => setEdit(null)} onSubmit={save} canSubmit={!!edit.title.trim()}>
          <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <Field label="Details"><Textarea value={edit.detail} onChange={(e) => setEdit({ ...edit, detail: e.target.value })} /></Field>
          <Field label="Assign to a Mate (optional)"><Select value={edit.mate ?? ''} onChange={(e) => setEdit({ ...edit, mate: (e.target.value || undefined) as MateKey | undefined })}><option value="">Me</option>{MATE_DEFS.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</Select></Field>
          <Field label="Due date (optional)"><Input type="date" value={edit.dueAt?.slice(0, 10) ?? ''} onChange={(e) => setEdit({ ...edit, dueAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></Field>
        </Modal>
      )}
    </Page>
  );
}
