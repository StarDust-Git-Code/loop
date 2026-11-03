import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Caption, Card, Press } from '../components/ui';
import { getVoiceUrl, setVoiceUrl } from '../lib/api';
import { signOut, useAuth } from '../lib/auth';
import { API_URL, C, R } from '../lib/theme';

export default function Settings() {
  const insets = useSafeAreaInsets(); const router = useRouter(); const { user } = useAuth();
  const [voice, setVoice] = useState(''); const [saved, setSaved] = useState(false);
  useEffect(() => { void getVoiceUrl().then(setVoice); }, []);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 18, paddingTop: 18, paddingBottom: insets.bottom + 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>Settings</Text>
        <Press onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: C.brandDeep, fontWeight: '800' }}>Done</Text></Press>
      </View>
      <Card style={{ padding: 14, gap: 4 }}><Caption>ACCOUNT</Caption><Text style={{ fontSize: 15, color: C.ink }}>{user?.email}</Text></Card>
      <Card style={{ padding: 14, gap: 8 }}>
        <Caption>VOICE SERVER</Caption>
        <TextInput value={voice} onChangeText={(t) => { setVoice(t); setSaved(false); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={{ minHeight: 48, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, paddingHorizontal: 12, fontSize: 14.5 }} accessibilityLabel="Voice server address" />
        <Btn label={saved ? 'Saved' : 'Save'} kind="soft" onPress={async () => { await setVoiceUrl(voice); setSaved(true); }} />
        <Text style={{ fontSize: 12, color: C.muted }}>The address of your loopmates-voice service on Render. Calls use it.</Text>
      </Card>
      <Card style={{ padding: 14, gap: 4 }}><Caption>API</Caption><Text style={{ fontSize: 13, color: C.ink2 }}>{API_URL}</Text></Card>
      <Btn label="Sign out" kind="danger" onPress={async () => { await signOut(); router.replace('/sign-in'); }} />
    </ScrollView>
  );
}
