import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Avatar, Btn, Empty, ErrorNote } from '../components/ui';
import { Pill, Row, Screen } from '../components/kit';
import { api } from '../lib/api';
import { useList } from '../lib/hooks';
import { C } from '../lib/theme';

/** Workflows are designed on the web canvas. Here you can see them, run one, or delete it. */
export default function Workflows() {
  const router = useRouter();
  const w = useList(() => api.workflows.list(), [], 'workflows');
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const run = async (id: string, name: string, description: string, steps: string) => {
    setBusy(id); setErr(null);
    try { const r = await api.runs.start(`Run the workflow "${name}". ${description}\nSteps: ${steps}`, true); router.push(`/runs/${r.id}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not start'); } finally { setBusy(null); }
  };
  return (
    <Screen title="Workflows" sub="Design them on the web, run them here">
      <ErrorNote message={err ?? w.error} onRetry={w.reload} />
      {w.loading ? <Empty text="Loading…" /> : (w.data ?? []).length === 0 ? <Empty text="No workflows yet. Build one on the dashboard canvas and it shows up here." /> : (w.data ?? []).map((x, i) => {
        const mates = x.nodes.filter((n) => n.mate).map((n) => n.mate!);
        return (
          <Animated.View key={x.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(260)} layout={LinearTransition}>
            <Row>
              <View style={{ flexDirection: 'row' }}>{(mates.length ? mates.slice(0, 3) : ['planner' as const]).map((m, k) => <View key={k} style={{ marginLeft: k ? -10 : 0 }}><Avatar k={m} size={32} /></View>)}</View>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{x.name}</Text><Text numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{x.nodes.length} steps{x.description ? ` · ${x.description}` : ''}</Text></View>
              {x.state ? <Pill label={x.state} tone="muted" /> : null}
              <Btn label="Run" small kind="soft" busy={busy === x.id} onPress={() => run(x.id, x.name, x.description, x.nodes.map((n) => n.label).join(' → '))} />
            </Row>
          </Animated.View>);
      })}
    </Screen>
  );
}
