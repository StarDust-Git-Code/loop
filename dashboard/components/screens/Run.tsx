'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { ago, bytes } from '../../lib/format';
import { useLiveRun, useRepo } from '../../lib/hooks';
import { MATES } from '../../lib/mates';
import type { Run as RunT } from '../../lib/types';
import { Badge, Btn, Card, Empty, ErrorNote, Item, List, Loading, MateAvatar, Page } from '../ui/ui';

const TONE = { done: 'ok', failed: 'bad', running: 'live', waiting_approval: 'live', queued: undefined, stopped: undefined } as const;
const LABEL: Record<RunT['status'], string> = { queued: 'Queued', running: 'Running', waiting_approval: 'Needs approval', done: 'Done', failed: 'Failed', stopped: 'Stopped' };

export function Run() {
  const id = useSearchParams().get('id');
  return id ? <RunView id={id} /> : <RunList />;
}

function RunList() {
  const { items, loading, error, remove } = useRepo(api.runs);
  return (
    <Page title="Runs" sub="Every task you have started, newest first." actions={<Btn variant="primary" href="/">New task</Btn>}>
      <ErrorNote message={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty title="No runs yet" text="Start a task from Home and it will show up here with every step." action={<Btn variant="primary" href="/">Go to Home</Btn>} /> : (
        <List>{items.map((r) => (
          <Link key={r.id} href={`/run?id=${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Item title={r.title} sub={`${ago(r.createdAt)} · ${r.steps.length} steps`} right={<><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
              <Btn small variant="danger" onClick={(e) => { e.preventDefault(); void remove(r.id); }}>Delete</Btn></>} />
          </Link>))}
        </List>
      )}
    </Page>
  );
}

function RunView({ id }: { id: string }) {
  const { run, loading } = useLiveRun(id);
  const { items: files } = useRepo(api.files);
  if (loading) return <Page title="Run"><Loading /></Page>;
  if (!run) return <Page title="Run not found"><Empty title="That run does not exist" text="It may have been deleted." action={<Btn href="/run">All runs</Btn>} /></Page>;
  const live = run.status === 'running' || run.status === 'waiting_approval' || run.status === 'queued';
  const outputs = files.filter((f) => run.fileIds.includes(f.id));
  return (
    <Page title={run.title} sub={`Started ${ago(run.createdAt)}${run.askFirst ? ' · asks before risky actions' : ''}`}
      actions={<><Badge tone={TONE[run.status]}>{LABEL[run.status]}</Badge>{live && <Btn variant="danger" onClick={() => api.runs.control(run.id, 'stop')}>Stop</Btn>}
        <Btn href={`/workflows`} onClick={undefined}>Save as workflow</Btn></>}>
      {run.error && <ErrorNote message={run.error} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card><p style={{ margin: '0 0 6px', fontWeight: 700 }}>Task</p><p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{run.prompt}</p></Card>
          {run.approvals.filter((a) => a.status === 'pending').map((a) => (
            <Card key={a.id}>
              <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{MATES[a.mate].name} Mate needs your approval</p>
              <p style={{ margin: '0 0 10px' }}>{a.text} {a.paths.map((p) => <code key={p}>{p} </code>)}</p>
              <div style={{ display: 'flex', gap: 8 }}><Btn variant="primary" small onClick={() => api.runs.decide(run.id, a.id, 'approved')}>Approve</Btn><Btn small onClick={() => api.runs.decide(run.id, a.id, 'denied')}>Deny</Btn></div>
            </Card>
          ))}
          <Card>
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>Steps</p>
            {run.steps.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)' }}>{api.capabilities.backend ? 'Waiting for the Planner Mate to plan this run.' : 'No steps yet. A backend has to plan and execute this run.'}</p> : (
              <List>{run.steps.map((st) => <Item key={st.id} lead={<MateAvatar mate={st.mate} size={30} />} title={st.label} sub={`${MATES[st.mate].name} Mate`} right={<Badge tone={st.status === 'done' ? 'ok' : st.status === 'failed' ? 'bad' : st.status === 'running' ? 'live' : undefined}>{st.status}</Badge>} />)}</List>
            )}
          </Card>
          <Card>
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>Log</p>
            <div style={{ background: '#15121a', color: '#e9e4f5', borderRadius: 12, padding: 14, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.7, maxHeight: 320, overflow: 'auto' }}>
              {run.log.length === 0 ? '—' : run.log.map((l, i) => <div key={i}><span style={{ color: '#9d8cff' }}>{new Date(l.at).toLocaleTimeString()} {l.source}</span> {l.text}</div>)}
            </div>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card><p style={{ margin: '0 0 8px', fontWeight: 700 }}>Files</p>{outputs.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No files for this run yet.</p> : (
            <List>{outputs.map((f) => <Item key={f.id} title={<a href={api.files.downloadUrl(f.id)}>{f.name}</a>} sub={bytes(f.size)} />)}</List>)}</Card>
          <Card><p style={{ margin: '0 0 8px', fontWeight: 700 }}>Sources</p>{run.sources.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>None saved.</p> : run.sources.map((s) => <p key={s} style={{ margin: '0 0 4px', fontSize: 13, wordBreak: 'break-all' }}>{s}</p>)}
            <Btn small href="/knowledge" >Open Knowledge</Btn></Card>
        </div>
      </div>
    </Page>
  );
}
