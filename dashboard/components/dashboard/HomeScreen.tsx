'use client';
import { BRAND } from '../../lib/dashboard/brand';
import { useSettings } from '../../lib/hooks';
import { ActivityRail } from './ActivityRail';
import { Mate } from './Mate';
import { SavedWorkflows } from './SavedWorkflows';
import { TaskComposer } from './TaskComposer';
import { api } from '../../lib/api';
import s from './dashboard.module.css';

const HERO = ['planner', 'research', 'code', 'writer', 'browser', 'ops'] as const;

export function HomeScreen() {
  const { settings } = useSettings();
  return (
    <main className={s.main}>
      <div className={s.center}>
        <header className={s.topbar}>
          <span className={s.workspace}>{settings?.workspaceName ?? ''}</span>
          {!api.capabilities.backend && <span className={s.workspace} style={{ color: '#6b5200' }}>Backend not connected: runs are queued only</span>}
        </header>
        <section className={s.hero}>
          <div className={s.heroMates} aria-hidden="true">
            {HERO.map((m) => <Mate key={m} mate={m} size={76} className={s.heroMate} />)}
          </div>
          <h1 className={s.h1}>What should {BRAND} get done today?</h1>
          <p className={s.lede}>Describe the task. {BRAND} plans it, runs it, and shows you every step.</p>
        </section>
        <TaskComposer />
        <SavedWorkflows />
      </div>
      <ActivityRail />
    </main>
  );
}
