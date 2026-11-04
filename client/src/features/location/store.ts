import * as Location from 'expo-location';
import { create } from 'zustand';
import { get } from '@/api/client';
import type { District, NearestDistrict } from '@/api/types';
import { KEYS, kv } from '@/lib/storage';
import { titleTr } from '@/lib/text';

/**
 * The place prayer times are shown for. Stored on the device (it is needed
 * before the network answers) and mirrored to the account's settings.
 */
export interface SavedPlace {
  mode: 'auto' | 'manual';
  districtId: string | null;
  /** Display name: the district, or "Konumunuz" for raw coordinates. */
  name: string;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  updatedAt: number;
}

interface PlaceState {
  place: SavedPlace | null;
  hydrated: boolean;
  detecting: boolean;
  permission: Location.PermissionStatus | null;
}

export const usePlace = create<PlaceState>(() => ({
  place: null,
  hydrated: false,
  detecting: false,
  permission: null,
}));

export async function hydratePlace(): Promise<void> {
  const place = await kv.get<SavedPlace>(KEYS.location);
  usePlace.setState({ place, hydrated: true });
}

export async function savePlace(place: SavedPlace): Promise<void> {
  usePlace.setState({ place });
  await kv.set(KEYS.location, place);
}

export function placeFromDistrict(d: District, mode: SavedPlace['mode']): SavedPlace {
  return {
    mode,
    districtId: d.id,
    name: titleTr(d.name),
    city: d.city?.name ? titleTr(d.city.name) : null,
    country: d.country?.name ? titleTr(d.country.name) : null,
    lat: d.location?.lat ?? null,
    lng: d.location?.lng ?? null,
    timezone: d.timezone,
    updatedAt: Date.now(),
  };
}

export type DetectResult =
  | { ok: true; place: SavedPlace }
  | { ok: false; reason: 'denied' | 'unavailable' | 'error' };

/** Asks for permission (if needed), reads GPS and resolves the nearest district. */
export async function detectPlace(): Promise<DetectResult> {
  usePlace.setState({ detecting: true });
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted' && perm.canAskAgain) {
      perm = await Location.requestForegroundPermissionsAsync();
    }
    usePlace.setState({ permission: perm.status });
    if (perm.status !== 'granted') return { ok: false, reason: 'denied' };

    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 }).catch(() => null)) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const lat = round(pos.coords.latitude);
    const lng = round(pos.coords.longitude);
    const nearest = await get<NearestDistrict | null>('/locations/nearest', { lat, lng }).catch(() => null);
    const place: SavedPlace = nearest
      ? { ...placeFromDistrict(nearest.district, 'auto'), lat, lng }
      : { mode: 'auto', districtId: null, name: 'Konumunuz', city: null, country: null, lat, lng, timezone: null, updatedAt: Date.now() };
    await savePlace(place);
    return { ok: true, place };
  } catch {
    return { ok: false, reason: 'unavailable' };
  } finally {
    usePlace.setState({ detecting: false });
  }
}

/** ~1 km precision is plenty for prayer times and keeps the exact position private. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
