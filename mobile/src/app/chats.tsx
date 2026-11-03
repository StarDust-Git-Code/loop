import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Avatar, Btn, Empty, ErrorNote, Press } from '../components/ui';
import { Field, Row, Screen, Sheet } from '../components/kit';
import { api } from '../lib/api';
import { ago, useList } from '../lib/hooks';
import { C, R } from '../lib/theme';
import type { Conversation } from '../lib/types';

export default function Chats() {
  const router = useRouter();
  const c = useList(() => api.conversations.list(), [], 'convs');
  const [q, setQ] = useState(''); const [sel, setSel] = useState<Conversation | null>(null); const [name, setName] = useState('');
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return [...(c.data ?? [])].filter((x) => !n || x.title.toLowerCase().includes(n) || x.messages.some((m) => m.text.toLowerCase().includes(n)))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
  }, [c.data, q]);
  const patch = async (x: Conversation, b: Partial<Conversation>) => { c.setData((p) => (p ?? []).map((y) => (y.id === x.id ? { ...y, ...b } : y))); try { await api.conversations.patch(x.id, b); } catch { c.reload(); } };
  const del = async (x: Conversation) => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); c.setData((p) => (p ?? []).filter((y) => y.id !== x.id)); setSel(null); try { await api.conversations.remove(x.id); } catch { c.reload(); } };
  const hit = (x: Conversation) => { const n = q.trim().toLowerCase(); if (!n) return x.messages[x.messages.length - 1]?.text ?? 'No messages yet'; const m = x.messages.find((y) => y.text.toLowerCase().includes(n)); return m ? m.text : x.messages[x.messages.length - 1]?.text ?? ''; };
  return (
    <Screen title="Chats" sub="Long-press a chat to rename, pin or delete">
      <TextInput value={q} onChangeText={setQ} placeholder="Search all chats" placeholderTextColor={C.muted} style={{ minHeight: 46, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, paddingHorizontal: 14, fontSize: 15, color: C.ink }} />
      <ErrorNote message={c.error} onRetry={c.reload} />
      {c.loading ? <Empty text="Loading…" /> : rows.length === 0 ? <Empty text={q ? 'No chat matches that.' : 'No chats yet.'} /> : rows.map((x, i) => (
        <Animated.View key={x.id} entering={FadeInDown.delay(Math.min(i, 8) * 30).springify().damping(16)} layout={LinearTransition}>
          <Row onPress={() => router.push(`/chat/${x.id}`)} onLongPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSel(x); setName(x.title); }}>
            <Avatar k={x.mate ?? 'planner'} size={40} />
            <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '800', color: C.ink }}>{x.pinned ? '📌 ' : ''}{x.title}</Text><Text numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{hit(x).replace(/\s+/g, ' ')}</Text></View>
            <Text style={{ fontSize: 12, color: C.muted }}>{ago(x.updatedAt ?? x.createdAt)}</Text>
          </Row>
        </Animated.View>))}
      <Sheet visible={!!sel} onClose={() => setSel(null)} title="Manage chat" onSave={() => { if (sel && name.trim() && name.trim() !== sel.title) void patch(sel, { title: name.trim() }); setSel(null); }} saveLabel="Save name">
        <Field label="Name" value={name} onChangeText={setName} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label={sel?.pinned ? 'Unpin' : 'Pin to top'} kind="soft" style={{ flex: 1 }} onPress={() => { if (sel) void patch(sel, { pinned: !sel.pinned }); setSel(null); }} />
          <Btn label="Delete" kind="danger" style={{ flex: 1 }} onPress={() => sel && del(sel)} />
        </View>
      </Sheet>
    </Screen>
  );
}
void Press;
