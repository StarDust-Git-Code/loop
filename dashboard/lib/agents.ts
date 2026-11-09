'use client';
// The owner's live roster: built-in Mates they have not removed, plus custom agents, and who leads.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { api } from './api';
import { useRepo, useSettings } from './hooks';
import { MATES, MATE_DEFS, agentsVersion, customDefs, registerAgents, subscribeAgents, type MateDef } from './mates';
import type { MateConfigIn, MateKey } from './types';

export function useAgents() {
  const repo = useRepo(api.mateConfigs);
  const { settings, update: updateSettings } = useSettings();
  const { items } = repo;
  useEffect(() => { registerAgents(items); }, [items]);
  useSyncExternalStore(subscribeAgents, agentsVersion, agentsVersion);
  const removedKeys = new Set(items.filter((c) => c.removed).map((c) => c.id));
  const defs: MateDef[] = [...MATE_DEFS.filter((d) => !removedKeys.has(d.key)), ...customDefs().filter((d) => !removedKeys.has(d.key))];
  const leader: MateKey = settings?.leader && defs.some((d) => d.key === settings.leader) ? settings.leader : 'mimo';
  const isOn = useCallback((k: MateKey) => k === leader || (items.find((c) => c.id === k)?.enabled ?? MATES[k].core), [items, leader]);
  return {
    ...repo, defs, leader, isOn,
    removed: items.filter((c) => c.removed),
    makeLeader: (k: MateKey) => updateSettings({ leader: k }),
    createAgent: (input: Partial<MateConfigIn> & { name: string }) => repo.create(input as MateConfigIn),
    restore: async (k: MateKey) => { await api.server.restoreAgent(k); await repo.reload(); },
  };
}

/** Built-ins plus registered custom agents, without fetching (for the command palette). */
export function useAgentDefs(): MateDef[] { const v = useSyncExternalStore(subscribeAgents, agentsVersion, agentsVersion); return useMemo(() => (v >= 0 ? [...MATE_DEFS, ...customDefs()] : []), [v]); }

/** Mounted once in the layout so custom agents have names and avatars on every screen. */
export function AgentsSync() { useAgents(); return null; }
