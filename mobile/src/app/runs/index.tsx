import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Avatar, Btn, Empty, ErrorNote } from '../../components/ui';
import { Field, Pill, Row, Screen, Sheet } from '../../components/kit';
import { api } from '../../lib/api';
import { ago, useList } from '../../lib/hooks';
import { C } from '../../lib/theme';
import type { Run } from '../../lib/types';

export const RUN_LABEL: Record<Run['status'], string> = { queued: 'Queued', running: 'Running', waiting_approval: 'Needs approval', done: 'Done', failed: 'Failed', stopped: 'Stopped' };
export const RUN_TONE = { queued: 'warn', running: 'live', waiting_approval: 'warn', done: 'ok', failed: 'bad', stopped: 'warn' } as const;

export default function Runs() {
  const router = useRouter();
  const runs = useList(() => api.runs.list(), [], 'runs');
  const [open, setOpen] = useState(false); const [prompt, setPrompt] = useState(''); const [ask, setAsk] = useState(true); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const start = async () => {
    setBusy(true); setErr(null);
    try { const r = await api.runs.start(prompt.trim(), ask); setOpen(false); setPrompt(''); router.push(`/runs/${r.id}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not start the run'); } finally { setBusy(false); }
  };
  const list = [...(runs.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Screen title="Runs" sub="Tasks your Mates work on for you" right={<Btn icon="plus" small onPress={() => setOpen(true)} />}>
      <ErrorNote message={runs.error} onRetry={runs.reload} />
      {runs.loading ? <Empty text="Loading…" /> : list.length === 0 ? <Empty text="No runs yet. Tap + and describe a task." /> : list.map((r, i) => (
        <Animated.View key={r.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).springify().damping(16)} layout={LinearTransition}>
          <Row onPress={() => router.push(`/runs/${r.id}`)}>
            <View style={{ flexDirection: 'row' }}>{(r.steps.length ? r.steps.slice(0, 3).map((s) => s.mate) : ['planner' as const]).map((m, k) => <View key={k} style={{ marginLeft: k ? -10 : 0 }}><Avatar k={m} size={32} /></View>)}</View>
            <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '800', color: C.ink }}>{r.title}</Text><Text style={{ fontSize: 12.5, color: C.muted }}>{ago(r.createdAt)} · {r.steps.length} steps</Text></View>
            <Pill label={RUN_LABEL[r.status]} tone={RUN_TONE[r.status]} />
          </Row>
        </Animated.View>))}
      <Sheet visible={open} onClose={() => setOpen(false)} title="New run" onSave={start} saveLabel="Start run" busy={busy} canSave={prompt.trim().length > 3}>
        <Field label="What should the Mates do?" value={prompt} onChangeText={setPrompt} multiline placeholder="e.g. Research the best battery for my demo and draft a shopping list" />
        <Row onPress={() => setAsk(!ask)}><Text style={{ flex: 1, color: C.ink, fontSize: 14.5 }}>Ask me before making changes</Text><Pill label={ask ? 'On' : 'Off'} tone={ask ? 'ok' : 'warn'} /></Row>
        {err ? <ErrorNote message={err} /> : null}
      </Sheet>
    </Screen>
  );
}
