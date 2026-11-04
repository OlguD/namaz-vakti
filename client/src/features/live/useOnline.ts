import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Device connectivity as React Query sees it (wired to expo-network / the DOM). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}
