'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { Repo } from './api/contract';
import type { ID, Run, RunEvent, SettingsData } from './types';

export function useRepo<T extends { id: ID }, In>(repo: Repo<T, In>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => repo.list().then((v) => { setItems(v); setError(null); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)), [repo]);
  useEffect(() => { load(); return repo.subscribe(load); }, [repo, load]);
  return { items, loading, error, reload: load, create: repo.create, update: repo.update, remove: repo.remove };
}

export function useItem<T extends { id: ID }, In>(repo: Repo<T, In>, id?: ID | null) {
  const [item, setItem] = useState<T | undefined>();
  const [loading, setLoading] = useState(!!id);
  const load = useCallback(() => (id ? repo.get(id) : Promise.resolve(undefined)).then(setItem).finally(() => setLoading(false)), [repo, id]);
  useEffect(() => { load(); return repo.subscribe(load); }, [repo, load]);
  return { item, loading };
}

function apply(r: Run, e: RunEvent): Run {
  switch (e.type) {
    case 'status': return { ...r, status: e.status };
    case 'step': return { ...r, steps: r.steps.some((s) => s.id === e.step.id) ? r.steps.map((s) => (s.id === e.step.id ? e.step : s)) : [...r.steps, e.step] };
    case 'log': return { ...r, log: [...r.log, e.line] };
    case 'approval': return { ...r, approvals: [...r.approvals.filter((a) => a.id !== e.approval.id), e.approval] };
    case 'file': return { ...r, fileIds: [...r.fileIds, e.fileId] };
  }
}

/** A run kept live: the stored run with streamed events applied on top. Events reset when the stored run reloads. */
export function useLiveRun(id?: ID | null) {
  const { item, loading } = useItem(api.runs, id);
  const [live, setLive] = useState<{ base: Run | undefined; events: RunEvent[] }>({ base: undefined, events: [] });
  const baseRef = useRef<Run | undefined>(undefined);
  useEffect(() => { baseRef.current = item; });
  useEffect(() => {
    if (!id) return;
    return api.runs.stream(id, (e) => setLive((p) => ({ base: baseRef.current, events: p.base === baseRef.current ? [...p.events, e] : [e] })));
  }, [id]);
  const run = item && (live.base === item ? live.events.reduce(apply, item) : item);
  return { run, loading };
}

export function useSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  useEffect(() => { const load = () => api.settings.get().then(setSettings); load(); return api.settings.subscribe(load); }, []);
  return { settings, update: api.settings.update };
}

export function useSession() {
  const [s, setS] = useState<{ signedIn: boolean; name?: string; plan?: string } | null>(null);
  useEffect(() => { api.auth.session().then(setS).catch(() => setS({ signedIn: false })); }, []);
  return s;
}
