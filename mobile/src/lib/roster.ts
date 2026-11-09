// The owner's agents (built-ins they kept, plus custom ones) and the leader. Falls back to the built-ins while loading.
import { useEffect, useState } from 'react';
import { api } from './api';
import { MATE_DEFS, registerRoster, type RosterAgent } from './mates';

let last: { leader: string; agents: RosterAgent[] } | null = null;
const builtins = (): RosterAgent[] => MATE_DEFS.map((d) => ({ key: d.key, name: d.name, blurb: d.blurb, core: d.core, custom: false, avatar: d.key, enabled: d.core }));

export function useRoster() {
  const [r, setR] = useState(last ?? { leader: 'mimo', agents: builtins() });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api.roster().then((x) => { registerRoster(x.agents); last = x; if (live) setR(x); }).catch(() => {});
    return () => { live = false; };
  }, [tick]);
  return { ...r, reload: () => setTick((t) => t + 1) };
}
