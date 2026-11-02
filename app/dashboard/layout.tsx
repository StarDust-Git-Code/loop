import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { Sidebar } from '../../components/dashboard/Sidebar';
import s from '../../components/dashboard/dashboard.module.css';

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s · Dashboard' },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.shell}>
      <Sidebar />
      <div className={s.content}>{children}</div>
    </div>
  );
}
