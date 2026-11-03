import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Markdown } from '../../components/Markdown';
import { Avatar, Btn, Card, Chip, ErrorNote, Icon, Press } from '../../components/ui';
import { Pill, Screen } from '../../components/kit';
import { api } from '../../lib/api';
import { mateName } from '../../lib/mates';
import { C, R } from '../../lib/theme';
import type { Run } from '../../lib/types';
import { RUN_LABEL, RUN_TONE } from './index';

export default function RunView() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter();
  const [run, setRun] = useState<Run | null>(null); const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'steps' | 'report' | 'sources'>('steps'); const [steer, setSteer] = useState('');
  const live = useRef(true);
  const load = async () => { try { setRun(await api.runs.get(id)); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the run'); } };
  useEffect(() => { live.current = true; void load(); const t = setInterval(() => { if (live.current) void load(); }, 3000); return () => { live.current = false; clearInterval(t); }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const act = async (f: () => Promise<unknown>) => { try { await f(); void Haptics.selectionAsync(); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'That did not work'); } };
  const pending = run?.approvals.find((a) => a.status === 'pending');
  const active = run && (run.status === 'running' || run.status === 'waiting_approval');
  return (
    <Screen title={run?.title ?? 'Run'} sub={run ? RUN_LABEL[run.status] : undefined} right={run ? <Pill label={RUN_LABEL[run.status]} tone={RUN_TONE[run.status]} /> : null}>
      <ErrorNote message={err} onRetry={load} />
      {run ? (
        <>
          <Card style={{ padding: 14 }}><Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1, color: C.muted }}>TASK</Text><Text selectable style={{ fontSize: 14.5, lineHeight: 21, color: C.ink, marginTop: 4 }}>{run.prompt}</Text></Card>
          {pending ? (
            <Animated.View entering={FadeInDown.duration(260)} style={{ backgroundColor: C.tint2, borderWidth: 1, borderColor: 'rgba(106,77,244,0.4)', borderRadius: R.lg, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar k={pending.mate} size={36} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: C.ink }}>Approval needed</Text><Text style={{ color: C.ink2, fontSize: 13.5 }}>{pending.text}</Text></View></View>
              {pending.paths.length ? <Text style={{ fontFamily: 'monospace', fontSize: 12, color: C.muted }}>{pending.paths.join('\n')}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10 }}><Btn label="Deny" kind="ghost" style={{ flex: 1 }} onPress={() => act(() => api.runs.decide(run.id, pending.id, 'denied'))} /><Btn label="Approve" style={{ flex: 1 }} onPress={() => act(() => api.runs.decide(run.id, pending.id, 'approved'))} /></View>
            </Animated.View>) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {active ? <Btn label="Pause" kind="soft" small onPress={() => act(() => api.runs.control(run.id, 'pause'))} /> : null}
            {run.status === 'queued' ? <Btn label="Resume" kind="soft" small onPress={() => act(() => api.runs.control(run.id, 'resume'))} /> : null}
            {active || run.status === 'queued' ? <Btn label="Stop" kind="danger" small onPress={() => act(() => api.runs.control(run.id, 'stop'))} /> : null}
            {!active ? <Btn label="Delete" kind="ghost" small onPress={async () => { await act(() => api.runs.remove(run.id)); router.back(); }} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>{(['steps', 'report', 'sources'] as const).map((t) => <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} on={tab === t} onPress={() => setTab(t)} />)}</View>
          {tab === 'steps' ? (
            run.steps.length === 0 ? <Text style={{ color: C.muted }}>The Planner is breaking this down…</Text> : run.steps.map((s) => {
              const lines = run.log.filter((l) => l.source === s.mate).slice(-4);
              return (
                <Card key={s.id} style={{ padding: 14, borderColor: s.status === 'running' ? C.brand : C.line }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar k={s.mate} size={38} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: C.ink, fontSize: 14.5 }}>{s.label}</Text><Text style={{ color: C.muted, fontSize: 12.5 }}>{mateName(s.mate)}</Text></View>
                    <Pill label={s.status === 'done' ? 'Done' : s.status === 'running' ? 'Working' : s.status === 'failed' ? 'Failed' : 'Waiting'} tone={s.status === 'done' ? 'ok' : s.status === 'running' ? 'live' : s.status === 'failed' ? 'bad' : 'muted'} /></View>
                  {s.status === 'running' && lines.length ? <View style={{ backgroundColor: '#15121A', borderRadius: 12, padding: 12, marginTop: 10 }}>{lines.map((l, i) => <Text key={i} style={{ fontFamily: 'monospace', fontSize: 12, color: '#E9E4F5', lineHeight: 18 }}>{l.text}</Text>)}</View> : null}
                </Card>);
            })) : null}
          {tab === 'report' ? (run.report ? <Card style={{ padding: 14 }}><Markdown text={run.report} /></Card> : <Text style={{ color: C.muted }}>The report appears here as the run writes it.</Text>) : null}
          {tab === 'sources' ? (run.sources.length ? run.sources.map((s) => <Text key={s} selectable style={{ color: C.brandDeep, fontSize: 13.5 }}>{s}</Text>) : <Text style={{ color: C.muted }}>No sources saved yet.</Text>) : null}
          {run.error ? <ErrorNote message={run.error} /> : null}
          {active ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line2, borderRadius: 18, padding: 6, backgroundColor: C.card }}>
              <TextInput value={steer} onChangeText={setSteer} placeholder="Steer this run…" placeholderTextColor={C.muted} style={{ flex: 1, minHeight: 44, paddingHorizontal: 10, fontSize: 15, color: C.ink }} />
              <Press onPress={() => act(async () => { await api.runs.steer(run.id, steer.trim()); setSteer(''); })} disabled={!steer.trim()} accessibilityLabel="Send" style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', opacity: steer.trim() ? 1 : 0.45 }}><Icon name="send" size={20} color="#fff" /></Press>
            </View>) : null}
        </>) : !err ? <Text style={{ color: C.muted }}>Loading…</Text> : null}
    </Screen>
  );
}
