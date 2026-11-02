import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { AuthProvider } from '../lib/auth';
import { AuthGate } from '../components/auth/SignIn';
import { Sidebar } from '../components/dashboard/Sidebar';
import s from '../components/dashboard/dashboard.module.css';
import { CommandPalette } from '../components/ui/CommandPalette';
import { ToastProvider } from '../components/ui/toast';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://dashboard.loopmates.com'),
  title: { default: 'Loopmates Dashboard', template: '%s · Loopmates' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#ffffff' };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
        <AuthGate>
        <ToastProvider>
        <CommandPalette />
        <div className={s.shell}>
          <Sidebar />
          <div className={s.content}>{children}</div>
        </div>
        </ToastProvider>
        </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
