import * as Haptics from 'expo-haptics';
import { View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../lib/theme';
import { Icon, Press } from './ui';

export const TABS = [['Home', 'home'], ['My Space', 'heart'], ['Agents', 'star'], ['Call', 'phone']] as const;
export const PILL_SPACE = 104;
const H = 64, GAP = 14, SIDE = 20;

function Item({ i, name, icon, progress, onPress, w }: { i: number; name: string; icon: string; progress: SharedValue<number>; onPress: () => void; w: number }) {
  const a = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - i);
    return { transform: [], opacity: interpolate(d, [0, 1], [1, 0.62], 'clamp') };
  });
  return (
    <Press onPress={onPress} haptic={false} scale={0.9} accessibilityRole="tab" accessibilityLabel={name} style={{ width: w, height: H, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ alignItems: 'center', gap: 2 }, a]}>
        <Icon name={icon} size={23} color={C.brandDeep} />
        <Animated.Text style={{ fontSize: 10.5, fontWeight: '800', color: C.brandDeep }}>{name}</Animated.Text>
      </Animated.View>
    </Press>
  );
}

/** A floating pill. The highlight follows your finger while you swipe between pages. */
export function PillBar({ progress, width, go }: { progress: SharedValue<number>; width: number; go: (i: number) => void }) {
  const insets = useSafeAreaInsets();
  const inner = width - SIDE * 2 - GAP; const w = inner / TABS.length;
  const blob = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * w }] }));
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: SIDE, right: SIDE, bottom: Math.max(insets.bottom, 10) + 8 }}>
      <View style={{ height: H, borderRadius: H / 2, backgroundColor: C.pill, paddingHorizontal: GAP / 2, flexDirection: 'row', borderWidth: 1, borderColor: C.line, shadowColor: '#2B1B7A', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}>
        <Animated.View style={[{ position: 'absolute', left: GAP / 2, top: 7, width: w, height: H - 14, borderRadius: (H - 14) / 2, backgroundColor: C.tint }, blob]} />
        {TABS.map(([name, icon], i) => <Item key={name} i={i} name={name} icon={icon} progress={progress} w={w} onPress={() => { void Haptics.selectionAsync(); go(i); }} />)}
      </View>
    </View>
  );
}
