import { BRAND } from '../../lib/dashboard/brand';
import { HERO_MATES } from '../../lib/dashboard/data';
import { ActivityRail } from './ActivityRail';
import { Mate } from './Mate';
import { SavedWorkflows } from './SavedWorkflows';
import { TaskComposer } from './TaskComposer';
import s from './dashboard.module.css';

export function HomeScreen() {
  return (
    <main className={s.main}>
      <div className={s.center}>
        <header className={s.topbar}>
          <span className={s.workspace}>Personal workspace</span>
          <div className={s.topActions}>
            <button type="button" aria-label="Search" className={s.iconBtn}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
            </button>
            <button type="button" aria-label="Notifications" className={s.iconBtn}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" />
              </svg>
            </button>
          </div>
        </header>

        <section className={s.hero}>
          <div className={s.heroMates} aria-hidden="true">
            {HERO_MATES.map((m) => (
              <Mate key={m} mate={m} size={76} className={s.heroMate} />
            ))}
          </div>
          <h1 className={s.h1}>What should {BRAND} get done today?</h1>
          <p className={s.lede}>
            Describe the task. {BRAND} plans it, runs it, and shows you every step.
          </p>
        </section>

        <TaskComposer />
        <SavedWorkflows />
      </div>

      <ActivityRail />
    </main>
  );
}

