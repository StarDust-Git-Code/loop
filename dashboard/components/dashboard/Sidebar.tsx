'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND } from '../../lib/dashboard/brand';
import { GEAR_PATH, NAV } from '../../lib/dashboard/data';
import { api } from '../../lib/api';
import { useRepo, useSession, useSettings } from '../../lib/hooks';
import { MATES } from '../../lib/mates';
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
  const { items: cfgs } = useRepo(api.mateConfigs);
  const { settings } = useSettings();
  const session = useSession();
  const name = session?.name || settings?.displayName || 'Guest';
  const agents = cfgs.filter((c) => c.enabled);

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
              
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className={s.sectionLabel}>AGENTS</div>
      <ul className={s.navList}>
        {agents.map(({ mate: key }) => (
          <li key={key}>
            <Link href={`/agents?mate=${key}`} className={`${s.navItem} ${s.agentItem}`}>
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
          {name[0]?.toUpperCase()}
        </div>
        <div className={s.profileText}>
          <div className={s.profileName}>{name}</div>
          <div className={s.profilePlan}>{session?.signedIn ? (session.plan ?? 'Signed in') : 'Not signed in'}</div>
        </div>
      </div>
    </nav>
  );
}
