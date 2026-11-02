'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND } from '../../lib/dashboard/brand';
import { GEAR_PATH, MATES, NAV, SIDEBAR_MATES } from '../../lib/dashboard/data';
import { Icon } from './Icon';
import { Mate } from './Mate';
import { LogoMark } from '../Logo';
import s from './dashboard.module.css';

// Screens that live under another nav item keep that item highlighted.
const PARENT: Record<string, string> = { '/studio': '/workflows', '/run': '/workflows', '/schedule': '/my-space' };

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  if (href === '/') return pathname === href;
  const here = PARENT[pathname] ?? pathname;
  return here === href || here.startsWith(href + '/');
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className={s.sidebar}>
      <div className={s.brand}>
        <LogoMark size={34} />
        <span className={s.brandName} aria-label={BRAND}>
          loop<em>mates</em>
        </span>
      </div>

      <ul className={s.navList}>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const content = (
            <>
              <Icon d={item.d} />
              <span className={s.navLabel}>{item.label}</span>
            </>
          );
          return (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={`${s.navItem} ${active ? s.navActive : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {content}
                </Link>
              ) : (
                // Screen not built yet.
                <a href="#" className={s.navItem}>
                  {content}
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <div className={s.sectionLabel}>AGENTS</div>
      <ul className={s.navList}>
        {SIDEBAR_MATES.map((key) => (
          <li key={key}>
            <Link href="/agents" className={`${s.navItem} ${s.agentItem}`}>
              <Mate mate={key} size={26} />
              <span className={s.navLabel}>{MATES[key].name}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className={s.grow} />

      <Link href="/settings" className={`${s.navItem} ${pathname === '/settings' ? s.navActive : ''}`}>
        <Icon d={GEAR_PATH} />
        <span className={s.navLabel}>Settings</span>
      </Link>
      <div className={s.profile}>
        <div className={s.avatar} aria-hidden="true">
          I
        </div>
        <div className={s.profileText}>
          <div className={s.profileName}>Irshad</div>
          <div className={s.profilePlan}>Personal Plan</div>
        </div>
      </div>
    </nav>
  );
}
