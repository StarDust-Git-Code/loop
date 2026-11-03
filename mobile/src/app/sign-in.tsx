import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Btn, ErrorNote, Press } from '../components/ui';
import { resetPassword, signIn, signUp } from '../lib/auth';
import { C, R } from '../lib/theme';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [info, setInfo] = useState<string | null>(null);
  const submit = async () => {
    setErr(null); setInfo(null); setBusy(true);
    try { await (mode === 'in' ? signIn(email, pw) : signUp(email, pw)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not sign in'); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (!email.trim()) return setErr('Type your email first, then tap Forgot password.');
    try { await resetPassword(email); setErr(null); setInfo('Reset link sent. Check your inbox.'); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send the link'); }
  };
  const input = { minHeight: 52, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, backgroundColor: '#fff', paddingHorizontal: 16, fontSize: 16, color: C.ink } as const;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Avatar k="planner" size={96} />
          <Text style={{ fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 }}>Loopmates</Text>
          <Text style={{ color: C.muted, fontSize: 14.5 }}>Your agents, in your pocket</Text>
        </View>
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={input} accessibilityLabel="Email" />
        <TextInput value={pw} onChangeText={setPw} placeholder="Password" placeholderTextColor={C.muted} secureTextEntry autoComplete="password" style={input} accessibilityLabel="Password" onSubmitEditing={submit} />
        <ErrorNote message={err} />
        {info ? <Text style={{ color: C.good, fontSize: 13.5 }}>{info}</Text> : null}
        <Btn label={mode === 'in' ? 'Sign in' : 'Create account'} onPress={submit} busy={busy} disabled={!email.trim() || pw.length < 6} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Press onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(null); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: C.brandDeep, fontWeight: '700' }}>{mode === 'in' ? 'New here? Create account' : 'Have an account? Sign in'}</Text></Press>
          {mode === 'in' ? <Press onPress={reset} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: C.muted }}>Forgot password</Text></Press> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
