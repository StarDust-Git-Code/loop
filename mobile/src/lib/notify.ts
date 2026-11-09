import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as TaskManager from 'expo-task-manager';
import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Constants from 'expo-constants';
import { api, registerDevice } from './api';
import { firebaseAuth } from './auth';
import type { Run } from './types';

const TASK = 'loopmates-run-watch';
const SEEN = 'runSeen';
export const getNotifyEnabled = async () => (await AsyncStorage.getItem('notifyEnabled')) !== 'off';
export const setNotifyEnabled = (on: boolean) => AsyncStorage.setItem('notifyEnabled', on ? 'on' : 'off');

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

/** Looks at your runs and raises a notification when one needs approval or has just finished. Returns how many it raised. */
export async function checkRuns(): Promise<number> {
  if (!(await getNotifyEnabled())) return 0;
  const auth = firebaseAuth(); await auth.authStateReady(); if (!auth.currentUser) return 0;
  const runs: Run[] = await api.runs.list();
  const seen: Record<string, string> = JSON.parse((await AsyncStorage.getItem(SEEN)) ?? '{}');
  const first = Object.keys(seen).length === 0; let n = 0;
  for (const r of runs) {
    const prev = seen[r.id];
    const needs = r.status === 'waiting_approval' && prev !== 'waiting_approval';
    const finished = (r.status === 'done' || r.status === 'failed') && !!prev && prev !== 'done' && prev !== 'failed';
    if (!first && (needs || finished)) {
      n++;
      await Notifications.scheduleNotificationAsync({ content: { title: needs ? 'Approval needed' : r.status === 'done' ? 'Run finished' : 'Run failed', body: r.title, data: { runId: r.id, mate: r.steps[0]?.mate ?? 'planner' }, categoryIdentifier: 'run' }, trigger: null });
    }
    seen[r.id] = r.status;
  }
  await AsyncStorage.setItem(SEEN, JSON.stringify(seen));
  return n;
}

TaskManager.defineTask(TASK, async () => {
  try { await checkRuns(); return BackgroundTask.BackgroundTaskResult.Success; } catch { return BackgroundTask.BackgroundTaskResult.Failed; }
});

function open(data: Record<string, unknown> | undefined, action: string) {
  const url = String(data?.url ?? '');
  // Server push: url is a dashboard link (/call?mate=..&call=..&reason=.., /run?id=.., /chat?c=..).
  const q = url.includes('?') ? Object.fromEntries(new URLSearchParams(url.split('?')[1])) : {};
  if (/\/call\b/.test(url)) router.navigate({ pathname: '/', params: { tab: 'call', mate: q.mate ?? '', call: q.call, reason: q.reason } });
  else if (/\/run\b/.test(url) && q.id) router.push(`/runs/${q.id}`);
  else if (/\/chat\b/.test(url) && q.c) router.push(`/chat/${q.c}`);
  else if (action === 'call') router.navigate({ pathname: '/', params: { tab: 'call', mate: String(data?.mate ?? '') } });
  else if (data?.runId) router.push(`/runs/${String(data.runId)}`);
}

/** Register this phone for server push (Expo's free push service). Needs an EAS project id; without one the 15-minute check still works. */
async function registerPush() {
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerDevice(data, `${Constants.deviceName ?? 'Phone'}`);
}

export function useNotificationSetup(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn || Platform.OS !== 'android') return;
    let timer: ReturnType<typeof setInterval> | undefined; let alive = true;
    (async () => {
      try {
        await Notifications.setNotificationChannelAsync('default', { name: 'Runs and approvals', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 100, 200] });
        await Notifications.setNotificationChannelAsync('calls', { name: 'Calls from your Mates', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 400, 200, 400, 200, 400], sound: 'default' });
        await Notifications.setNotificationCategoryAsync('run', [
          { identifier: 'open', buttonTitle: 'Open', options: { opensAppToForeground: true } },
          { identifier: 'call', buttonTitle: 'Call', options: { opensAppToForeground: true } },
        ]);
        if (Platform.Version >= 33) await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
        await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
        if (await getNotifyEnabled()) await registerPush().catch(() => undefined);
      } catch { /* notifications are optional */ }
      if (!alive) return;
      void checkRuns().catch(() => undefined);
      timer = setInterval(() => { void checkRuns().catch(() => undefined); }, 25_000);
    })();
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data as Record<string, unknown>, r.actionIdentifier));
    void Notifications.getLastNotificationResponseAsync().then((r) => { if (r) open(r.notification.request.content.data as Record<string, unknown>, r.actionIdentifier); });
    return () => { alive = false; if (timer) clearInterval(timer); sub.remove(); };
  }, [signedIn]);
}
