import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Btn, Caption, Card, ErrorNote } from '../components/ui';
import { Field, Pill, Row, Screen } from '../components/kit';
import { api } from '../lib/api';
import { useList } from '../lib/hooks';
import { C } from '../lib/theme';
import type { Connection } from '../lib/types';

const TONE = { connected: 'ok', pending: 'warn', error: 'bad', disconnected: 'muted' } as const;

export default function Connections() {
  const c = useList(() => api.connections.list(), [], 'connections');
  const tg = (c.data ?? []).find((x) => x.provider === 'telegram');
  const [token, setToken] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; link?: string } | null>(null);
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(null); setMsg(null); try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : 'That did not work'); } finally { setBusy(false); } };
  const connect = () => run(async () => {
    const body = { provider: 'telegram' as const, label: 'Telegram', status: 'pending' as const, config: { botToken: token.trim() } };
    const saved = tg ? await api.connections.patch(tg.id, body) : await api.connections.create(body as Partial<Connection>);
    const t = await api.connections.test(saved.id); setToken(''); setMsg(t.status === 'connected' ? 'Telegram is connected.' : t.message ?? 'Saved. The server is verifying the bot.'); c.reload();
  });
  const link = () => run(async () => { setCode(await api.telegramCode(tg?.id)); });
  return (
    <Screen title="Connections" sub="Reach your Mates from other apps">
      <ErrorNote message={err ?? c.error} onRetry={c.reload} />
      {msg ? <Text style={{ color: C.good, fontSize: 13.5 }}>{msg}</Text> : null}
      <Animated.View entering={FadeInDown.duration(260)}>
        <Card style={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={{ fontSize: 17, fontWeight: '800', color: C.ink, flex: 1 }}>Telegram</Text><Pill label={tg ? tg.status : 'not set up'} tone={tg ? TONE[tg.status] : 'muted'} /></View>
          <Text style={{ color: C.muted, fontSize: 13.5, lineHeight: 19 }}>Chat with your Mates inside Telegram and get run updates there. Create a bot with @BotFather, then paste its token.</Text>
          <Field label="Bot token" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder={tg ? 'Saved. Paste a new token to replace it.' : '123456:ABC…'} />
          <Btn label={tg ? 'Update and verify' : 'Connect Telegram'} onPress={connect} busy={busy} disabled={!token.trim()} />
          {tg ? <>
            <Btn label="Send test message" kind="soft" onPress={() => run(async () => { const t = await api.connections.test(tg.id); setMsg(t.status === 'connected' ? 'Test message sent.' : t.message ?? 'Test finished.'); c.reload(); })} />
            <Btn label="Get a link code" kind="soft" onPress={link} />
            {code ? <Card style={{ padding: 12, gap: 6 }}><Caption>SEND THIS TO YOUR BOT</Caption><Text selectable style={{ fontFamily: 'monospace', fontSize: 16, color: C.ink }}>/link {code.code}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}><Btn small label="Copy" kind="ghost" onPress={() => Clipboard.setStringAsync(`/link ${code.code}`)} />{code.link ? <Btn small label="Open Telegram" kind="ghost" onPress={() => Linking.openURL(code.link!)} /> : null}</View></Card> : null}
          </> : null}
        </Card>
      </Animated.View>
      {(c.data ?? []).filter((x) => x.provider !== 'telegram').map((x) => <Row key={x.id}><Text style={{ flex: 1, fontWeight: '800', color: C.ink }}>{x.label || x.provider}</Text><Pill label={x.status} tone={TONE[x.status]} /></Row>)}
      <Text style={{ color: C.muted, fontSize: 12.5 }}>WhatsApp, GitHub, email and Google Drive are set up from the web dashboard.</Text>
    </Screen>
  );
}
