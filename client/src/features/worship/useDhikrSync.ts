import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { flushDhikr, hydrateDhikrQueue } from './dhikrQueue';

/**
 * Keeps the dhikr queue flowing: uploads on mount, when the app returns to
 * the foreground or goes to the background, when the network comes back and
 * on unmount (leaving the screen). Mount it on every screen that counts.
 */
export function useDhikrSync(): void {
  useEffect(() => {
    void hydrateDhikrQueue().then(() => flushDhikr());
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active' || s === 'background') void flushDhikr();
    });
    const net = onlineManager.subscribe((online) => {
      if (online) void flushDhikr();
    });
    return () => {
      app.remove();
      net();
      void flushDhikr();
    };
  }, []);
}
