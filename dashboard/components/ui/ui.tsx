'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { MATES, mateImg } from '../../lib/mates';
import type { MateKey } from '../../lib/types';
import u from './ui.module.css';

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

export function Page({ title, sub, crumb, actions, children, fill }: { title: ReactNode; sub?: string; crumb?: ReactNode; actions?: ReactNode; children: ReactNode; fill?: boolean }) {
  return (
    <main className={cx(u.page, fill && u.fill)}>
      {!api.capabilities.backend && (
        <div className={u.banner} role="status">
          <b>Backend not connected.</b> Your data is saved in this browser only, and nothing runs yet.
        </div>
      )}
      <header className={u.head}>
        <div>{crumb && <div className={u.crumb}>{crumb}</div>}<h1>{title}</h1>{sub && <p>{sub}</p>}</div>
        <div className={u.grow} />
        {actions && <div className={u.actions}>{actions}</div>}
      </header>
      {children}
    </main>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger'; small?: boolean; href?: string };
export function Btn({ variant, small, href, className, ...p }: BtnProps) {
  const c = cx(u.btn, variant === 'primary' && u.primary, variant === 'danger' && u.danger, small && u.sm, className);
  return href ? <Link href={href} className={c}>{p.children}</Link> : <button type="button" {...p} className={c} />;
}

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => <section className={cx(u.card, className)}>{children}</section>;
export const Grid = ({ children }: { children: ReactNode }) => <div className={u.grid}>{children}</div>;
export const List = ({ children }: { children: ReactNode }) => <div className={u.list}>{children}</div>;

export function Item({ lead, title, sub, right, onClick }: { lead?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  return (
    <div className={u.item} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {lead}
      <div className={u.itemMain}><b className={u.truncate}>{title}</b>{sub && <p className={cx(u.sub, u.truncate)}>{sub}</p>}</div>
      {right}
    </div>
  );
}

export function Empty({ title, text, action, mate = 'mimo' }: { title: string; text: string; action?: ReactNode; mate?: MateKey }) {
  return (
    <div className={u.empty}>
      { }
      <img src={mateImg(mate)} alt="" />
      <h3>{title}</h3><p>{text}</p>{action}
    </div>
  );
}

export const Badge = ({ children, tone }: { children: ReactNode; tone?: 'ok' | 'bad' | 'live' }) => <span className={cx(u.badge, tone && u[tone])}>{children}</span>;
export const ErrorNote = ({ message }: { message: string | null }) => (message ? <div className={cx(u.banner, u.err)} role="alert">{message}</div> : null);
export const Loading = () => <p className={u.sub} role="status">Loading…</p>;

export function MateAvatar({ mate, size = 32 }: { mate: MateKey; size?: number }) {
   
  return <img className={u.avatar} src={mateImg(mate)} width={size} height={size} alt={`${MATES[mate].name} Mate`} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={u.toggle} onClick={() => onChange(!checked)} />;
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const place = () => {
      const el = wrap.current?.querySelector<HTMLElement>('[aria-selected=true]');
      if (!el || !bar.current) return;
      bar.current.style.width = `${el.offsetWidth}px`;
      bar.current.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    place();
    const ro = new ResizeObserver(place);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, options.length]);
  return (
    <div className={u.tabs} role="tablist" ref={wrap}>
      <span ref={bar} className={u.tabBar} aria-hidden="true" />
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === value} className={cx(u.tab, o.id === value && u.tabOn)} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className={u.field}>{label}{children}</label>;
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(u.input, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(u.textarea, p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(u.select, p.className)} />;

export function Chips<T extends string>({ options, value, onChange }: { options: T[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className={u.chips}>
      {options.map((o) => {
        const on = value.includes(o);
        return <button key={o} type="button" aria-pressed={on} className={cx(u.chipBtn, on && u.chipOn)} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>{o}</button>;
      })}
    </div>
  );
}

export function Modal({ title, onClose, onSubmit, submitLabel = 'Save', canSubmit = true, bg, children }: {
  /** Optional background for the whole sheet (e.g. a Mate's colour). */ bg?: string; title: string; onClose: () => void; onSubmit: () => void | Promise<void>; submitLabel?: string; canSubmit?: boolean; children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className={cx(u.overlay, u.sheetWrap)} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form ref={ref} className={cx(u.modal, u.sheet)} style={bg ? { background: bg } : undefined} role="dialog" aria-modal="true" aria-labelledby={id} onSubmit={(e) => { e.preventDefault(); if (canSubmit) void onSubmit(); }}>
        <h2 id={id}>{title}</h2>
        <div className={u.stack}>{children}</div>
        <div className={u.modalFoot}>
          <Btn onClick={onClose}>Cancel</Btn>
          <button type="submit" className={cx(u.btn, u.primary)} disabled={!canSubmit}>{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

export function confirmThen(message: string, fn: () => void) { if (window.confirm(message)) fn(); }

export function Pill({ children, tone }: { children: ReactNode; tone?: 'ok' | 'bad' | 'live' | 'warn' | 'violet' }) {
  const c = { ok: ['#E6F5EC', '#1E7A46'], bad: ['#FDECEB', '#B3261E'], live: ['#ECE7FF', '#4F34D6'], violet: ['#ECE7FF', '#4F34D6'], warn: ['#FFF1D6', '#8A5A00'] }[tone ?? 'live'];
  return <span style={{ fontSize: 12, fontWeight: 600, color: c[1], background: c[0], borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{children}</span>;
}

export function MateTile({ mate, size = 44, tint = true }: { mate: MateKey; size?: number; tint?: boolean }) {
   
  return <span style={{ width: size, height: size, borderRadius: size * 0.3, background: tint ? MATES[mate].tint : 'transparent', display: 'grid', placeItems: 'center', flex: 'none' }}><img src={mateImg(mate)} alt="" width={size * 0.82} height={size * 0.82} /></span>;
}
