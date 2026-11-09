import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { AuthProvider } from '../lib/auth';
import { AuthGate } from '../components/auth/SignIn';
import { TopNav } from '../components/shell/TopNav';
import { ServerGate } from '../components/shell/ServerGate';
import { AgentsSync } from '../lib/agents';
import s from '../components/dashboard/dashboard.module.css';
import { CommandPalette } from '../components/ui/CommandPalette';
import { ToastProvider } from '../components/ui/toast';
import './tokens.css';
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
        <div className="lm-blur" aria-hidden="true"><i /><i /><i /></div>
        <div className={s.shell}>
          <TopNav />
          <div className={s.content}><ServerGate><AgentsSync />{children}</ServerGate></div>
        </div>
        </ToastProvider>
        </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
