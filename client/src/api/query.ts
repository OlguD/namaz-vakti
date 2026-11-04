import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';
import { KEYS } from '@/lib/storage';
import { isApiError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Keep data around for offline launches (the persisted cache uses it).
      gcTime: 7 * 24 * 3600_000,
      retry: (count, e) => {
        if (isApiError(e) && e.isClientError) return false;
        return count < 2;
      },
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: false,
    },
  },
});

/** Persists successful queries so the app opens instantly, also offline. */
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: KEYS.queryCache,
  throttleTime: 2000,
});

/** Query keys that are safe and useful to keep on disk between launches. */
const PERSISTED_ROOTS = new Set([
  'prayer-times',
  'location',
  'qibla',
  'settings',
  'me',
  'content',
  'worship',
  'quran',
  'live',
  'chat-rooms',
]);

export function shouldPersist(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === 'string' && PERSISTED_ROOTS.has(queryKey[0]);
}

/** Wire React Query's online/focus state to the device (no-op on web: it uses the DOM). */
export function setupQueryEnvironment(): () => void {
  if (Platform.OS === 'web') return () => {};
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((state) => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => sub.remove();
  });
  const sub = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
  return () => sub.remove();
}
