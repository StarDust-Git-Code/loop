import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';
import { PillBar, TABS } from '../components/PillBar';
import { C } from '../lib/theme';
import AgentsScreen from '../screens/Agents';
import CallScreen from '../screens/CallScreen';
import HomeScreen from '../screens/Home';
import MySpaceScreen from '../screens/MySpace';

const KEYS = ['home', 'my-space', 'agents', 'call'];

/** One screen holding all four tabs in a swipeable pager, with the floating pill under it. */
export default function Main() {
  const p = useLocalSearchParams<{ tab?: string; mate?: string; reason?: string; conv?: string }>();
  const start = Math.max(0, KEYS.indexOf(p.tab ?? 'home'));
  const { width } = useWindowDimensions();
  const pager = useRef<PagerView>(null);
  const progress = useSharedValue(start);
  const [seen, setSeen] = useState<Set<number>>(new Set([start]));
  const mark = useCallback((i: number) => setSeen((s) => (s.has(i) ? s : new Set(s).add(i))), []);

  useEffect(() => { const i = KEYS.indexOf(p.tab ?? ''); if (i >= 0) { mark(i); pager.current?.setPage(i); } }, [p.tab, p.mate, p.conv, p.reason, mark]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <PagerView ref={pager} style={{ flex: 1 }} initialPage={start} overdrag={false} offscreenPageLimit={1}
        onPageScroll={(e) => { progress.value = e.nativeEvent.position + e.nativeEvent.offset; }}
        onPageSelected={(e) => { mark(e.nativeEvent.position); mark(e.nativeEvent.position + 1); }}>
        <View key="home" collapsable={false}>{seen.has(0) ? <HomeScreen /> : null}</View>
        <View key="my-space" collapsable={false}>{seen.has(1) ? <MySpaceScreen /> : null}</View>
        <View key="agents" collapsable={false}>{seen.has(2) ? <AgentsScreen /> : null}</View>
        <View key="call" collapsable={false}>{seen.has(3) ? <CallScreen mate={p.mate} reason={p.reason} conv={p.conv} /> : null}</View>
      </PagerView>
      <PillBar progress={progress} width={width} go={(i) => { mark(i); pager.current?.setPage(i); }} />
    </View>
  );
}
void TABS;
