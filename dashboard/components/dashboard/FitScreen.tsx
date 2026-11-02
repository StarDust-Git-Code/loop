'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import s from './dashboard.module.css';

const W = 1528;
const H = 1000;

/**
 * A screen ported from the design files. The markup is static (generated from the .dc.html design),
 * scaled to fit the available width; `links` wires buttons (matched by their text) to other screens.
 */
export function FitScreen({ html, links = {} }: { html: string; links?: Record<string, string> }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const o = outer.current!;
    const i = inner.current!;
    const fit = () => {
      const k = Math.max(0.55, o.clientWidth / W);
      i.style.transform = `scale(${k})`;
      o.style.height = `${H * k}px`;
      i.style.marginRight = `${-(W - W * k)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(o);
    // mark wired controls so they show a pointer
    i.querySelectorAll<HTMLElement>('a, button').forEach((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (links[t]) el.setAttribute('data-go', links[t]);
    });
    return () => ro.disconnect();
  }, [html, links]);

  return (
    <div ref={outer} className={s.screen}>
      <div
        ref={inner}
        className={s.screenInner}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(e) => {
          const t = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
          if (t) router.push(t.getAttribute('data-go')!);
        }}
      />
    </div>
  );
}
