import { useCallback, useEffect, useRef, useState } from 'react';
import { normalize, smoothAngle } from './compass';
import type { CompassState } from './types';

type OrientationEvt = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Browser compass via DeviceOrientation. iOS Safari reports
 * `webkitCompassHeading` (and needs permission from a tap); Chrome on
 * Android fires `deviceorientationabsolute`. Desktops fire nothing, so after
 * a short wait the status becomes 'unsupported' and the screen shows the
 * static bearing instead.
 */
export function useCompass(enabled = true): CompassState {
  // Desktops (no touch) have no compass: skip the permission prompt entirely.
  const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
  const needsPermission =
    touch &&
    typeof window !== 'undefined' &&
    typeof (window as unknown as { DeviceOrientationEvent?: PermissionApi }).DeviceOrientationEvent?.requestPermission === 'function';
  const [state, setState] = useState<CompassState>({
    status: !touch ? 'unsupported' : needsPermission ? 'needs-permission' : 'starting',
    heading: null,
    accuracy: null,
    interference: false,
    trueNorth: false,
  });
  const smoothed = useRef<number | null>(null);
  const [granted, setGranted] = useState(!needsPermission);

  const retry = useCallback(() => {
    const api = (window as unknown as { DeviceOrientationEvent?: PermissionApi }).DeviceOrientationEvent;
    if (!api?.requestPermission) {
      setGranted(true);
      return;
    }
    api
      .requestPermission()
      .then((r) => {
        if (r === 'granted') {
          setState((s) => ({ ...s, status: 'starting' }));
          setGranted(true);
        }
        else setState((s) => ({ ...s, status: 'denied' }));
      })
      .catch(() => setState((s) => ({ ...s, status: 'denied' })));
  }, []);

  useEffect(() => {
    if (!enabled || !granted || !touch || typeof window === 'undefined') return;
    let got = false;

    const onEvent = (e: Event) => {
      const ev = e as OrientationEvt;
      let raw: number | null = null;
      let accuracy: CompassState['accuracy'] = null;
      if (typeof ev.webkitCompassHeading === 'number' && ev.webkitCompassHeading >= 0) {
        raw = ev.webkitCompassHeading;
        const acc = ev.webkitCompassAccuracy ?? -1;
        accuracy = acc < 0 || acc > 25 ? 'low' : acc > 12 ? 'medium' : 'high';
      } else if (ev.absolute && typeof ev.alpha === 'number') {
        raw = normalize(360 - ev.alpha);
        accuracy = 'medium';
      }
      if (raw == null) return;
      got = true;
      smoothed.current = smoothAngle(smoothed.current, raw);
      const heading = smoothed.current;
      setState((s) => ({ ...s, status: 'ok', heading, accuracy }));
    };

    // Chrome (Android) fires the absolute variant; Safari only the plain one
    // (with webkitCompassHeading). Listen to both; relative-only events are ignored.
    const names = ['deviceorientationabsolute', 'deviceorientation'] as const;
    for (const n of names) window.addEventListener(n, onEvent, true);
    const timer = setTimeout(() => {
      if (!got) setState((s) => ({ ...s, status: 'unsupported' }));
    }, 1500);
    return () => {
      clearTimeout(timer);
      for (const n of names) window.removeEventListener(n, onEvent, true);
    };
  }, [enabled, granted, touch]);

  return { ...state, retry };
}
