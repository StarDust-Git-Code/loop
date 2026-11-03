import { useRouter } from 'expo-router';
import { useState } from 'react';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { FlatList, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PILL_SPACE } from '../components/PillBar';
import { Avatar, Chip, ErrorNote, Icon, Press, Title } from '../components/ui';
import { api } from '../lib/api';
import { useList } from '../lib/hooks';
import { MATE_DEFS, mateName } from '../lib/mates';
import { C, R } from '../lib/theme';
import type { MateConfig } from '../lib/types';

const LEVELS = ['low', 'default', 'high'];
export default function Agents() {
  const insets = useSafeAreaInsets(); const router = useRouter();
  const cfg = useList(async () => ({ mates: await api.mates.list(), settings: await api.settings.get().catch(() => ({} as { defaultThinking?: string })) }));
  const [starting, setStarting] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const byKey = new Map((cfg.data?.mates ?? []).map((m) => [m.mate, m] as const));
  const toggle = async (key: string, on: boolean) => {
    const cur = byKey.get(key as never);
    cfg.setData((p) => p && { ...p, mates: cur ? p.mates.map((m) => (m.mate === key ? { ...m, enabled: on } : m)) : [...p.mates, { id: key, mate: key as never, enabled: on } as MateConfig] });
    try { await api.mates.patch(key, { enabled: on }); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not update'); cfg.reload(); }
  };
  const chat = async (key: string) => {
    if (starting) return; setStarting(key);
    try { const c = await api.conversations.create({ title: `Chat with ${mateName(key)}`, mate: key as never, messages: [], mode: 'chat', members: [] }); router.push(`/chat/${c.id}`); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not start the chat'); } finally { setStarting(null); }
  };
  const level = async (l: string) => { cfg.setData((p) => p && { ...p, settings: { ...p.settings, defaultThinking: l } }); try { await api.settings.patch({ defaultThinking: l }); } catch { cfg.reload(); } };
  const sorted = [...MATE_DEFS].sort((a, b) => Number(!!byKey.get(b.key)?.enabled) - Number(!!byKey.get(a.key)?.enabled));
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 16 }}>
      <View style={{ paddingHorizontal: 18, gap: 10, paddingBottom: 10 }}>
        <Title sub="Switch Mates on, chat, or call">Agents</Title>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 13, color: C.muted }}>Reasoning</Text>
          {LEVELS.map((l) => <Chip key={l} label={l} on={(cfg.data?.settings.defaultThinking ?? 'default') === l} onPress={() => level(l)} />)}
        </View>
        <ErrorNote message={err ?? cfg.error} onRetry={() => { setErr(null); cfg.reload(); }} />
      </View>
      <FlatList data={sorted} keyExtractor={(m) => m.key} onRefresh={cfg.refresh} refreshing={cfg.refreshing}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: PILL_SPACE + 16, gap: 10 }}
        renderItem={({ item: m, index }) => {
          const on = !!byKey.get(m.key)?.enabled;
          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).springify().damping(16)} layout={LinearTransition}><Press onPress={() => chat(m.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: m.tint, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 12, opacity: on ? 1 : 0.72 }}>
              <Avatar k={m.key} size={52} />
              <View style={{ flex: 1 }}><Text style={{ fontSize: 15.5, fontWeight: '800', color: C.ink }}>{mateName(m.key)}</Text><Text numberOfLines={2} style={{ fontSize: 12.5, color: C.ink2 }}>{m.blurb}</Text></View>
              <Press onPress={() => router.navigate({ pathname: '/', params: { tab: 'call', mate: m.key } })} accessibilityLabel={`Call ${mateName(m.key)}`} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Icon name="phone" size={20} color={C.brandDeep} /></Press>
              <Switch value={on} onValueChange={(v) => toggle(m.key, v)} trackColor={{ true: C.brand, false: '#D5D1DE' }} thumbColor="#fff" accessibilityLabel={`${mateName(m.key)} on or off`} />
            </Press></Animated.View>);
        }} />
    </View>
  );
}
