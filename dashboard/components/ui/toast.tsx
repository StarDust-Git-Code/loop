'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { uid } from '../../lib/format';

type T = { id: string; text: string; tone: 'ok' | 'bad' };
const Ctx = createContext<(text: string, tone?: T['tone']) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, tone: T['tone'] = 'ok') => {
    const id = uid();
    setItems((a) => [...a, { id, text, tone }]);
    setTimeout(() => setItems((a) => a.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 80, alignItems: 'center' }}>
        {items.map((t) => (
          <div key={t.id} style={{ background: t.tone === 'ok' ? '#15121a' : '#b3261e', color: '#fff', padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,.25)', animation: 'lm-pop .3s cubic-bezier(.34,1.56,.64,1) both' }}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
