import { Platform } from 'react-native';
import { create } from 'zustand';
import { kv } from '@/lib/storage';
import type { LiveStream } from './api';

/**
 * "Başladığında hatırlat" for upcoming streams. A local notification is
 * scheduled at the announced start time (native only); the set of reminded
 * streams is kept on the device.
 */
const KEY = 'vakit.live.reminders';

interface Reminder {
  videoId: string;
  /** Local notification id (native). */
  notificationId: string | null;
  at: string;
}

interface State {
  reminders: Record<string, Reminder>;
  hydrated: boolean;
}

export const useLiveReminders = create<State>(() => ({ reminders: {}, hydrated: false }));

export async function hydrateLiveReminders(): Promise<void> {
  if (useLiveReminders.getState().hydrated) return;
  const stored = (await kv.get<Record<string, Reminder>>(KEY)) ?? {};
  // Drop reminders whose start time has passed.
  const now = Date.now();
  const live = Object.fromEntries(Object.entries(stored).filter(([, r]) => new Date(r.at).getTime() > now - 3600_000));
  useLiveReminders.setState({ reminders: live, hydrated: true });
}

async function persist(): Promise<void> {
  await kv.set(KEY, useLiveReminders.getState().reminders);
}

export type ToggleResult = 'on' | 'off' | 'denied';

export async function toggleLiveReminder(stream: LiveStream): Promise<ToggleResult> {
  const current = useLiveReminders.getState().reminders[stream.videoId];
  if (current) {
    if (current.notificationId && Platform.OS !== 'web') {
      const Notifications = await import('expo-notifications');
      await Notifications.cancelScheduledNotificationAsync(current.notificationId).catch(() => {});
    }
    const { [stream.videoId]: _removed, ...rest } = useLiveReminders.getState().reminders;
    useLiveReminders.setState({ reminders: rest });
    await persist();
    return 'off';
  }

  let notificationId: string | null = null;
  const at = stream.scheduledStartAt ? new Date(stream.scheduledStartAt) : null;
  if (Platform.OS !== 'web' && at && at.getTime() > Date.now() + 30_000) {
    // Loaded lazily: importing expo-notifications on web logs a warning.
    const Notifications = await import('expo-notifications');
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Yayın başlıyor',
        body: `${stream.channel.title}: ${stream.title}`,
        data: { url: `/yayin/${stream.videoId}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    }).catch(() => null);
  }
  useLiveReminders.setState((s) => ({
    reminders: {
      ...s.reminders,
      [stream.videoId]: { videoId: stream.videoId, notificationId, at: stream.scheduledStartAt ?? new Date().toISOString() },
    },
  }));
  await persist();
  return 'on';
}
