'use client';
import { api } from '../../lib/api';
import { useRepo } from '../../lib/hooks';
import { PRESET, PRESETS, modelKey } from '../../lib/providers';
import { Select } from './ui';

/** Grouped by provider. Providers without a key are listed (disabled) so you can see what exists. */
export function ModelPicker({ value, onChange, allowDefault = true }: { value: string; onChange: (v: string) => void; allowDefault?: boolean }) {
  const { items } = useRepo(api.providers);
  const active = items.filter((p) => p.enabled);
  value = value.includes('::') ? value : ''; // old plain model names mean "workspace default"
  const unused = PRESETS.filter((p) => p.id !== 'custom' && !items.some((x) => x.preset === p.id));
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Model">
      {allowDefault ? <option value="">Workspace default</option> : active.length === 0 && <option value="">Set up a provider first</option>}
      {active.map((p) => {
        const ms = p.models.length ? p.models : PRESET[p.preset]?.models ?? [];
        return <optgroup key={p.id} label={p.name}>{ms.map((m) => <option key={m} value={modelKey(p.id, m)}>{m}</option>)}</optgroup>;
      })}
      {value && !active.some((p) => value.startsWith(`${p.id}::`)) && <option value={value}>{value.split('::')[1]} (provider removed)</option>}
      {unused.length > 0 && <optgroup label="Not set up (add a key in Settings)">{unused.slice(0, 8).map((p) => <option key={p.id} value="" disabled>{p.name}</option>)}</optgroup>}
    </Select>
  );
}
