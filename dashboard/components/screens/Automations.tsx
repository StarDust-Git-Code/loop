'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ago, bytes } from '../../lib/format';
import { useRepo } from '../../lib/hooks';
import { MATES, mateImg, mateName } from '../../lib/mates';
import type { Automation, AutomationIn, Schedule } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Btn, confirmThen, Empty, ErrorNote, Field, Input, Loading, Modal, Page, Select, Textarea, Toggle } from '../ui/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const describe = (s: Schedule) => s.kind === 'manual' ? 'On demand' : s.kind === 'daily' ? `Every day ${s.time ?? '09:00'}` : s.kind === 'weekly' ? `${(s.days ?? []).map((d) => DAYS[d]).join(', ') || 'No days'} ${s.time ?? '09:00'}` : `Cron ${s.cron ?? ''}`;
const blank: AutomationIn = { name: '', description: '', schedule: { kind: 'daily', time: '09:00' }, enabled: true };
const card = { background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, boxShadow: '0 2px 6px rgba(31,26,23,.05)' } as const;

export function Automations() {
  const { items, loading, error, create, update, remove } = useRepo(api.automations);
  const workflows = useRepo(api.workflows).items; const runs = useRepo(api.runs).items; const files = useRepo(api.files).items;
  const router = useRouter(); const toast = useToast(); const params = useSearchParams();
  const [pick, setPick] = useState<string | null>(params.get('id'));
  const [edit, setEdit] = useState<(AutomationIn & { id?: string }) | null>(null);
  const cur: Automation | undefined = items.find((a) => a.id === pick) ?? items[0];
  const wf = cur && workflows.find((w) => w.id === cur.workflowId);
  const steps = wf ? [...wf.nodes].sort((a, b) => a.x - b.x || a.y - b.y) : [];
  const last = cur && runs.filter((r) => r.workflowId && r.workflowId === cur.workflowId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const outs = last ? files.filter((f) => last.fileIds.includes(f.id)) : [];
  const save = async () => { if (!edit) return; const { id, ...d } = edit; const r = await (id ? update(id, d) : create(d)); setEdit(null); setPick(r.id); };
  const runNow = async (a: Automation) => { const r = await api.runs.start({ prompt: a.description || a.name, workflowId: a.workflowId, askFirst: true }); await update(a.id, { lastRunAt: new Date().toISOString() }); toast('Run started'); router.push(`/run?id=${r.id}`); };
  const sch = edit?.schedule;

  return (
    <Page fill title="Automations" sub="Work that runs on its own." actions={<Btn variant="primary" aria-label="New automation" onClick={() => setEdit({ ...blank })}>+</Btn>}>
      <ErrorNote message={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty mate="spark" title="No automations yet" text="Pick a workflow and a schedule, for example a Monday-morning digest. The backend does the scheduling." action={<Btn variant="primary" onClick={() => setEdit({ ...blank })}>New automation</Btn>} /> : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(260px,360px) minmax(0,1fr)', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
            {items.map((a, i) => { const w = workflows.find((x) => x.id === a.workflowId); const m = w?.nodes.find((n) => n.mate)?.mate; const on = a.id === cur?.id;
              return (
                <button key={a.id} onClick={() => setPick(a.id)} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: 16, textAlign: 'left', font: 'inherit', cursor: 'pointer', background: on ? '#F4F0FF' : '#fff', borderColor: on ? '#6A4DF4' : card.border, animation: `lm-up .3s ${Math.min(i, 8) * 40}ms ease both`, transition: 'background .2s, border-color .2s' }}>
                  <img src={mateImg(m ?? 'spark')} alt="" width={40} height={40} /><div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 15, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</b><span style={{ color: '#6B6572', fontSize: 13 }}>{describe(a.schedule)}</span></div>
                  <span style={{ background: a.enabled ? '#E6F4EA' : '#ECE9F4', color: a.enabled ? '#1E7A46' : '#6B6572', fontSize: 12, fontWeight: 600, borderRadius: 99, padding: '4px 12px' }}>{a.enabled ? 'On' : 'Paused'}</span>
                </button>); })}
          </div>

          {cur && (
            <div key={cur.id} style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, overflow: 'auto', animation: 'lm-up .3s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex' }}>{[...new Set(steps.filter((s) => s.mate).map((s) => s.mate!))].slice(0, 3).map((m, k) => <img key={m} src={mateImg(m)} alt="" width={40} height={40} style={{ marginLeft: k ? -8 : 0 }} />)}</div>
                <div style={{ flex: 1, minWidth: 200 }}><b style={{ fontSize: 22 }}>{cur.name}</b><div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}><span style={{ background: '#F1EFF6', borderRadius: 6, padding: '3px 8px', fontSize: 12.5 }}>{describe(cur.schedule)}</span>{cur.lastRunAt && <span style={{ background: '#F1EFF6', borderRadius: 6, padding: '3px 8px', fontSize: 12.5 }}>Last run {ago(cur.lastRunAt)}</span>}</div></div>
                <Toggle label={`Enable ${cur.name}`} checked={cur.enabled} onChange={(v) => update(cur.id, { enabled: v })} />
                <Btn onClick={() => setEdit(cur)}>Edit</Btn>
                {wf && <Btn href={`/studio?id=${wf.id}`}>Edit in Studio</Btn>}
                <Btn variant="primary" onClick={() => runNow(cur)}>Run now</Btn>
                <Btn variant="danger" small aria-label="Delete automation" onClick={() => confirmThen(`Delete “${cur.name}”?`, () => remove(cur.id))}>✕</Btn>
              </div>
              {cur.description && <p style={{ margin: 0, color: '#3D3946', fontSize: 14.5 }}>{cur.description}</p>}

              {steps.length > 0 ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
                {steps.map((s, i) => (
                  <div key={s.id} style={{ ...card, padding: 14, animation: `lm-up .3s ${i * 40}ms ease both`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}><span className="mono" style={{ fontSize: 11, color: '#6B6572', flex: 1 }}>{String(i + 1).padStart(2, '0')}</span>{s.mate && <img src={mateImg(s.mate)} alt="" width={28} height={28} />}</div>
                    <b style={{ fontSize: 14.5 }}>{s.label}</b>
                    <span style={{ color: '#6B6572', fontSize: 12.5, lineHeight: 1.4, flex: 1 }}>{s.config?.description || (s.mate ? MATES[s.mate].blurb : s.type)}</span>
                    <span style={{ background: '#F1EFF6', borderRadius: 6, padding: '3px 8px', fontSize: 12, alignSelf: 'flex-start' }}>{s.mate ? mateName(s.mate) : s.type}</span>
                  </div>))}
              </div> : <div style={{ ...card, padding: 20, color: '#6B6572', fontSize: 14 }}>{cur.workflowId ? 'That workflow no longer exists.' : 'No workflow attached. Edit this automation and pick one, and its steps show up here.'}</div>}

              <div style={{ ...card, padding: 20 }}>
                <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: '#3D3946', marginBottom: 12 }}><span style={{ flex: 1 }}>LATEST OUTPUTS</span>{last && <Link href={`/run?id=${last.id}`} style={{ fontWeight: 500, letterSpacing: 0, color: '#4F34D6' }}>Open the run</Link>}</div>
                {!last ? <p style={{ color: '#6B6572', margin: 0, fontSize: 14 }}>No runs yet. Use Run now, or wait for the schedule.</p> : <>
                  {last.report && <div style={{ background: '#F4F2FA', borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 1.55, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{last.report.slice(0, 400)}</div>}
                  {outs.map((f) => <div key={f.id} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 13.5 }}><a href="#" onClick={(e) => { e.preventDefault(); api.files.download(f.id, f.name).catch((err: Error) => toast(err.message)); }} style={{ flex: 1 }}>{f.name}</a><span style={{ color: '#6B6572' }}>{bytes(f.size)}</span></div>)}
                  {!last.report && outs.length === 0 && <p style={{ color: '#6B6572', margin: 0, fontSize: 14 }}>Status: {last.status}. Nothing produced yet.</p>}
                  {last.approvals.some((a) => a.status === 'pending') && <Btn style={{ width: '100%', marginTop: 10, background: '#F4F0FF', color: '#4F34D6', borderColor: 'rgba(106,77,244,.4)' }} href={`/run?id=${last.id}`}>Review and approve</Btn>}
                </>}
              </div>
              <div style={{ background: '#F4F0FF', border: '1px solid rgba(106,77,244,.25)', borderRadius: 14, padding: 16, fontSize: 13.5, lineHeight: 1.55, color: '#3D3946' }}>Automations follow your harness rules. Anything that sends or writes outside the workspace waits for your approval first.</div>
            </div>)}
        </div>)}
      {edit && sch && (
        <Modal title={edit.id ? 'Edit automation' : 'New automation'} onClose={() => setEdit(null)} onSubmit={save} canSubmit={!!edit.name.trim()}>
          <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="What should it do?"><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <Field label="Workflow"><Select value={edit.workflowId ?? ''} onChange={(e) => setEdit({ ...edit, workflowId: e.target.value || undefined })}><option value="">None (use the description)</option>{workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
          <Field label="Schedule"><Select value={sch.kind} onChange={(e) => setEdit({ ...edit, schedule: { ...sch, kind: e.target.value as Schedule['kind'] } })}><option value="manual">Manual only</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="cron">Cron expression</option></Select></Field>
          {(sch.kind === 'daily' || sch.kind === 'weekly') && <Field label="Time"><Input type="time" value={sch.time ?? '09:00'} onChange={(e) => setEdit({ ...edit, schedule: { ...sch, time: e.target.value } })} /></Field>}
          {sch.kind === 'weekly' && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{DAYS.map((d, i) => { const on = (sch.days ?? []).includes(i); return <Btn key={d} small variant={on ? 'primary' : undefined} onClick={() => setEdit({ ...edit, schedule: { ...sch, days: on ? (sch.days ?? []).filter((x) => x !== i) : [...(sch.days ?? []), i] } })}>{d}</Btn>; })}</div>}
          {sch.kind === 'cron' && <Field label="Cron (minute hour day month weekday)"><Input value={sch.cron ?? ''} placeholder="0 9 * * 1" onChange={(e) => setEdit({ ...edit, schedule: { ...sch, cron: e.target.value } })} /></Field>}
        </Modal>)}
    </Page>
  );
}
