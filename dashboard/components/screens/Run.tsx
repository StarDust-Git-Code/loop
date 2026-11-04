'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ago, bytes, uid } from '../../lib/format';
import { useLiveRun, useRepo } from '../../lib/hooks';
import { mateImg, mateName } from '../../lib/mates';
import type { FlowEdge, FlowNode, Run as RunT } from '../../lib/types';
import { useToast } from '../ui/toast';
import { Markdown } from '../ui/Markdown';
import { Btn, Empty, Loading, Page, Pill, Tabs } from '../ui/ui';
import { Icon } from '../ui/Icon';

const LABEL: Record<RunT['status'], string> = { queued: 'Queued', running: 'Running', waiting_approval: 'Needs approval', done: 'Done', failed: 'Failed', stopped: 'Stopped' };
const TONE = { queued: 'warn', running: 'live', waiting_approval: 'warn', done: 'ok', failed: 'bad', stopped: 'warn' } as const;
const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const card = { background: '#fff', border: '1px solid rgba(27,24,34,.17)', borderRadius: 16, boxShadow: '0 2px 6px rgba(31,26,23,.05)' } as const;

export function Run() {
  const id = useSearchParams().get('id');
  return id ? <RunView id={id} /> : <RunList />;
}

function RunList() {
  const { items, loading, remove } = useRepo(api.runs);
  return (
    <Page title="Runs" sub="Every task you have started, newest first." actions={<Btn variant="primary" href="/">New task</Btn>}>
      {loading ? <Loading /> : items.length === 0 ? <Empty mate="planner" title="No runs yet" text="Describe a task on Home. Every step shows up here while it runs." action={<Btn variant="primary" href="/">Go to Home</Btn>} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((r, i) => (
            <Link key={r.id} href={`/run?id=${r.id}`} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', textDecoration: 'none', color: 'inherit', animation: `lm-up .35s ${Math.min(i, 10) * 35}ms ease both` }}>
              <div style={{ display: 'flex' }}>{(r.steps.length ? r.steps.slice(0, 4).map((s) => s.mate) : ['planner' as const]).map((m, k) => <img key={k} src={mateImg(m)} alt="" width={34} height={34} style={{ marginLeft: k ? -8 : 0 }} />)}</div>
              <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14.5 }}>{r.title}</b><div style={{ color: '#6B6572', fontSize: 12.5 }}>{ago(r.createdAt)} · {r.steps.length} steps</div></div>
              <Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill>
              <Btn small variant="danger" onClick={(e) => { e.preventDefault(); void remove(r.id); }}>Delete</Btn>
            </Link>))}
        </div>)}
    </Page>
  );
}

function RunView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { run, loading } = useLiveRun(id);
  const files = useRepo(api.files).items;
  const [tab, setTab] = useState<'report' | 'log' | 'sources' | 'files' | 'notes'>('report');
  const [steer, setSteer] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const live = run && (run.status === 'running' || run.status === 'waiting_approval');
  useEffect(() => { if (!live) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [live]);

  if (loading) return <Page title="Run"><Loading /></Page>;
  if (!run) return <Page title="Run not found"><Empty title="That run does not exist" text="It may have been deleted." action={<Btn href="/run">All runs</Btn>} /></Page>;

  const end = run.status === 'done' || run.status === 'failed' || run.status === 'stopped' ? new Date(run.updatedAt).getTime() : now;
  const outputs = files.filter((f) => run.fileIds.includes(f.id));
  const pending = run.approvals.find((a) => a.status === 'pending');
  const done = run.steps.filter((s) => s.status === 'done').length;
  const saveKnowledge = async () => { await api.knowledge.create({ kind: 'note', name: run.title, text: run.report, status: 'pending' }); toast('Saved to Knowledge'); };
  const saveWorkflow = async () => {
    const nodes: FlowNode[] = [{ id: uid(), type: 'trigger', label: 'Trigger', x: 40, y: 60 }, ...run.steps.map((s, i): FlowNode => ({ id: uid(), type: 'mate', mate: s.mate, label: s.label, x: 40 + (i + 1) * 200, y: 60 })), { id: uid(), type: 'output', label: 'Output', x: 40 + (run.steps.length + 1) * 200, y: 60 }];
    const edges: FlowEdge[] = nodes.slice(1).map((n, i) => ({ id: uid(), from: nodes[i].id, to: n.id }));
    const w = await api.workflows.create({ name: run.title, description: run.prompt.slice(0, 120), nodes, edges });
    toast('Saved as workflow'); router.push(`/studio?id=${w.id}`);
  };

  return (
    <Page fill crumb={<><Link href="/run" style={{ color: 'inherit' }}>Runs</Link> / {run.title}</>}
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{run.title}<Pill tone={TONE[run.status]}>{LABEL[run.status]}</Pill></span>}
      actions={<>
        <div style={{ display: 'flex', gap: 22, marginRight: 10 }}>{([['Elapsed', mmss(end - new Date(run.createdAt).getTime())], ['Sources', run.sources.length], ['Files', outputs.length]] as const).map(([k, v]) => <div key={k}><div style={{ fontSize: 11, color: '#6B6572' }}>{k}</div><b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{v}</b></div>)}</div>
        {(run.status === 'failed' || run.status === 'stopped') && api.capabilities.backend && <Btn variant="primary" onClick={async () => { try { await api.runs.retry(run.id); toast('Retrying from the failed step'); } catch (e) { toast(e instanceof Error ? e.message : 'Could not retry'); } }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="swap" size={16} />Retry</span></Btn>}
        {live && <Btn onClick={() => api.runs.control(run.id, 'pause')}>Pause</Btn>}
        {run.status === 'queued' && api.capabilities.backend && <Btn onClick={() => api.runs.control(run.id, 'resume')}>Resume</Btn>}
        {(live || run.status === 'queued') && <Btn variant="danger" onClick={() => api.runs.control(run.id, 'stop')}>Stop run</Btn>}
      </>}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
            <div style={{ ...card, padding: '14px 18px' }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#6B6572', marginBottom: 4 }}>TASK</div><div style={{ fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{run.prompt}</div></div>
            {run.status === 'failed' && <div role="alert" style={{ background: '#FDECEA', border: '1px solid rgba(179,38,30,.35)', borderRadius: 14, padding: '12px 16px' }}><b style={{ color: '#B3261E' }}>This run stopped{run.failure?.step ? ` at "${run.failure.step}"` : ''}</b><div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>{run.failure?.error || run.error || 'Something went wrong.'}{run.failure?.attempts ? ` (${run.failure.attempts} attempt${run.failure.attempts > 1 ? 's' : ''})` : ''}</div><div style={{ fontSize: 12.5, color: '#6B6572', marginTop: 4 }}>The finished steps are kept. Press Retry to continue from here. The full write-up is in the Report tab.</div></div>}
            {run.steps.length === 0 && <div style={{ ...card, padding: 22, display: 'flex', gap: 14, alignItems: 'center' }}><img src={mateImg('planner')} alt="" width={52} height={52} style={{ display: 'block', margin: '0 auto 6px', animation: 'lm-bob 3.6s ease-in-out infinite' }} /><div><b>{api.capabilities.backend ? 'Planner Mate is planning this run' : 'Waiting for a backend'}</b><div style={{ color: '#6B6572', fontSize: 13, marginTop: 2 }}>{api.capabilities.backend ? 'Steps appear here as they are planned.' : 'Nothing runs yet. Once a backend is connected, the Planner splits this task into steps and each Mate’s work shows up here.'}</div></div></div>}
            {run.steps.map((st, i) => {
              const running = st.status === 'running', waiting = st.status === 'waiting', failed = st.status === 'failed';
              const lines = run.log.filter((l) => l.source === st.mate || l.source === 'system').slice(-5);
              return (
                <div key={st.id} style={{ ...card, padding: '14px 18px', background: waiting ? '#F8F7FB' : '#fff', borderColor: running ? 'rgba(106,77,244,.6)' : card.border, boxShadow: running ? '0 0 0 3px rgba(106,77,244,.12)' : card.boxShadow, animation: `lm-up .35s ${Math.min(i, 8) * 40}ms ease both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <img src={mateImg(st.mate)} alt="" width={40} height={40} /><div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14.5 }}>{st.label}</b><div style={{ color: '#6B6572', fontSize: 12.5 }}>{mateName(st.mate)}</div></div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: st.status === 'done' ? '#1E7A46' : running ? '#4F34D6' : failed ? '#B3261E' : '#6B6572' }}>{st.status === 'done' && st.startedAt && st.finishedAt ? `Done · ${mmss(new Date(st.finishedAt).getTime() - new Date(st.startedAt).getTime())}` : running ? `Running · ${mmss(now - new Date(st.startedAt ?? run.createdAt).getTime())}${(st.attempt ?? 1) > 1 ? ` · attempt ${st.attempt}` : ''}` : failed ? 'Failed' : st.status === 'done' ? 'Done' : 'Waiting'}</span>
                  </div>
                  {failed && st.error && <div style={{ marginTop: 10, fontSize: 13, color: '#B3261E', background: '#FDECEA', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>{st.error}{(st.attempt ?? 1) > 1 ? ` (after ${st.attempt} attempts)` : ''}</div>}
                  {running && <>
                    <div style={{ height: 4, background: '#ECE7FF', borderRadius: 2, margin: '12px 0', overflow: 'hidden' }}><div style={{ width: `${Math.max(8, (done / Math.max(1, run.steps.length)) * 100)}%`, height: '100%', background: '#6A4DF4', borderRadius: 2, transition: 'width .6s' }} /></div>
                    <div className="mono" style={{ background: '#15121A', color: '#E9E4F5', borderRadius: 12, padding: 14, fontSize: 12, lineHeight: 1.7, minHeight: 60 }}>{lines.length === 0 ? '…' : lines.map((l, k) => <div key={k}><span style={{ color: '#9D8CFF' }}>{new Date(l.at).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}</span> {l.source} {l.text}</div>)}</div>
                  </>}
                </div>);
            })}
            {run.log.length > 0 && run.steps.length === 0 && <div className="mono" style={{ background: '#15121A', color: '#E9E4F5', borderRadius: 12, padding: 14, fontSize: 12, lineHeight: 1.7 }}>{run.log.map((l, k) => <div key={k}><span style={{ color: '#9D8CFF' }}>{l.source}</span> {l.text}</div>)}</div>}
          </div>
          <form onSubmit={async (e) => { e.preventDefault(); if (steer.trim()) { await api.runs.steer(run.id, steer.trim()); setSteer(''); toast('Sent to the run'); } }} style={{ display: 'flex', gap: 10, alignItems: 'center', ...card, padding: '8px 8px 8px 16px' }}>
            <input value={steer} onChange={(e) => setSteer(e.target.value)} aria-label="Steer this run" placeholder="Steer this run, e.g. also compare pricing tiers…" style={{ flex: 1, border: 0, outline: 0, fontSize: 14.5, fontFamily: 'inherit', height: 40, background: 'none' }} />
            <button type="submit" aria-label="Send" disabled={!steer.trim()} style={{ width: 40, height: 40, borderRadius: 10, border: 0, background: '#6A4DF4', color: '#fff', opacity: steer.trim() ? 1 : 0.4, display: 'grid', placeItems: 'center' }}><Icon name="up" size={18} /></button>
          </form>
        </div>

        <div style={{ width: 'min(460px,38%)', flex: 'none', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          {pending && (
            <div style={{ background: '#F4F0FF', border: '1px solid rgba(106,77,244,.4)', borderRadius: 16, padding: 14, display: 'flex', gap: 12, alignItems: 'center', animation: 'lm-pop .4s cubic-bezier(.34,1.56,.64,1) both' }}>
              <img src={mateImg(pending.mate)} alt="" width={36} height={36} /><div style={{ flex: 1 }}><b style={{ fontSize: 14 }}>Approval needed</b><div style={{ fontSize: 12.5, color: '#3D3946' }}>{pending.text} <span className="mono">{pending.paths.join(', ')}</span></div></div>
              <Btn small onClick={() => api.runs.decide(run.id, pending.id, 'denied')}>Deny</Btn><Btn small variant="primary" onClick={() => api.runs.decide(run.id, pending.id, 'approved')}>Approve</Btn>
            </div>)}
          <div style={{ ...card, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px 0' }}><Tabs value={tab} onChange={setTab} options={[{ id: 'report', label: 'Report' }, { id: 'log', label: 'Log' }, { id: 'sources', label: 'Sources' }, { id: 'files', label: 'Files' }, { id: 'notes', label: 'Notes' }]} /></div>
            <div key={tab} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 18, animation: 'lm-up .3s ease both' }}>
              {tab === 'report' && (run.report ? <Markdown text={run.report} /> : <p style={{ color: '#6B6572', margin: 0, lineHeight: 1.6 }}>The report appears here as the run writes it.</p>)}
              {tab === 'log' && (run.log.length === 0 ? <p style={{ color: '#6B6572', margin: 0 }}>Nothing logged yet.</p> : <div className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>{run.log.map((l, k) => <div key={k} style={{ marginBottom: 6 }}><span style={{ color: '#9D8EC2' }}>{new Date(l.at).toLocaleTimeString()} {l.source}</span> {l.text}</div>)}</div>)}
              {tab === 'sources' && (run.sources.length === 0 ? <p style={{ color: '#6B6572', margin: 0 }}>No sources saved yet.</p> : run.sources.map((s, i) => <div key={s} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(31,26,23,.07)', fontSize: 13.5 }}><span className="mono" style={{ color: '#4F34D6' }}>{String(i + 1).padStart(2, '0')}</span><span style={{ wordBreak: 'break-all' }}>{s}</span></div>))}
              {tab === 'files' && (outputs.length === 0 ? <p style={{ color: '#6B6572', margin: 0 }}>No files for this run yet.</p> : outputs.map((f) => <div key={f.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(31,26,23,.07)', fontSize: 13.5 }}><a href="#" onClick={(e) => { e.preventDefault(); api.files.download(f.id, f.name).catch((err: Error) => toast(err.message)); }} style={{ flex: 1 }}>{f.name}</a><span style={{ color: '#6B6572' }}>{bytes(f.size)}</span></div>))}
              {tab === 'notes' && <textarea key={run.id} defaultValue={run.notes} placeholder="Your notes on this run…" onBlur={(e) => e.target.value !== run.notes && api.runs.update(run.id, { notes: e.target.value })} style={{ width: '100%', height: '100%', minHeight: 200, border: 0, outline: 0, resize: 'none', font: 'inherit', fontSize: 14, lineHeight: 1.6 }} />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn style={{ flex: 1 }} onClick={saveKnowledge} disabled={!run.report}>Save to Knowledge</Btn>
            <Btn style={{ flex: 1 }} onClick={saveWorkflow} disabled={run.steps.length === 0}>Save as workflow</Btn>
          </div>
        </div>
      </div>
    </Page>
  );
}
