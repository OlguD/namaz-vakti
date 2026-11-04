import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { accuracyLevel, isMagneticInterference, smoothAngle } from './compass';
import type { CompassState } from './types';

/**
 * Native compass: expo-location heading (true north when the OS knows the
 * declination, else magnetic) smoothed on the circle, plus a magnetometer
 * watch that flags strong interference (magnetic cases, speakers, metal).
 */
export function useCompass(enabled = true): CompassState {
  const [state, setState] = useState<CompassState>({ status: 'starting', heading: null, accuracy: null, interference: false, trueNorth: false });
  const smoothed = useRef<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let headingSub: Location.LocationSubscription | null = null;
    let badSince: number | null = null;

    (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted' && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
        if (!alive) return;
        if (perm.status !== 'granted') {
          setState((s) => ({ ...s, status: 'denied' }));
          return;
        }
        headingSub = await Location.watchHeadingAsync((h) => {
          if (!alive) return;
          const useTrue = h.trueHeading != null && h.trueHeading >= 0;
          const raw = useTrue ? h.trueHeading : h.magHeading;
          if (raw == null || raw < 0) return;
          smoothed.current = smoothAngle(smoothed.current, raw);
          const heading = smoothed.current;
          setState((s) => ({ ...s, status: 'ok', heading, trueNorth: useTrue, accuracy: accuracyLevel(Platform.OS, h.accuracy) }));
        });
      } catch {
        if (alive) setState((s) => ({ ...s, status: 'unsupported' }));
      }
    })();

    Magnetometer.setUpdateInterval(500);
    const magSub = Magnetometer.addListener(({ x, y, z }) => {
      const bad = isMagneticInterference(x, y, z);
      const now = Date.now();
      if (bad) badSince ??= now;
      else badSince = null;
      // Only report after it persists, so waving the phone near a key doesn't flicker.
      const interference = badSince != null && now - badSince > 1500;
      setState((s) => (s.interference === interference ? s : { ...s, interference }));
    });

    return () => {
      alive = false;
      headingSub?.remove();
      magSub.remove();
    };
  }, [enabled, attempt]);

  return { ...state, retry };
}
