import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PILL_SPACE } from '../components/PillBar';
import { Avatar, Btn, Chip, ErrorNote, Icon, Press } from '../components/ui';
import { MATE_DEFS, mateName, type MateKey } from '../lib/mates';
import { api } from '../lib/api';
import { C, R } from '../lib/theme';
import type { CallReport } from '../lib/types';
import { startCall, type CallHandle } from '../lib/voice';

type Line = { id: number; who: 'you' | 'mate'; text: string };
const WHY: Record<string, string> = { silence: 'Call ended after a long silence.', 'time limit': 'Call ended at the time limit.', busy: 'The line is busy. Try again in a moment.' };

function Pulse({ level, live }: { level: number; live: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => { s.value = live ? withTiming(1 + Math.min(level * 1.6, 0.45), { duration: 140, easing: Easing.out(Easing.quad) }) : withTiming(1); }, [level, live, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(106,77,244,0.16)' }, a]} />;
}

export default function CallScreen({ mate: mateParam, reason, conv, call }: { mate?: string; reason?: string; conv?: string; call?: string }) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const [mate, setMate] = useState<MateKey>((mateParam as MateKey) || 'mimo');
  const [state, setState] = useState<'idle' | 'connecting' | 'live'>('idle');
  const [report, setReport] = useState<CallReport | null>(null);
  const [err, setErr] = useState(''); const [lines, setLines] = useState<Line[]>([]); const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0); const [lvl, setLvl] = useState(0); const [tool, setTool] = useState('');
  const h = useRef<CallHandle | null>(null); const id = useRef(0);

  useEffect(() => { if (mateParam) setMate(mateParam as MateKey); }, [mateParam]);
  useEffect(() => { if (state !== 'live') return; const t0 = Date.now(); const t = setInterval(() => { setSecs(Math.floor((Date.now() - t0) / 1000)); setLvl(h.current?.level() ?? 0); }, 250); return () => clearInterval(t); }, [state]);
  useEffect(() => () => h.current?.hangup(), []);

  const add = (who: Line['who'], text: string) => setLines((ls) => { const last = ls[ls.length - 1]; return last?.who === who ? [...ls.slice(0, -1), { ...last, text: last.text + text }] : [...ls, { id: id.current++, who, text }]; });
  const dial = async () => {
    setErr(''); setLines([]); setSecs(0); setMuted(false); setState('connecting'); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      h.current = await startCall(mate, reason ?? '', (e) => {
        if (e.type === 'ready') setState('live');
        else if (e.type === 'tool') { setTool(e.name); setTimeout(() => setTool(''), 2500); }
        else if (e.type === 'transcript') add(e.who, e.text);
        else if (e.type === 'error') { setErr(e.message); setState('idle'); }
        else if (e.type === 'end') { setState('idle'); h.current = null; if (call) { let n = 0; const poll = () => api.calls.get(call).then((r) => { if (r.report) setReport(r); else if (n++ < 8) setTimeout(poll, 2000); }).catch(() => {}); setTimeout(poll, 2000); } if (e.why && WHY[e.why]) setErr(WHY[e.why]); }
      }, conv ?? '', call ?? '');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not start the call.'); setState('idle'); }
  };
  const hang = () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); h.current?.hangup(); h.current = null; setState('idle'); };
  const mm = String(Math.floor(secs / 60)).padStart(2, '0'), ss = String(secs % 60).padStart(2, '0');

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 18, gap: 14 }}>
      <ErrorNote message={err} />
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
        <View style={{ width: 190, height: 190, alignItems: 'center', justifyContent: 'center' }}><Pulse level={lvl} live={state === 'live'} /><Avatar k={mate} size={116} /></View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink }}>{mateName(mate)}</Text>
        <Text style={{ color: C.muted, fontSize: 13.5 }}>{state === 'live' ? `On a call · ${mm}:${ss}${tool ? ` · using ${tool.replace(/_/g, ' ')}` : ''}` : state === 'connecting' ? 'Connecting… the server may need a minute to wake' : 'Pick someone and tap Call'}</Text>
      </View>
      {state === 'idle' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
          {MATE_DEFS.map((d) => <Chip key={d.key} label={d.name} on={mate === d.key} onPress={() => setMate(d.key)} />)}
        </ScrollView>
      ) : null}
      {report?.report ? (
        <View style={{ backgroundColor: C.tint2, borderWidth: 1, borderColor: 'rgba(106,77,244,0.3)', borderRadius: R.lg, padding: 14, gap: 4 }}>
          <Text style={{ fontWeight: '800', color: C.ink }}>Call report sent to {mateName(report.mate)}</Text>
          <Text style={{ color: C.ink2, fontSize: 14, lineHeight: 20 }}>{report.report.summary}</Text>
          {report.report.answers.map((a, i) => <Text key={i} style={{ color: C.ink2, fontSize: 13.5, lineHeight: 19 }}>- {a}</Text>)}
        </View>) : null}
      <FlatList data={lines} keyExtractor={(l) => String(l.id)} style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.who === 'you' ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: item.who === 'you' ? C.tint : '#fff', borderWidth: 1, borderColor: C.line, borderRadius: R.lg, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ fontSize: 14.5, lineHeight: 21, color: C.ink }}>{item.text}</Text></View>)} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, paddingBottom: PILL_SPACE + 12 }}>
        {state === 'idle' ? <Btn label={`Call ${mateName(mate)}`} icon="phone" onPress={dial} style={{ minWidth: 220 }} /> : (
          <>
            <Press onPress={() => { h.current?.mute(!muted); setMuted(!muted); }} accessibilityLabel={muted ? 'Unmute' : 'Mute'} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: muted ? C.ink : C.card, borderWidth: 1, borderColor: C.line2, alignItems: 'center', justifyContent: 'center' }}><Icon name={muted ? 'micoff' : 'mic'} size={26} color={muted ? '#fff' : C.ink} /></Press>
            <Press onPress={hang} accessibilityLabel="Hang up" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.bad, alignItems: 'center', justifyContent: 'center' }}><Icon name="hangup" size={28} color="#fff" /></Press>
          </>)}
      </View>
    </View>
  );
}
