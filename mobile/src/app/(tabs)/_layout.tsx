import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui';
import { C } from '../../lib/theme';

const TAB = (name: string, title: string, icon: string) => (
  <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Icon name={icon} size={24} color={String(color)} /> }} />
);
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenListeners={{ tabPress: () => { void Haptics.selectionAsync(); } }}
      screenOptions={{
        headerShown: false, tabBarActiveTintColor: C.brandDeep, tabBarInactiveTintColor: C.muted, lazy: true,
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700' },
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: C.line, height: 58 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 6 : 0) },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      {TAB('index', 'Home', 'home')}{TAB('my-space', 'My Space', 'heart')}{TAB('agents', 'Agents', 'star')}{TAB('call', 'Call', 'phone')}
    </Tabs>
  );
}
