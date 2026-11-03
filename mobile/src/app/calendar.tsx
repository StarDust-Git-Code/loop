import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Btn, Chip, Empty, ErrorNote } from '../components/ui';
import { Field, Row, Screen, Sheet } from '../components/kit';
import { api } from '../lib/api';
import { useList } from '../lib/hooks';
import { C } from '../lib/theme';
import type { CalEvent } from '../lib/types';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (date: string, time: string) => { const d = new Date(`${date}T${time || '09:00'}:00`); return Number.isNaN(d.getTime()) ? null : d; };

export default function Calendar() {
  const ev = useList(() => api.events.list(), [], 'events');
  const [day, setDay] = useState(() => ymd(new Date()));
  const [edit, setEdit] = useState<{ id?: string; title: string; date: string; time: string; notes: string } | null>(null); const [err, setErr] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);
  const counts = useMemo(() => { const m: Record<string, number> = {}; for (const e of ev.data ?? []) { const k = ymd(new Date(e.start)); m[k] = (m[k] ?? 0) + 1; } return m; }, [ev.data]);
  const rows = (ev.data ?? []).filter((e) => ymd(new Date(e.start)) === day).sort((a, b) => a.start.localeCompare(b.start));
  const open = (e?: CalEvent) => { const d = e ? new Date(e.start) : parse(day, '09:00')!; setEdit({ id: e?.id, title: e?.title ?? '', date: ymd(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, notes: e?.notes ?? '' }); setErr(null); };
  const save = async () => {
    if (!edit) return; const s = parse(edit.date, edit.time); if (!s) return setErr('Use a date like 2026-11-07 and a time like 14:30.');
    const body = { title: edit.title.trim(), start: s.toISOString(), end: new Date(s.getTime() + 3600_000).toISOString(), kind: 'event' as const, notes: edit.notes };
    try {
      if (edit.id) { const r = await api.events.patch(edit.id, body); ev.setData((p) => (p ?? []).map((y) => (y.id === r.id ? r : y))); } else { const r = await api.events.create(body); ev.setData((p) => [...(p ?? []), r]); }
      setEdit(null); setDay(edit.date);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); }
  };
  const del = async () => { if (!edit?.id) return; const id = edit.id; ev.setData((p) => (p ?? []).filter((y) => y.id !== id)); setEdit(null); try { await api.events.remove(id); } catch { ev.reload(); } };
  return (
    <Screen title="Calendar" sub={new Date(day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} right={<Btn icon="plus" small onPress={() => open()} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {days.map((d) => { const k = ymd(d); return <Chip key={k} label={`${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}${counts[k] ? ` · ${counts[k]}` : ''}`} on={day === k} onPress={() => setDay(k)} />; })}
      </View>
      <ErrorNote message={ev.error} onRetry={ev.reload} />
      {ev.loading ? <Empty text="Loading…" /> : rows.length === 0 ? <Empty text="Nothing on this day." /> : rows.map((e, i) => (
        <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).duration(260)} layout={LinearTransition}>
          <Row onPress={() => open(e)}>
            <Text style={{ width: 52, fontWeight: '800', color: C.brandDeep, fontSize: 13 }}>{new Date(e.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{e.title}</Text>{e.notes ? <Text numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{e.notes}</Text> : null}</View>
          </Row>
        </Animated.View>))}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit event' : 'New event'} onSave={save} canSave={!!edit?.title.trim()}>
        <Field label="Title" value={edit?.title ?? ''} onChangeText={(v) => setEdit((e) => e && { ...e, title: v })} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.4 }}><Field label="Date" value={edit?.date ?? ''} onChangeText={(v) => setEdit((e) => e && { ...e, date: v })} keyboardType="numbers-and-punctuation" /></View>
          <View style={{ flex: 1 }}><Field label="Time" value={edit?.time ?? ''} onChangeText={(v) => setEdit((e) => e && { ...e, time: v })} keyboardType="numbers-and-punctuation" /></View>
        </View>
        <Field label="Notes" value={edit?.notes ?? ''} onChangeText={(v) => setEdit((e) => e && { ...e, notes: v })} multiline />
        {err ? <ErrorNote message={err} /> : null}
        {edit?.id ? <Btn label="Delete event" kind="danger" onPress={del} /> : null}
      </Sheet>
    </Screen>
  );
}
