import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R } from '../lib/theme';
import { Btn, Caption, Icon, Press } from './ui';

export function Screen({ title, sub, right, children, scroll = true, onRefresh, refreshing }: { title: string; sub?: string; right?: ReactNode; children: ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean }) {
  const insets = useSafeAreaInsets(); const router = useRouter();
  void onRefresh; void refreshing;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8 }}>
        <Press onPress={() => router.back()} accessibilityLabel="Back" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={22} /></Press>
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontSize: 22, fontWeight: '800', color: C.ink }}>{title}</Text>{sub ? <Text numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{sub}</Text> : null}</View>
        {right}
      </View>
      {scroll ? <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={{ flex: 1 }}>{children}</View>}
    </View>
  );
}

export function Field({ label, ...p }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Caption>{label.toUpperCase()}</Caption>
      <TextInput placeholderTextColor={C.muted} {...p} accessibilityLabel={label} style={[{ minHeight: 48, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, paddingHorizontal: 14, fontSize: 15, color: C.ink }, p.multiline ? { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' } : null, p.style]} />
    </View>
  );
}

export function Sheet({ visible, onClose, title, children, onSave, saveLabel = 'Save', busy, canSave = true }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; onSave?: () => void; saveLabel?: string; busy?: boolean; canSave?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <Press onPress={onClose} haptic={false} scale={1} style={{ flex: 1 }} accessibilityLabel="Close"><View /></Press>
        <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingBottom: insets.bottom + 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{title}</Text>
            <Press onPress={onClose} accessibilityLabel="Close" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={20} /></Press>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 12 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {onSave ? <View style={{ paddingHorizontal: 16, paddingTop: 6 }}><Btn label={saveLabel} onPress={onSave} busy={busy} disabled={!canSave} /></View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const Pill = ({ label, tone = 'muted' }: { label: string; tone?: 'ok' | 'bad' | 'warn' | 'live' | 'muted' }) => {
  const [fg, bg] = tone === 'ok' ? [C.good, C.goodBg] : tone === 'bad' ? [C.bad, C.badBg] : tone === 'warn' ? [C.warn, C.warnBg] : tone === 'live' ? [C.brandDeep, C.tint] : [C.ink2, C.soft];
  return <Text style={{ fontSize: 11.5, fontWeight: '800', color: fg, backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' }}>{label}</Text>;
};

export const Row = ({ children, onPress, onLongPress, style }: { children: ReactNode; onPress?: () => void; onLongPress?: () => void; style?: object }) => (
  <Press onPress={onPress} onLongPress={onLongPress} haptic={!!onPress} scale={onPress ? 0.98 : 1} style={[{ backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>{children}</Press>
);
