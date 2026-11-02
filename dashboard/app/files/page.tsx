import type { Metadata } from 'next';
import s from '../../components/dashboard/dashboard.module.css';

export const metadata: Metadata = { title: 'Files' };

export default function Page() {
  return (
    <div className={s.placeholder}>
      <span className={s.note}>Not designed yet</span>
      <h1>Files</h1>
      <p>Files your Mates create and read will live here: reports, sources, tables and scripts, with versions and where each one came from.</p>
      <p>This screen was not part of the first design round, so it is a placeholder.</p>
    </div>
  );
}
