import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Avatar, Btn, Caption, Card, Chip, ErrorNote } from '../../components/ui';
import { Field, Screen } from '../../components/kit';
import { api } from '../../lib/api';
import { useList } from '../../lib/hooks';
import { MATES, mateName, type MateKey } from '../../lib/mates';
import { C } from '../../lib/theme';
import type { MateConfig } from '../../lib/types';

const LEVELS = ['default', 'low', 'medium', 'high', 'xhigh'];
/** Per-agent settings: on or off, reasoning level, extra instructions, and which tools it may use. */
export default function AgentSettings() {
  const { key } = useLocalSearchParams<{ key: string }>(); const def = MATES[key as MateKey];
  const cfgs = useList(() => api.mates.list(), [], 'mates');
  const cfg = (cfgs.data ?? []).find((m) => m.mate === key);
  const [draft, setDraft] = useState<MateConfig | null>(null); const [saved, setSaved] = useState(false); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (cfg && !draft) setDraft(cfg); }, [cfg, draft]);
  const set = (b: Partial<MateConfig>) => { setSaved(false); setDraft((d) => d && { ...d, ...b }); };
  const save = async () => {
    if (!draft) return; setBusy(true); setErr(null);
    try { await api.mates.patch(draft.id, { enabled: draft.enabled, thinking: draft.thinking, instructions: draft.instructions ?? '', tools: draft.tools, model: draft.model ?? '' }); setSaved(true); cfgs.reload(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  const tools = draft?.tools ?? [];
  return (
    <Screen title={mateName(key)} sub={def?.blurb}>
      <ErrorNote message={err ?? cfgs.error} onRetry={cfgs.reload} />
      <View style={{ alignItems: 'center' }}><Avatar k={key} size={96} /></View>
      {draft ? (
        <>
          <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, fontWeight: '800', color: C.ink, fontSize: 15 }}>Enabled</Text><Switch value={draft.enabled} onValueChange={(v) => set({ enabled: v })} trackColor={{ true: C.brand, false: '#D5D1DE' }} thumbColor="#fff" /></Card>
          <View style={{ gap: 8 }}><Caption>REASONING</Caption><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{LEVELS.map((l) => <Chip key={l} label={l} on={(draft.thinking ?? 'default') === l} onPress={() => set({ thinking: l })} />)}</View></View>
          <Field label="Extra instructions for this agent" value={draft.instructions ?? ''} onChangeText={(v) => set({ instructions: v })} multiline style={{ minHeight: 140 }} placeholder="Your own rules, added on top of the built-in prompt." />
          <Field label="Model override (optional)" value={draft.model ?? ''} onChangeText={(v) => set({ model: v })} autoCapitalize="none" autoCorrect={false} />
          <View style={{ gap: 8 }}><Caption>TOOLS ({tools.length})</Caption>
            <Card style={{ padding: 12 }}><Text style={{ color: C.ink2, fontSize: 13.5, lineHeight: 20 }}>{tools.length ? tools.join(', ') : 'No extra tools.'}</Text></Card>
            <Text style={{ color: C.muted, fontSize: 12.5 }}>Tools are changed from the web dashboard for now.</Text></View>
          <Btn label={saved ? 'Saved ✓' : 'Save changes'} onPress={save} busy={busy} />
        </>) : cfgs.loading ? <Text style={{ color: C.muted }}>Loading…</Text> : <Text style={{ color: C.muted }}>No settings found for this agent yet. Open the Agents tab once to create them.</Text>}
    </Screen>
  );
}
