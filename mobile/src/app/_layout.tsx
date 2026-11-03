import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { useNotificationSetup } from '../lib/notify';
import { C } from '../lib/theme';
import { ThemeProvider } from '../lib/themeContext';

void SplashScreen.preventAutoHideAsync();

function Gate() {
  const { ready, user } = useAuth();
  const seg = useSegments();
  const router = useRouter();
  useNotificationSetup(!!user);
  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
    const onSignIn = seg[0] === 'sign-in';
    if (!user && !onSignIn) router.replace('/sign-in');
    else if (user && onSignIn) router.replace('/');
  }, [ready, user, seg, router]);
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function Root() {
  return (
    <ThemeProvider>
      {(scheme) => (
        <GestureHandlerRootView key={scheme} style={{ flex: 1, backgroundColor: C.bg }}>
          <SafeAreaProvider>
            <AuthProvider><StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /><Gate /></AuthProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      )}
    </ThemeProvider>
  );
}
