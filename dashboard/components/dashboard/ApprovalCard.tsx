'use client';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { AGENT } from '../../lib/dashboard/brand';
import { useRepo } from '../../lib/hooks';
import { MATES } from '../../lib/mates';
import { Mate } from './Mate';
import s from './dashboard.module.css';

/** Oldest pending approval across all runs. Renders nothing when none is waiting. */
export function ApprovalCard() {
  const router = useRouter();
  const { items: runs } = useRepo(api.runs);
  const pending = runs.flatMap((r) => r.approvals.filter((a) => a.status === 'pending').map((a) => ({ run: r, a })))[0];
  if (!pending) return null;
  const { run, a } = pending;
  return (
    <section className={s.approval} aria-labelledby="needs-approval">
      <div className={s.approvalHead}>
        <Mate mate={a.mate} size={32} />
        <h2 id="needs-approval" className={s.h2}>Needs your approval</h2>
      </div>
      <p className={s.approvalText}>
        {MATES[a.mate].name} {AGENT}: {a.text} {a.paths.map((p) => <span key={p} className={s.mono}>{p} </span>)}
      </p>
      <div className={s.approvalActions}>
        <button type="button" className={s.primaryBtn} onClick={() => api.runs.decide(run.id, a.id, 'approved')}>Approve</button>
        <button type="button" className={s.ghostBtn} onClick={() => api.runs.decide(run.id, a.id, 'denied')}>Deny</button>
        <button type="button" className={s.ghostBtn} onClick={() => router.push(`/run?id=${run.id}`)}>Review</button>
      </div>
    </section>
  );
}
