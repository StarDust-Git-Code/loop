import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads a list once, supports pull to refresh, and keeps the last good data when a refresh fails. */
export function useList<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  const fn = useRef(load); fn.current = load;
  const run = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    try { const d = await fn.current(); if (alive.current) { setData(d); setError(null); } }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { if (alive.current) { setLoading(false); setRefreshing(false); } }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { alive.current = true; void run(); return () => { alive.current = false; }; }, deps);
  return { data, setData, error, loading, refreshing, refresh: () => run(true), reload: () => run(false) };
}
export const ago = (iso?: string) => {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'now'; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
};
