import { useQuery } from '@tanstack/react-query';
import { get } from '@/api/client';
import type { District, LocationEntry } from '@/api/types';
import { kv } from '@/lib/storage';
import type { SavedPlace } from './store';

/** The location directory changes rarely: cache for a day, keep on disk. */
const DAY = 24 * 3600_000;

export function useCountries() {
  return useQuery({
    queryKey: ['location', 'countries'],
    queryFn: () => get<LocationEntry[]>('/locations/countries'),
    staleTime: DAY,
  });
}

export function useCities(countryId: string | null) {
  return useQuery({
    queryKey: ['location', 'cities', countryId],
    queryFn: () => get<LocationEntry[]>(`/locations/countries/${encodeURIComponent(countryId!)}/cities`),
    enabled: !!countryId,
    staleTime: DAY,
  });
}

export function useDistricts(cityId: string | null) {
  return useQuery({
    queryKey: ['location', 'districts', cityId],
    queryFn: () => get<LocationEntry[]>(`/locations/cities/${encodeURIComponent(cityId!)}/districts`),
    enabled: !!cityId,
    staleTime: DAY,
  });
}

export function fetchDistrict(id: string): Promise<District> {
  return get<District>(`/locations/districts/${encodeURIComponent(id)}`);
}

// --- Recently used places (device only) ---------------------------------------

const RECENTS_KEY = 'vakit.recent-places';

export async function loadRecents(): Promise<SavedPlace[]> {
  return (await kv.get<SavedPlace[]>(RECENTS_KEY)) ?? [];
}

export async function pushRecent(place: SavedPlace): Promise<void> {
  if (!place.districtId) return;
  const list = (await loadRecents()).filter((p) => p.districtId !== place.districtId);
  await kv.set(RECENTS_KEY, [place, ...list].slice(0, 5));
}

/** Turkish-aware, accent-insensitive match ("kadikoy" finds "Kadıköy"). */
export function matches(name: string, query: string): boolean {
  const q = fold(query.trim());
  return !q || fold(name).includes(q);
}

export function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[âáà]/g, 'a')
    .replace(/[îí]/g, 'i')
    .replace(/[ûú]/g, 'u');
}
