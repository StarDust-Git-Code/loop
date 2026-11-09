import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Caption, Card, Chip, Press } from '../components/ui';
import { api, getVoiceUrl, setVoiceUrl } from '../lib/api';
import { signOut, useAuth } from '../lib/auth';
import { cacheClear } from '../lib/cache';
import { getNotifyEnabled, setNotifyEnabled } from '../lib/notify';
import { resolveServer, serverLastSeen, serverUrlNow } from '../lib/server';
import { useTheme } from '../lib/themeContext';
import { C, R } from '../lib/theme';
import type { Settings as S } from '../lib/types';

const THINK = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'Extra high']] as const;
const input = { minHeight: 48, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, paddingHorizontal: 12, fontSize: 14.5, color: C.ink } as const;

export default function Settings() {
  const insets = useSafeAreaInsets(); const router = useRouter(); const { user } = useAuth();
  const { pref, setPref } = useTheme();
  const [st, setSt] = useState<S | null>(null); const [err, setErr] = useState('');
  const [name, setName] = useState(''); const [notify, setNotify] = useState(true);
  const [server, setServer] = useState(serverUrlNow()); const [checking, setChecking] = useState(false);
  const [voice, setVoice] = useState(''); const [tg, setTg] = useState<{ code: string; link?: string } | null>(null);

  useEffect(() => {
    void getNotifyEnabled().then(setNotify);
    void getVoiceUrl().then((v) => setVoice(v === serverUrlNow() ? '' : v));
    api.settings.get().then((x) => { setSt(x); setName(x.displayName ?? ''); }).catch((e: Error) => setErr(e.message));
  }, []);
  const patch = async (p: Partial<S>) => { setSt((s) => ({ ...(s ?? {}), ...p })); try { setSt(await api.settings.patch(p)); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } };
  const toggleRow = (label: string, sub: string, value: boolean, on: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 15, color: C.ink, fontWeight: '600' }}>{label}</Text><Text style={{ fontSize: 12.5, color: C.muted }}>{sub}</Text></View>
      <Switch value={value} onValueChange={on} trackColor={{ true: C.brand, false: C.line2 }} accessibilityLabel={label} />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 18, paddingTop: 18, paddingBottom: insets.bottom + 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>Settings</Text>
        <Press onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: C.brandDeep, fontWeight: '800' }}>Done</Text></Press>
      </View>
      {err ? <Text style={{ color: C.bad, fontSize: 13 }}>{err}</Text> : null}

      <Card style={{ padding: 14, gap: 8 }}>
        <Caption>YOU</Caption>
        <Text style={{ fontSize: 13, color: C.muted }}>{user?.email}</Text>
        <TextInput value={name} onChangeText={setName} onEndEditing={() => void patch({ displayName: name.trim() })} placeholder="Your name (what your Mates call you)" placeholderTextColor={C.muted} style={input} accessibilityLabel="Display name" />
      </Card>

      <Card style={{ padding: 14, gap: 6 }}>
        <Caption>YOUR SERVER</Caption>
        <Text style={{ fontSize: 14, color: server ? C.ink : C.warn }} selectable>{server || 'Not paired yet'}</Text>
        <Text style={{ fontSize: 12, color: C.muted }}>{server ? `Your agents run on your own computer.${serverLastSeen() ? ` Last seen ${new Date(serverLastSeen()).toLocaleString()}.` : ''}` : 'Pair your server once in the web dashboard (Server page). This phone then finds it by itself.'}</Text>
        <Btn label={checking ? 'Checking…' : 'Look up again'} kind="soft" small disabled={checking} onPress={async () => { setChecking(true); setServer(await resolveServer()); setChecking(false); }} />
      </Card>

      <Card style={{ padding: 14, gap: 10 }}>
        <Caption>AGENTS</Caption>
        <Text style={{ fontSize: 13, color: C.ink2 }}>Default thinking</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{THINK.map(([k, l]) => <Chip key={k} label={l} on={(st?.defaultThinking ?? 'high') === k} onPress={() => void patch({ defaultThinking: k })} />)}</View>
        {toggleRow('Show thought process', 'Shows how a Mate reasoned, above its answer.', st?.showReasoning !== false, (v) => void patch({ showReasoning: v }))}
        <Text style={{ fontSize: 13, color: C.ink2 }}>Brainstorm rounds</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>{[1, 2, 3, 4].map((n) => <Chip key={n} label={String(n)} on={(st?.brainstormRounds ?? 2) === n} onPress={() => void patch({ brainstormRounds: n })} />)}</View>
      </Card>

      <Card style={{ padding: 14, gap: 8 }}>
        <Caption>NOTIFICATIONS</Caption>
        {toggleRow('On this phone', 'Runs that finish or need you, questions from Mates, and calls.', notify, (v) => { setNotify(v); void setNotifyEnabled(v); })}
        {toggleRow('App push everywhere', 'Also browsers where you turned notifications on.', st?.notifyApp !== false, (v) => void patch({ notifyApp: v }))}
        {toggleRow('Quiet hours', `Hold notifications and calls ${st?.quietFrom ?? '22:00'}–${st?.quietTo ?? '07:00'} unless urgent. Change the times in the dashboard.`, !!st?.quietHoursOn, (v) => void patch({ quietHoursOn: v }))}
      </Card>

      <Card style={{ padding: 14, gap: 8 }}>
        <Caption>TELEGRAM</Caption>
        <Text style={{ fontSize: 12.5, color: C.muted }}>Link your Telegram chat so Mates can message and ring you there. The bot itself is set up on your server.</Text>
        {tg ? (
          <View style={{ gap: 8 }}>
            <Text selectable style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>/start {tg.code}</Text>
            {tg.link ? <Btn label="Open Telegram" kind="primary" onPress={() => void Linking.openURL(`${tg.link}?start=${tg.code}`)} /> : <Text style={{ fontSize: 12.5, color: C.muted }}>Send it to your Loopmates bot.</Text>}
          </View>
        ) : <Btn label="Get a link code" kind="soft" onPress={async () => { try { setTg(await api.telegramCode()); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not get a code'); } }} />}
      </Card>

      <Card style={{ padding: 14, gap: 10 }}>
        <Caption>APPEARANCE</Caption>
        <View style={{ flexDirection: 'row', gap: 8 }}>{(['system', 'light', 'dark'] as const).map((p) => <Chip key={p} label={p[0].toUpperCase() + p.slice(1)} on={pref === p} onPress={() => setPref(p)} />)}</View>
      </Card>

      <Card style={{ padding: 14, gap: 8 }}>
        <Caption>ADVANCED</Caption>
        <Text style={{ fontSize: 12.5, color: C.muted }}>Voice server override (leave empty to use your server).</Text>
        <TextInput value={voice} onChangeText={setVoice} onEndEditing={() => void setVoiceUrl(voice)} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://…" placeholderTextColor={C.muted} style={input} accessibilityLabel="Voice server override" />
      </Card>

      <Btn label="Sign out" kind="danger" onPress={async () => { await cacheClear(); await signOut(); router.replace('/sign-in'); }} />
    </ScrollView>
  );
}
