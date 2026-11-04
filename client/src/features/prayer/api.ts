import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { get } from '@/api/client';
import type { PrayerTimesResult, Qibla } from '@/api/types';
import { usePlace, type SavedPlace } from '@/features/location/store';
import { vakitState, type VakitState } from '@/lib/prayer';

export const prayerKey = (place: SavedPlace | null, days: number, from?: string) =>
  ['prayer-times', place?.districtId ?? `${place?.lat},${place?.lng}`, days, from ?? 'today'] as const;

export function fetchPrayerTimes(place: SavedPlace, days = 30, from?: string): Promise<PrayerTimesResult> {
  if (place.districtId) {
    return get<PrayerTimesResult>(`/prayer-times/districts/${encodeURIComponent(place.districtId)}`, { days, from });
  }
  return get<PrayerTimesResult>('/prayer-times/nearby', { lat: place.lat, lng: place.lng, days });
}

/** Prayer times for the saved place. Cached on disk; refreshed every 6 h. */
export function usePrayerTimes(days = 30, from?: string) {
  const place = usePlace((s) => s.place);
  return useQuery({
    queryKey: prayerKey(place, days, from),
    queryFn: () => fetchPrayerTimes(place!, days, from),
    enabled: !!place && (!!place.districtId || place.lat != null),
    staleTime: 6 * 3600_000,
    placeholderData: (prev) => prev,
  });
}

/** Re-renders every `intervalMs` (default 1 s) with the current time. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Current / next vakit, ticking once a second. */
export function useVakitState(): VakitState & { data: PrayerTimesResult | undefined; isLoading: boolean; isError: boolean; refetch: () => void; isFetching: boolean } {
  const q = usePrayerTimes();
  const now = useNow();
  const state = vakitState(q.data?.days ?? [], now);
  return { ...state, data: q.data, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch, isFetching: q.isFetching };
}

export function useQibla() {
  const place = usePlace((s) => s.place);
  return useQuery({
    queryKey: ['qibla', place?.lat, place?.lng],
    queryFn: () => get<Qibla>('/locations/qibla', { lat: place!.lat, lng: place!.lng }),
    enabled: place?.lat != null && place?.lng != null,
    staleTime: Infinity,
  });
}
