/**
 * Expo-notifications side effects: permission, Android channels, applying the
 * plan, push token. Everything is a no-op on web.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';
import type { AdhanSound } from '@/api/types';
import { SOUND_LABEL, SOUNDS, type PermissionState } from './sounds';
import { KEYS, kv } from '@/lib/storage';
import { channelFor, ID_PREFIX, planSignature, type PlannedNotification } from './schedule';

export const IS_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';
export type { PermissionState } from './sounds';

/**
 * Bundled audio per sound. Until the adhan recordings are added as assets
 * (and listed in the expo-notifications plugin `sounds` option) every
 * audible sound uses the system tone.
 */
const SOUND_FILES: Partial<Record<AdhanSound, string>> = {};

function soundFor(sound: AdhanSound): string | boolean {
  if (sound === 'sessiz') return false;
  return SOUND_FILES[sound] ?? 'default';
}

const SIG_KEY = 'vakit.notify.signature';


export async function getNotificationPermission(): Promise<PermissionState> {
  if (!IS_SUPPORTED) return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** Asks for permission (used by onboarding and settings). Resolves true when allowed. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!IS_SUPPORTED) return false;
  try {
    await ensureChannels();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return res.granted;
  } catch {
    return false;
  }
}

let channelsReady = false;
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android' || channelsReady) return;
  await Promise.all(
    SOUNDS.map((s) =>
      Notifications.setNotificationChannelAsync(channelFor(s), {
        name: `Vakit bildirimleri · ${SOUND_LABEL[s]}`,
        importance: s === 'sessiz' ? AndroidImportance.DEFAULT : AndroidImportance.HIGH,
        sound: s === 'sessiz' ? null : (SOUND_FILES[s] ?? 'default'),
        enableVibrate: s !== 'sessiz',
        lightColor: '#C9A96E',
        lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      }),
    ),
  );
  channelsReady = true;
}

/**
 * Replaces our pending notifications with the plan. Only touches ids we own
 * (prefix), so other features' notifications survive. Skips work when the
 * plan is identical to the last one applied.
 */
export async function applyPlan(plan: readonly PlannedNotification[]): Promise<void> {
  if (!IS_SUPPORTED) return;
  if ((await getNotificationPermission()) !== 'granted') return;
  const sig = planSignature(plan);
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const ours = pending.filter((n) => n.identifier.startsWith(ID_PREFIX));
  if (sig === (await kv.get<string>(SIG_KEY)) && ours.length === plan.length) return;

  await ensureChannels();
  await Promise.all(ours.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  for (const p of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: p.title,
        body: p.body,
        sound: soundFor(p.sound),
        data: { url: p.url, kind: p.kind },
        ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.at,
        channelId: channelFor(p.sound),
      },
    });
  }
  await kv.set(SIG_KEY, sig);
}

export async function clearPlan(): Promise<void> {
  if (!IS_SUPPORTED) return;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending.filter((n) => n.identifier.startsWith(ID_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  await kv.remove(SIG_KEY);
}

/** Expo push token, or null when push is not configured (no EAS project id) or not allowed. */
export async function getPushToken(): Promise<string | null> {
  if (!IS_SUPPORTED) return null;
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  if ((await getNotificationPermission()) !== 'granted') return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

export async function installationId(): Promise<string | null> {
  return kv.get<string>(KEYS.installationId);
}
