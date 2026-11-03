import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Btn, Empty, ErrorNote } from '../components/ui';
import { Field, Row, Screen, Sheet } from '../components/kit';
import { api } from '../lib/api';
import { useList } from '../lib/hooks';
import { C } from '../lib/theme';
import type { Skill } from '../lib/types';

export default function Skills() {
  const s = useList(() => api.skills.list(), [], 'skills');
  const [edit, setEdit] = useState<Partial<Skill> | null>(null); const [err, setErr] = useState<string | null>(null);
  const toggle = async (x: Skill, enabled: boolean) => { s.setData((p) => (p ?? []).map((y) => (y.id === x.id ? { ...y, enabled } : y))); try { await api.skills.patch(x.id, { enabled }); } catch { s.reload(); } };
  const save = async () => {
    if (!edit?.name?.trim()) return; setErr(null);
    const body = { name: edit.name.trim(), description: edit.description ?? '', instructions: edit.instructions ?? '' };
    try {
      if (edit.id) { const r = await api.skills.patch(edit.id, body); s.setData((p) => (p ?? []).map((y) => (y.id === r.id ? r : y))); }
      else { const r = await api.skills.create({ ...body, enabled: true, mates: [] }); s.setData((p) => [r, ...(p ?? [])]); }
      setEdit(null);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); }
  };
  const del = async (x: Skill) => { s.setData((p) => (p ?? []).filter((y) => y.id !== x.id)); setEdit(null); try { await api.skills.remove(x.id); } catch { s.reload(); } };
  return (
    <Screen title="Skills" sub="Reusable instructions your Mates can follow" right={<Btn icon="plus" small onPress={() => setEdit({ name: '' })} />}>
      <ErrorNote message={s.error} onRetry={s.reload} />
      {s.loading ? <Empty text="Loading…" /> : (s.data ?? []).length === 0 ? <Empty text="No skills yet. Tap + to teach your Mates something." /> : (s.data ?? []).map((x, i) => (
        <Animated.View key={x.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).springify().damping(16)} layout={LinearTransition}>
          <Row onPress={() => setEdit(x)}>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{x.name}</Text><Text numberOfLines={2} style={{ fontSize: 12.5, color: C.muted }}>{x.description || x.instructions}</Text></View>
            <Switch value={x.enabled} onValueChange={(v) => toggle(x, v)} trackColor={{ true: C.brand, false: '#D5D1DE' }} thumbColor="#fff" accessibilityLabel={`${x.name} on or off`} />
          </Row>
        </Animated.View>))}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit skill' : 'New skill'} onSave={save} canSave={!!edit?.name?.trim()}>
        <Field label="Name" value={edit?.name ?? ''} onChangeText={(v) => setEdit((e) => ({ ...e, name: v }))} />
        <Field label="Short description" value={edit?.description ?? ''} onChangeText={(v) => setEdit((e) => ({ ...e, description: v }))} />
        <Field label="Instructions" value={edit?.instructions ?? ''} onChangeText={(v) => setEdit((e) => ({ ...e, instructions: v }))} multiline style={{ minHeight: 160 }} placeholder="Tell the Mates exactly how to do this." />
        {err ? <ErrorNote message={err} /> : null}
        {edit?.id ? <Btn label="Delete skill" kind="danger" onPress={() => del(edit as Skill)} /> : null}
      </Sheet>
    </Screen>
  );
}
