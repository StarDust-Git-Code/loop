import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Btn, Chip, Empty, ErrorNote, Press } from '../components/ui';
import { Field, Row, Screen, Sheet } from '../components/kit';
import { api } from '../lib/api';
import { useList } from '../lib/hooks';
import { C } from '../lib/theme';
import type { Task } from '../lib/types';

const NEXT: Record<Task['status'], Task['status']> = { todo: 'doing', doing: 'done', done: 'todo' };
const MARK = { todo: '○', doing: '◐', done: '●' } as const;

export default function Tasks() {
  const t = useList(() => api.tasks.list(), [], 'tasks');
  const [filter, setFilter] = useState<'open' | 'all' | 'done'>('open');
  const [edit, setEdit] = useState<Partial<Task> | null>(null); const [err, setErr] = useState<string | null>(null);
  const rows = (t.data ?? []).filter((x) => filter === 'all' || (filter === 'done' ? x.status === 'done' : x.status !== 'done')).sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
  const cycle = async (x: Task) => { const status = NEXT[x.status]; void Haptics.selectionAsync(); t.setData((p) => (p ?? []).map((y) => (y.id === x.id ? { ...y, status } : y))); try { await api.tasks.patch(x.id, { status }); } catch { t.reload(); } };
  const save = async () => {
    if (!edit?.title?.trim()) return; setErr(null);
    try {
      if (edit.id) { const r = await api.tasks.patch(edit.id, { title: edit.title.trim(), detail: edit.detail ?? '', dueAt: edit.dueAt || undefined }); t.setData((p) => (p ?? []).map((y) => (y.id === r.id ? r : y))); }
      else { const r = await api.tasks.create({ title: edit.title.trim(), detail: edit.detail ?? '', status: 'todo', tags: [], dueAt: edit.dueAt || undefined } as Partial<Task>); t.setData((p) => [r, ...(p ?? [])]); }
      setEdit(null);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); }
  };
  const del = async (x: Task) => { t.setData((p) => (p ?? []).filter((y) => y.id !== x.id)); setEdit(null); try { await api.tasks.remove(x.id); } catch { t.reload(); } };
  return (
    <Screen title="Tasks" sub={`${(t.data ?? []).filter((x) => x.status !== 'done').length} open`} right={<Btn icon="plus" small onPress={() => setEdit({ title: '' })} />}>
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['open', 'all', 'done'] as const).map((f) => <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} on={filter === f} onPress={() => setFilter(f)} />)}</View>
      <ErrorNote message={t.error} onRetry={t.reload} />
      {t.loading ? <Empty text="Loading…" /> : rows.length === 0 ? <Empty text="Nothing here. Tap + to add a task." /> : rows.map((x, i) => (
        <Animated.View key={x.id} entering={FadeInDown.delay(Math.min(i, 8) * 35).duration(260)} layout={LinearTransition}>
          <Row onPress={() => setEdit(x)}>
            <Press onPress={() => cycle(x)} accessibilityLabel={`Mark ${NEXT[x.status]}`} haptic={false} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, color: x.status === 'done' ? C.good : C.brandDeep }}>{MARK[x.status]}</Text></Press>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: '700', color: C.ink, textDecorationLine: x.status === 'done' ? 'line-through' : 'none' }}>{x.title}</Text>
              {x.dueAt || x.detail ? <Text numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{x.dueAt ? `Due ${new Date(x.dueAt).toLocaleDateString()}` : ''}{x.dueAt && x.detail ? ' · ' : ''}{x.detail}</Text> : null}</View>
          </Row>
        </Animated.View>))}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit task' : 'New task'} onSave={save} canSave={!!edit?.title?.trim()}>
        <Field label="Title" value={edit?.title ?? ''} onChangeText={(v) => setEdit((e) => ({ ...e, title: v }))} />
        <Field label="Details" value={edit?.detail ?? ''} onChangeText={(v) => setEdit((e) => ({ ...e, detail: v }))} multiline />
        <Field label="Due date (YYYY-MM-DD)" value={edit?.dueAt?.slice(0, 10) ?? ''} onChangeText={(v) => setEdit((e) => ({ ...e, dueAt: v }))} keyboardType="numbers-and-punctuation" placeholder="2026-11-07" />
        {err ? <ErrorNote message={err} /> : null}
        {edit?.id ? <Btn label="Delete task" kind="danger" onPress={() => del(edit as Task)} /> : null}
      </Sheet>
    </Screen>
  );
}
