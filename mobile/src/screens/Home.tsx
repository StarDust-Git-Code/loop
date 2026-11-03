import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PILL_SPACE } from '../components/PillBar';
import { Avatar, Card, Caption, Empty, ErrorNote, Icon, Press } from '../components/ui';
import { api } from '../lib/api';
import type { Settings } from '../lib/types';
import { useAuth } from '../lib/auth';
import { ago, useList } from '../lib/hooks';
import { mateName } from '../lib/mates';
import { C, R } from '../lib/theme';

const EXPLORE: [string, string, string][] = [['Runs', 'send', '/runs'], ['Tasks', 'check', '/tasks'], ['Calendar', 'clip', '/calendar'], ['Skills', 'star', '/skills'], ['Workflows', 'settings', '/workflows'], ['Connect', 'chat', '/connections']];
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

export default function Home() {
  const insets = useSafeAreaInsets(); const router = useRouter(); const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const all = useList(async () => {
    const [settings, convs, tasks, events, runs] = await Promise.all([api.settings.get().catch((): Settings => ({})), api.conversations.list(), api.tasks.list().catch(() => []), api.events.list().catch(() => []), api.runs.list().catch(() => [])]);
    return { settings, convs, tasks, events, runs };
  });
  const d = all.data;
  const name = d?.settings.displayName || user?.email?.split('@')[0] || 'there';
  const today = new Date().toDateString();
  const todays = useMemo(() => (d?.events ?? []).filter((e) => new Date(e.start).toDateString() === today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4), [d, today]);
  const recent = useMemo(() => [...(d?.convs ?? [])].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)).slice(0, 6), [d]);
  const due = (d?.tasks ?? []).filter((t) => t.status !== 'done').length;
  const running = (d?.runs ?? []).filter((r) => /run|work|progress/i.test(r.status)).length;
  const waiting = (d?.runs ?? []).filter((r) => /approv|wait/i.test(r.status)).length;

  const open = async (mate: string) => {
    if (busy) return; setBusy(true);
    try { const c = await api.conversations.create({ title: `Chat with ${mateName(mate)}`, mate: mate as never, messages: [], mode: 'chat', members: [] }); router.push(`/chat/${c.id}`); }
    catch { /* shown by the list's error note on the next refresh */ } finally { setBusy(false); }
  };
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 18, paddingBottom: PILL_SPACE + 16, gap: 16 }} refreshControl={<RefreshControl refreshing={all.refreshing} onRefresh={all.refresh} tintColor={C.brand} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View><Text style={{ fontSize: 13, color: C.muted }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.3 }}>{greet()}, {name}</Text></View>
        <Press onPress={() => router.push('/settings')} accessibilityLabel="Settings" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: C.brandDeep }}>{name.charAt(0).toUpperCase()}</Text></Press>
      </View>
      <ErrorNote message={all.error} onRetry={all.reload} />

      <Animated.View entering={FadeInDown.delay(60).springify().damping(16)} style={{ borderRadius: 22, padding: 18, backgroundColor: C.brand, overflow: 'hidden' }}>
        <Caption style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2 }}>WHAT SHOULD LOOP DO TODAY</Caption>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800', marginTop: 8, maxWidth: 230, lineHeight: 25 }}>Hand a goal to your Mates</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Press onPress={() => open('planner')} style={{ minHeight: 44, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 16, justifyContent: 'center' }}><Text style={{ color: C.brandDeep, fontWeight: '800', fontSize: 14 }}>Ask Planner</Text></Press>
          <Press onPress={() => router.navigate({ pathname: '/', params: { tab: 'agents' } })} style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', paddingHorizontal: 16, justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>All agents</Text></Press>
        </View>
        <View style={{ position: 'absolute', right: -6, bottom: -8 }}><Avatar k="planner" size={104} /></View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).springify().damping(16)} style={{ flexDirection: 'row', gap: 10 }}>
        {[[due, 'Open tasks'], [running, 'Runs in progress'], [waiting, 'Needs approval']].map(([n, l]) => (
          <Card key={l as string} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14 }}><Text style={{ fontSize: 24, fontWeight: '800', color: C.ink }}>{n}</Text><Text style={{ fontSize: 12.5, color: C.muted }}>{l}</Text></Card>))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).springify().damping(16)}><Caption style={{ marginBottom: 8 }}>TODAY</Caption>
        <Card>{todays.length === 0 ? <Empty text="Nothing scheduled today." /> : todays.map((e, i) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <Text style={{ width: 52, fontWeight: '800', color: C.brandDeep, fontSize: 13 }}>{new Date(e.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>{e.title}</Text></View>))}</Card></Animated.View>

      <Animated.View entering={FadeInDown.delay(260).springify().damping(16)}>
        <Caption style={{ marginBottom: 8 }}>EXPLORE</Caption>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {EXPLORE.map(([label, icon, path]) => (
            <Press key={label} onPress={() => router.push(path as never)} accessibilityLabel={label} style={{ width: '31%', flexGrow: 1, minHeight: 74, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name={icon} size={22} color={C.brandDeep} /><Text style={{ fontSize: 12.5, fontWeight: '800', color: C.ink }}>{label}</Text></Press>))}
        </View>
      </Animated.View>

      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <Caption>RECENT CHATS</Caption><Press onPress={() => router.push('/chats')}><Text style={{ color: C.brandDeep, fontWeight: '800', fontSize: 13 }}>See all</Text></Press></View>
        <View style={{ gap: 8 }}>
          {all.loading ? <Empty text="Loading…" /> : recent.length === 0 ? <Empty text="No chats yet. Pick an agent to start." /> : recent.map((c, i) => {
            const last = c.messages[c.messages.length - 1];
            return (
              <Animated.View key={c.id} entering={FadeInDown.delay(300 + i * 50).springify().damping(16)} layout={LinearTransition}><Press onPress={() => router.push(`/chat/${c.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 10, paddingHorizontal: 12, minHeight: 60 }}>
                <Avatar k={c.mate ?? 'planner'} size={40} />
                <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '800', color: C.ink }}>{c.title}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{last?.text.replace(/\s+/g, ' ') ?? 'No messages yet'}</Text></View>
                <Text style={{ fontSize: 12, color: C.muted }}>{ago(c.updatedAt ?? c.createdAt)}</Text>
              </Press></Animated.View>);
          })}
        </View>
      </View>
    </ScrollView>
  );
}
