'use client';

import { useRouter } from 'next/navigation';

import { useState } from 'react';
import { AGENT } from '../../lib/dashboard/brand';
import { APPROVAL } from '../../lib/dashboard/data';
import { Mate } from './Mate';
import s from './dashboard.module.css';

export function ApprovalCard() {
  const router = useRouter();
  const [approved, setApproved] = useState(false);

  return (
    <section className={s.approval} aria-labelledby="needs-approval">
      <div className={s.approvalHead}>
        <Mate mate="ops" size={32} />
        <h2 id="needs-approval" className={s.h2}>
          Needs your approval
        </h2>
      </div>
      <p className={s.approvalText}>
        {approved ? (
          <>
            Approved. The Ops {AGENT} is writing the files.
          </>
        ) : (
          <>
            {APPROVAL.text} <span className={s.mono}>{APPROVAL.path}</span>.
          </>
        )}
      </p>
      {!approved && (
        <div className={s.approvalActions}>
          {/* TODO: call the approvals API once the runtime exists. */}
          <button type="button" className={s.primaryBtn} onClick={() => setApproved(true)}>
            Approve
          </button>
          <button type="button" className={s.ghostBtn} onClick={() => router.push('/dashboard/run')}>
            Review files
          </button>
        </div>
      )}
    </section>
  );
}
