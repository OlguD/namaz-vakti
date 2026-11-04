import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { get, post } from '@/api/client';

/** GET /v1/mosques/nearby and /v1/mosques/:id (backend MosqueView). */
export interface Mosque {
  id: string;
  name: string | null;
  nameEn: string | null;
  nameAr: string | null;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
  phone: string | null;
  /** OSM wheelchair tag: yes / limited / no. */
  wheelchair: string | null;
  source: 'osm' | 'user';
  /** Only on /nearby. */
  distanceM?: number;
}

export interface NearbyMosques {
  mosques: Mosque[];
  /** Some of the area is still being imported: ask again in a few seconds. */
  partial: boolean;
  attribution: string;
}

export type SuggestionKind = 'add' | 'edit' | 'closed';

export interface SuggestionInput {
  kind: SuggestionKind;
  mosqueId?: string;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  note?: string;
}

/** Rounded to ~100 m so small GPS jitter reuses the cached answer. */
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function useNearbyMosques(center: { lat: number; lng: number } | null, radius = 3000) {
  const lat = center ? r3(center.lat) : null;
  const lng = center ? r3(center.lng) : null;
  return useQuery({
    queryKey: ['mosques', 'nearby', lat, lng, radius],
    queryFn: () => get<NearbyMosques>('/mosques/nearby', { lat, lng, radius, limit: 100 }, { auth: false }),
    enabled: lat != null && lng != null,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    // A fresh area is imported on demand: poll while the API says it's partial.
    refetchInterval: (q) => (q.state.data?.partial ? 4000 : false),
  });
}

export function useMosque(id: string | undefined) {
  return useQuery({
    queryKey: ['mosques', 'one', id],
    queryFn: () => get<Mosque>(`/mosques/${encodeURIComponent(id!)}`, undefined, { auth: false }),
    enabled: !!id,
    staleTime: 60 * 60_000,
  });
}

export function useSuggestMosque() {
  return useMutation({
    mutationFn: (input: SuggestionInput) => post<{ id: string }>('/mosques/suggestions', input),
  });
}

export function mosqueName(m: Pick<Mosque, 'name' | 'nameEn'>): string {
  return m.name ?? m.nameEn ?? 'Adsız cami';
}
