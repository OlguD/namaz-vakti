import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { put } from '@/api/client';
import { PLATFORM } from '@/api/config';
import { useSession } from '@/auth/session';
import { usePlace } from '@/features/location/store';
import { usePrayerTimes } from '@/features/prayer/api';
import { useSettings } from '@/features/settings/api';
import { applyPlan, getPushToken, installationId, IS_SUPPORTED } from './native';
import { buildPlan } from './schedule';

if (IS_SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Mounted once in the root layout; renders nothing.
 * - keeps the local prayer-time notifications in sync with times + settings
 * - registers this install for push (live streams, announcements)
 * - opens the right screen when a notification is tapped
 */
export function NotificationsBridge() {
  if (!IS_SUPPORTED) return null;
  return <Bridge />;
}

function Bridge() {
  const router = useRouter();
  const settings = useSettings();
  const place = usePlace((s) => s.place);
  const { data } = usePrayerTimes();
  const userId = useSession((s) => s.user?.id ?? null);
  const [foreground, setForeground] = useState(0);

  // Rebuild the rolling window each time the app comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setForeground((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // 1) Local prayer-time notifications.
  const running = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (!data?.days?.length) return;
    const plan = buildPlan(data.days, settings, { placeName: place?.name });
    const t = setTimeout(() => {
      const run = (running.current ?? Promise.resolve()).then(() => applyPlan(plan)).catch(() => {});
      running.current = run;
    }, 800);
    return () => clearTimeout(t);
  }, [data, settings.prayerNotifications, settings.reminders, place?.name, foreground]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Push registration (per account; the token can change between launches).
  const liveAlerts = settings.reminders.haramainLive;
  const districtId = place?.districtId ?? null;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void (async () => {
      const [id, token] = await Promise.all([installationId(), getPushToken()]);
      if (!alive || !id) return;
      const version = Constants.expoConfig?.version;
      await put(`/me/devices/${encodeURIComponent(id)}`, {
        platform: PLATFORM,
        pushToken: token,
        locale: 'tr',
        ...(version && /^\d+\.\d+\.\d+/.test(version) ? { appVersion: version } : {}),
        districtId,
        liveAlerts,
      }).catch(() => {});
    })();
    return () => {
      alive = false;
    };
  }, [userId, liveAlerts, districtId, foreground]);

  // 3) Taps.
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const url = response.notification.request.content.data?.url;
    router.push((typeof url === 'string' && url.startsWith('/') ? url : '/') as Href);
  }, [response, router]);

  return null;
}
