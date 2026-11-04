import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Small JSON key-value store (AsyncStorage on native, localStorage on web). */
export const kv = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable (private mode): the app keeps working without it.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/**
 * Secrets (the refresh token). Keychain / Keystore on native. On web the
 * refresh token lives in an httpOnly cookie the page cannot read, so nothing
 * is stored here.
 */
export const secrets = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string | null): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      if (value == null) await SecureStore.deleteItemAsync(key);
      else
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });
    } catch {
      // ignore
    }
  },
};

export const KEYS = {
  refreshToken: 'vakit.refresh',
  installationId: 'vakit.installation',
  location: 'vakit.location',
  onboarded: 'vakit.onboarded',
  dhikrQueue: 'vakit.dhikr.queue',
  queryCache: 'vakit.query-cache',
  chatRulesAccepted: 'vakit.chat.rules',
  /** Web only: a refresh cookie was issued (avoids a pointless 401 on first visit). */
  webSession: 'vakit.web-session',
} as const;
