'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ago } from '../../lib/format';
import { useRepo } from '../../lib/hooks';
import type { AutomationIn, Schedule } from '../../lib/types';
import { Badge, Btn, confirmThen, Empty, ErrorNote, Field, Input, Item, List, Loading, Modal, Page, Select, Textarea, Toggle } from '../ui/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const describe = (s: Schedule) => s.kind === 'manual' ? 'Manual' : s.kind === 'daily' ? `Every day at ${s.time ?? '09:00'}` : s.kind === 'weekly' ? `${(s.days ?? []).map((d) => DAYS[d]).join(', ') || 'No days'} at ${s.time ?? '09:00'}` : `Cron ${s.cron ?? ''}`;
const blank: AutomationIn = { name: '', description: '', schedule: { kind: 'daily', time: '09:00' }, enabled: true };

export function Automations() {
  const { items, loading, error, create, update, remove } = useRepo(api.automations);
  const { items: workflows } = useRepo(api.workflows);
  const router = useRouter();
  const [edit, setEdit] = useState<(AutomationIn & { id?: string }) | null>(null);
  const save = async () => { if (!edit) return; const { id, ...d } = edit; await (id ? update(id, d) : create(d)); setEdit(null); };
  const runNow = async (a: (typeof items)[number]) => {
    const r = await api.runs.start({ prompt: a.description || a.name, workflowId: a.workflowId, askFirst: true });
    await update(a.id, { lastRunAt: new Date().toISOString() }); router.push(`/run?id=${r.id}`);
  };
  const sch = edit?.schedule;
  return (
    <Page title="Automations" sub="Work that runs on its own. A schedule fires a workflow; the backend does the scheduling." actions={<Btn variant="primary" onClick={() => setEdit({ ...blank })}>New automation</Btn>}>
      <ErrorNote message={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty title="No automations yet" text="Pick a workflow and a schedule, for example a Monday-morning digest." action={<Btn variant="primary" onClick={() => setEdit({ ...blank })}>New automation</Btn>} /> : (
        <List>{items.map((a) => (
          <Item key={a.id} title={a.name} sub={`${describe(a.schedule)} · ${workflows.find((w) => w.id === a.workflowId)?.name ?? 'No workflow'}${a.lastRunAt ? ` · last run ${ago(a.lastRunAt)}` : ''}`}
            right={<>{!a.enabled && <Badge>Paused</Badge>}<Btn small onClick={() => runNow(a)}>Run now</Btn><Btn small onClick={() => setEdit(a)}>Edit</Btn>
              <Btn small variant="danger" onClick={() => confirmThen(`Delete “${a.name}”?`, () => remove(a.id))}>×</Btn>
              <Toggle label={`Enable ${a.name}`} checked={a.enabled} onChange={(v) => update(a.id, { enabled: v })} /></>} />))}
        </List>
      )}
      {edit && sch && (
        <Modal title={edit.id ? 'Edit automation' : 'New automation'} onClose={() => setEdit(null)} onSubmit={save} canSubmit={!!edit.name.trim()}>
          <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="What should it do?"><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <Field label="Workflow"><Select value={edit.workflowId ?? ''} onChange={(e) => setEdit({ ...edit, workflowId: e.target.value || undefined })}><option value="">None (use the description)</option>{workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
          <Field label="Schedule"><Select value={sch.kind} onChange={(e) => setEdit({ ...edit, schedule: { ...sch, kind: e.target.value as Schedule['kind'] } })}><option value="manual">Manual only</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="cron">Cron expression</option></Select></Field>
          {(sch.kind === 'daily' || sch.kind === 'weekly') && <Field label="Time"><Input type="time" value={sch.time ?? '09:00'} onChange={(e) => setEdit({ ...edit, schedule: { ...sch, time: e.target.value } })} /></Field>}
          {sch.kind === 'weekly' && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{DAYS.map((d, i) => { const on = (sch.days ?? []).includes(i); return <Btn key={d} small variant={on ? 'primary' : undefined} onClick={() => setEdit({ ...edit, schedule: { ...sch, days: on ? (sch.days ?? []).filter((x) => x !== i) : [...(sch.days ?? []), i] } })}>{d}</Btn>; })}</div>}
          {sch.kind === 'cron' && <Field label="Cron (minute hour day month weekday)"><Input value={sch.cron ?? ''} placeholder="0 9 * * 1" onChange={(e) => setEdit({ ...edit, schedule: { ...sch, cron: e.target.value } })} /></Field>}
        </Modal>
      )}
    </Page>
  );
}
