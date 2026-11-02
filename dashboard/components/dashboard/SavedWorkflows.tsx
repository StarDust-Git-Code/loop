import Link from 'next/link';
import { SAVED_WORKFLOWS } from '../../lib/dashboard/data';
import { Mate } from './Mate';
import s from './dashboard.module.css';

export function SavedWorkflows() {
  return (
    <section className={s.workflows} aria-labelledby="saved-workflows">
      <div className={s.cardHead}>
        <h2 id="saved-workflows" className={s.h2}>
          Saved workflows
        </h2>
        <Link href="/workflows" className={s.viewAll}>
          View all
        </Link>
      </div>
      <ul className={s.workflowGrid}>
        {SAVED_WORKFLOWS.map((w) => (
          <li key={w.title} className={s.workflowItem}>
            <Link href="/studio" className={`${s.card} ${s.workflowCard}`}>
              <span className={s.stack} aria-hidden="true">
                {w.mates.map((m) => (
                  <Mate key={m} mate={m} size={38} className={s.stackItem} />
                ))}
              </span>
              <span className={s.workflowTitle}>{w.title}</span>
              <span className={s.workflowSub}>{w.sub}</span>
              <span className={s.meta}>{w.meta}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
