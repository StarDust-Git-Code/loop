import type { Metadata } from 'next';
import s from '../../components/dashboard/dashboard.module.css';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return (
    <div className={s.placeholder}>
      <span className={s.note}>Not designed yet</span>
      <h1>Settings</h1>
      <p>Workspace, model, permissions, notifications and billing settings will live here.</p>
      <p>This screen was not part of the first design round, so it is a placeholder.</p>
    </div>
  );
}
