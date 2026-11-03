'use client';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { MATES } from '../../lib/mates';
import type { MateKey } from '../../lib/types';
import { Mate } from './Mate';
import s from './dashboard.module.css';

export function SavedWorkflows() {
  const { items, loading } = useRepo(api.workflows);
  const shown = items.slice(0, 3);
  return (
    <section className={s.workflows} aria-labelledby="saved-workflows">
      <div className={s.cardHead}>
        <h2 id="saved-workflows" className={s.h2}>Saved workflows</h2>
        <Link href="/workflows" className={s.viewAll}>{items.length ? 'View all' : 'Create one'}</Link>
      </div>
      {!loading && shown.length === 0 ? (
        <p className={s.workflowSub}>No workflows yet. Build one in Studio and it will show up here.</p>
      ) : (
        <ul className={s.workflowGrid}>
          {shown.map((w) => {
            const mates = [...new Set(w.nodes.filter((n) => n.mate).map((n) => n.mate as MateKey))];
            return (
              <li key={w.id} className={s.workflowItem}>
                <Link href={`/studio?id=${w.id}`} className={`${s.card} ${s.workflowCard}`}>
                  <span className={s.stack} aria-hidden="true">
                    {mates.slice(0, 4).map((m) => <Mate key={m} mate={m} size={38} className={s.stackItem} />)}
                  </span>
                  <span className={s.workflowTitle}>{w.name}</span>
                  <span className={s.workflowSub}>{w.description || 'No description'}</span>
                  <span className={s.meta}>{mates.map((m) => MATES[m].name).join(' > ') || 'Empty workflow'}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
