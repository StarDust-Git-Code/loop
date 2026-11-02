'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { MATE_DEFS } from '../../lib/mates';
import { mateImg } from '../../lib/mates';
import u from './ui.module.css';

type Cmd = { id: string; label: string; hint: string; img?: string; run: () => void };

const PAGES: [string, string][] = [['Home', '/'], ['My Space', '/my-space'], ['Chat', '/chat'], ['Agents', '/agents'], ['Workflows', '/workflows'], ['Knowledge', '/knowledge'], ['Files', '/files'], ['Tasks', '/tasks'], ['Skills & MCP', '/skills'], ['Connections', '/connections'], ['Automations', '/automations'], ['Schedule', '/schedule'], ['Runs', '/run'], ['Settings', '/settings']];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const runs = useRepo(api.runs);

  useEffect(() => {
    const toggle = () => { setOpen((o) => !o); setQ(''); setI(0); };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); } if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', key); window.addEventListener('lm:palette', toggle);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('lm:palette', toggle); };
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const all: Cmd[] = useMemo(() => [
    { id: 'new-task', label: 'New task', hint: 'Action', run: () => router.push('/tasks?new=1') },
    { id: 'new-chat', label: 'New chat', hint: 'Action', run: () => router.push('/chat?new=1') },
    { id: 'new-wf', label: 'New workflow', hint: 'Action', run: () => router.push('/workflows?id=new') },
    ...PAGES.map(([l, h]) => ({ id: h, label: l, hint: 'Go to', run: () => router.push(h) })),
    ...MATE_DEFS.map((m) => ({ id: `m-${m.key}`, label: `${m.name} Mate`, hint: 'Agent', img: mateImg(m.key), run: () => router.push(`/agents?mate=${m.key}`) })),
    ...runs.items.slice(0, 6).map((r) => ({ id: r.id, label: r.title, hint: 'Run', run: () => router.push(`/run?id=${r.id}`) })),
  ], [router, runs.items]);
  const shown = all.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())).slice(0, 9);
  const go = (c?: Cmd) => { if (c) { setOpen(false); c.run(); } };

  if (!open) return null;
  return (
    <div className={u.overlay} style={{ alignItems: 'start', paddingTop: '14vh' }} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className={u.modal} style={{ padding: 0, width: 'min(560px,100%)', animation: 'lm-pop .25s cubic-bezier(.22,1,.36,1) both' }} role="dialog" aria-label="Command palette">
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="Jump to a page, Mate or run…" aria-label="Command"
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, shown.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); } if (e.key === 'Enter') go(shown[i]); }}
          style={{ width: '100%', border: 0, borderBottom: '1px solid var(--line-soft)', padding: '18px 20px', font: 'inherit', fontSize: 16, outline: 0, borderRadius: '18px 18px 0 0' }} />
        <div style={{ padding: 8, maxHeight: 380, overflow: 'auto' }}>
          {shown.length === 0 && <p style={{ padding: 14, color: 'var(--muted)', margin: 0 }}>Nothing matches.</p>}
          {shown.map((c, n) => (
            <button key={c.id} type="button" onMouseEnter={() => setI(n)} onClick={() => go(c)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '9px 12px', border: 0, borderRadius: 10, background: n === i ? '#f1eeff' : 'transparent', textAlign: 'left', font: 'inherit', fontSize: 14, color: 'inherit' }}>
              { }
              {c.img ? <img src={c.img} alt="" width={22} height={22} /> : <span style={{ width: 22 }} />}
              <span style={{ flex: 1 }}>{c.label}</span><span style={{ color: 'var(--muted)', fontSize: 12 }}>{c.hint}</span>
            </button>))}
        </div>
      </div>
    </div>
  );
}
