import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { mateImg } from '../lib/mates';
import { C, R, SHADOW } from '../lib/theme';

const ICONS: Record<string, string> = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  heart: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z',
  star: 'M12 3l2.5 5.5 5.5.8-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.5-.8z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  hangup: 'M3 14c4-4 14-4 18 0l-3 3-3-2v-2a10 10 0 0 0-6 0v2l-3 2z',
  back: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  send: 'M5 12l14-7-5 14-3-6z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  micoff: 'M3 3l18 18M9 9v3a3 3 0 0 0 5 2M15 10V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11 5.7M12 18v3',
  speaker: 'M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M8 14h8',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chat: 'M21 12a8 8 0 0 1-11.5 7.2L4 20l1.1-4.3A8 8 0 1 1 21 12z',
  chevron: 'M6 9l6 6 6-6',
  check: 'M5 12l5 5 9-10',
  pin: 'M9 4h6l-1 5 3 3H7l3-3zM12 12v8',
  circle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  circlehalf: 'M12 4a8 8 0 1 0 0 16zM12 4v16',
  circlecheck: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM8.5 12l2.5 2.5 4.5-5',
  clip: 'M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.3 3.3 0 0 1 4.7 4.7L10 18.4a1.7 1.7 0 0 1-2.4-2.4L15 8.6',
  close: 'M6 6l12 12M18 6L6 18',
};

export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <Path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <Path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </Svg>
  );
}

export function Icon({ name, size = 22, color = C.ink, stroke = 2 }: { name: keyof typeof ICONS | string; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d={ICONS[name] ?? ICONS.star} />
    </Svg>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** A pressable that gives a soft spring scale and a light haptic, all on the UI thread. */
export function Press({ children, style, haptic = true, scale = 0.96, onPress, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; scale?: number; children?: ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={() => { s.value = withTiming(scale, { duration: 90, easing: Easing.out(Easing.quad) }); }}
      onPressOut={() => { s.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }); }}
      onPress={(e) => { if (haptic) void Haptics.selectionAsync(); onPress?.(e); }}
      style={[style, a]}
    >{children}</AnimatedPressable>
  );
}

export function Avatar({ k, size = 40, dim }: { k: string; size?: number; dim?: boolean }) {
  return <Image source={mateImg(k)} style={{ width: size, height: size, opacity: dim ? 0.5 : 1 }} contentFit="contain" transition={120} />;
}

export function Btn({ label, onPress, kind = 'primary', icon, disabled, busy, style, small }: { label?: string; onPress?: () => void; kind?: 'primary' | 'soft' | 'ghost' | 'danger'; icon?: string; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const bg = kind === 'primary' ? C.brand : kind === 'soft' ? C.tint : kind === 'danger' ? C.bad : C.card;
  const fg = kind === 'primary' || kind === 'danger' ? '#fff' : C.brandDeep;
  return (
    <Press onPress={disabled || busy ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label} style={[{ minHeight: small ? 40 : 48, paddingHorizontal: label ? 18 : 0, width: label ? undefined : small ? 40 : 48, borderRadius: R.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: disabled ? 0.5 : 1, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: C.line2 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      {label ? <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{label}</Text> : null}
    </Press>
  );
}

export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[{ backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, ...SHADOW }, style]}>{children}</View>;
export const Chip = ({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) => (
  <Press onPress={onPress} style={{ paddingHorizontal: 14, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? C.tint : C.card, borderWidth: on ? 0 : 1, borderColor: C.line2 }}>
    <Text style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? C.brandDeep : C.ink2 }}>{label}</Text>
  </Press>
);
export const Caption = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[{ fontSize: 12, fontWeight: '700', letterSpacing: 1, color: C.muted }, style]}>{children}</Text>;
export const Title = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <View><Text style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.4, color: C.ink }}>{children}</Text>{sub ? <Text style={{ fontSize: 13.5, color: C.muted, marginTop: 2 }}>{sub}</Text> : null}</View>
);
export const ErrorNote = ({ message, onRetry }: { message?: string | null; onRetry?: () => void }) => message ? (
  <View style={{ backgroundColor: C.badBg, borderRadius: R.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <Text style={{ flex: 1, color: C.bad, fontSize: 13.5 }}>{message}</Text>{onRetry ? <Press onPress={onRetry}><Text style={{ color: C.bad, fontWeight: '700' }}>Retry</Text></Press> : null}
  </View>) : null;
export const Empty = ({ text }: { text: string }) => <View style={{ padding: 32, alignItems: 'center' }}><Text style={{ color: C.muted, textAlign: 'center', fontSize: 14 }}>{text}</Text></View>;
export const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: C.bg } });
