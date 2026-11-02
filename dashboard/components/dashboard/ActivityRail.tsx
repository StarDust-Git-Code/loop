'use client';
import Link from 'next/link';
import { api } from '../../lib/api';
import { AGENT } from '../../lib/dashboard/brand';
import { ago } from '../../lib/format';
import { useRepo } from '../../lib/hooks';
import { MATES } from '../../lib/mates';
import type { Run } from '../../lib/types';
import { ApprovalCard } from './ApprovalCard';
import { Mate } from './Mate';
import s from './dashboard.module.css';

const LABEL: Record<Run['status'], string> = { queued: 'Queued', running: 'Running', waiting_approval: 'Waiting', done: 'Done', failed: 'Failed', stopped: 'Stopped' };
const CLS: Record<Run['status'], string> = { queued: s.waiting, running: s.running, waiting_approval: s.waiting, done: s.done, failed: s.failed, stopped: s.waiting };

function RunningNow({ run }: { run: Run }) {
  const idx = run.steps.findIndex((x) => x.status === 'running') + 1;
  return (
    <section className={`${s.card} ${s.railCard}`} aria-labelledby="running-now">
      <div className={s.cardHead}>
        <h2 id="running-now" className={s.h2}>{run.status === 'queued' ? 'Queued' : 'Running now'}</h2>
        {run.steps.length > 0 && <span className={s.pill}>Step {idx || 1} of {run.steps.length}</span>}
      </div>
      <div className={s.runTitle}>{run.title}</div>
      {run.steps.length === 0 ? (
        <p className={s.workflowSub}>Waiting for the Planner {AGENT} to break this into steps.</p>
      ) : (
        <ol className={s.steps}>
          {run.steps.map((st) => (
            <li key={st.id} className={s.step}>
              <Mate mate={st.mate} size={28} />
              <span className={`${s.stepLabel} ${st.status === 'waiting' ? s.waiting : ''}`}>{st.label}</span>
              <span className={`${s.status} ${CLS[st.status === 'waiting' ? 'queued' : st.status === 'running' ? 'running' : st.status === 'done' ? 'done' : 'failed']}`}>{st.status}</span>
            </li>
          ))}
        </ol>
      )}
      <Link href={`/run?id=${run.id}`} className={s.secondaryBtn}>Open live run</Link>
    </section>
  );
}

export function ActivityRail() {
  const { items } = useRepo(api.runs);
  const active = items.find((r) => r.status === 'running' || r.status === 'waiting_approval' || r.status === 'queued');
  const recent = items.filter((r) => r !== active).slice(0, 5);
  return (
    <aside aria-label="Activity" className={s.rail}>
      {active && <RunningNow run={active} />}
      <ApprovalCard />
      <section className={`${s.card} ${s.railCard} ${s.recent}`} aria-labelledby="recent-runs">
        <h2 id="recent-runs" className={`${s.h2} ${s.recentTitle}`}>Recent runs</h2>
        {recent.length === 0 ? (
          <p className={s.workflowSub}>{active ? 'Finished runs will appear here.' : 'No runs yet. Describe a task and press Run.'}</p>
        ) : (
          <ul className={s.runList}>
            {recent.map((r) => {
              const mate = r.steps[0]?.mate ?? 'planner';
              return (
                <li key={r.id}>
                  <Link href={`/run?id=${r.id}`} className={s.runRow}>
                    <Mate mate={mate} size={30} />
                    <span className={s.runText}>
                      <span className={s.runName}>{r.title}</span>
                      <span className={s.runMeta}>{MATES[mate].name} {AGENT} · {ago(r.createdAt)}</span>
                    </span>
                    <span className={`${s.status} ${CLS[r.status]}`}>{LABEL[r.status]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
