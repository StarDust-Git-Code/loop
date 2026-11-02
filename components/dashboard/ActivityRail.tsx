import { RECENT_RUNS, RUN_STEPS, RUN_TITLE } from '../../lib/dashboard/data';
import { ApprovalCard } from './ApprovalCard';
import { Mate } from './Mate';
import s from './dashboard.module.css';

const STATUS_CLASS = {
  Done: s.done,
  Running: s.running,
  Waiting: s.waiting,
  Failed: s.failed,
} as const;

function RunningNow() {
  const current = RUN_STEPS.findIndex((st) => st.status === 'Running') + 1;
  return (
    <section className={`${s.card} ${s.railCard}`} aria-labelledby="running-now">
      <div className={s.cardHead}>
        <h2 id="running-now" className={s.h2}>
          Running now
        </h2>
        <span className={s.pill}>
          Step {current} of {RUN_STEPS.length}
        </span>
      </div>
      <div className={s.runTitle}>{RUN_TITLE}</div>
      <ol className={s.steps}>
        {RUN_STEPS.map((st) => (
          <li key={st.label} className={s.step}>
            <Mate mate={st.mate} size={28} />
            <span className={`${s.stepLabel} ${st.status === 'Waiting' ? s.waiting : ''}`}>{st.label}</span>
            <span className={`${s.status} ${STATUS_CLASS[st.status]}`}>{st.status}</span>
          </li>
        ))}
      </ol>
      <a href="#" className={s.secondaryBtn}>
        Open live run
      </a>
    </section>
  );
}

function RecentRuns() {
  return (
    <section className={`${s.card} ${s.railCard} ${s.recent}`} aria-labelledby="recent-runs">
      <h2 id="recent-runs" className={`${s.h2} ${s.recentTitle}`}>
        Recent runs
      </h2>
      <ul className={s.runList}>
        {RECENT_RUNS.map((r) => (
          <li key={r.title}>
            <a href="#" className={s.runRow}>
              <Mate mate={r.mate} size={30} />
              <span className={s.runText}>
                <span className={s.runName}>{r.title}</span>
                <span className={s.runMeta}>{r.meta}</span>
              </span>
              <span className={`${s.status} ${STATUS_CLASS[r.status]}`}>{r.status}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ActivityRail() {
  return (
    <aside aria-label="Activity" className={s.rail}>
      <RunningNow />
      <ApprovalCard />
      <RecentRuns />
    </aside>
  );
}

