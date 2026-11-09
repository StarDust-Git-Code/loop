'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession, useSettings } from '../../lib/hooks';
import { useServer } from '../../lib/server';
import s from './shell.module.css';

/** The four places people go every day. Everything else sits under More. */
const MAIN = [
  { href: '/', label: 'Home' },
  { href: '/chat', label: 'Chats' },
  { href: '/run', label: 'Runs' },
  { href: '/schedule', label: 'Schedule' },
];
const MORE = [
  { href: '/call', label: 'Call', note: 'talk to a Mate' },
  { href: '/agents', label: 'Agents', note: 'roles and tools' },
  { href: '/company', label: 'Company', note: 'people, work, check-ins' },
  { href: '/workflows', label: 'Workflows', note: 'saved chains' },
  { href: '/automations', label: 'Automations', note: 'triggers' },
  { href: '/tasks', label: 'Tasks', note: '' },
  { href: '/my-space', label: 'My Space', note: 'journal, plan' },
  { href: '/memory', label: 'Memory', note: 'shared, personal, graph' },
  { href: '/knowledge', label: 'Knowledge', note: 'sources' },
  { href: '/files', label: 'Files', note: '' },
  { href: '/skills', label: 'Skills & MCP', note: '' },
  { href: '/connections', label: 'Connections', note: 'Telegram, Drive…' },
  { href: '/server', label: 'Server', note: 'status, pairing' },
];
// Screens reached from a main item keep that item highlighted.
const PARENT: Record<string, string> = { '/studio': '/run' };
const isMain = (path: string, href: string) => (href === '/' ? path === '/' : (PARENT[path] ?? path).startsWith(href));
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const LABEL = { online: 'Server online', offline: 'Server offline', checking: 'Checking server…', local: 'Demo mode, no server', unpaired: 'Server not paired' } as const;

export function TopNav() {
  const path = usePathname();
  const session = useSession();
  const { settings } = useSettings();
  const server = useServer();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const name = session?.name || settings?.displayName || 'You';
  const inMore = MORE.some((m) => path.startsWith(m.href));

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const seenAt = server.lastSeen ?? (server.lastSeenDoc ? Date.parse(server.lastSeenDoc) : null);
  const seen = seenAt ? `${new Date(seenAt).toDateString() === new Date().toDateString() ? '' : `${new Date(seenAt).toLocaleDateString()} `}${clock(seenAt)}` : '';
  const lamp = server.status === 'online' ? s.on : server.status === 'offline' ? s.off : '';

  return (
    <>
      <header className={`${s.bar} ${scrolled ? s.scrolled : ''}`}>
        <div className={s.inner}>
          <Link href="/" className={s.brand}><span className={s.brandDot} aria-hidden="true" />loopmates</Link>
          <nav aria-label="Main" className={s.nav}>
            {MAIN.map((m) => {
              const a = isMain(path, m.href);
              return <Link key={m.href} href={m.href} className={`${s.link} ${a ? s.active : ''}`} aria-current={a ? 'page' : undefined}>{m.label}</Link>;
            })}
            <div className={s.moreWrap} ref={wrap}>
              <button type="button" className={`${s.link} ${inMore ? s.active : ''}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>More ▾</button>
              {open && (
                <div className={s.menu} role="menu">
                  {MORE.map((m) => (
                    <Link key={m.href} href={m.href} role="menuitem" onClick={() => setOpen(false)} aria-current={path.startsWith(m.href) ? 'page' : undefined}>
                      {m.label}{m.note && <small>{m.note}</small>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
          <div className={s.right}>
            <Link href="/server" className={s.status} title={server.lastSeen ? `Last answered at ${clock(server.lastSeen)}` : undefined}>
              <span className={`${s.lamp} ${lamp}`} aria-hidden="true" /><span className={s.statusText}>{LABEL[server.status]}</span>
            </Link>
            <button type="button" className={s.kbd} onClick={() => window.dispatchEvent(new Event('lm:palette'))} aria-label="Open command palette">⌘K</button>
            <Link href="/settings" className={s.avatar} aria-label="Account and settings">{name[0]?.toUpperCase()}</Link>
          </div>
        </div>
      </header>
      {server.status === 'offline' && (
        <div className={s.offline} role="status">
          <span>Your Loopmates server is offline{seen ? `. Last seen ${seen}` : ''}. Start it on your computer (Start menu → Start Loopmates), then retry.</span>
          <button type="button" onClick={server.retry}>Retry</button>
        </div>
      )}
    </>
  );
}
