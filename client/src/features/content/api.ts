import { useQuery } from '@tanstack/react-query';
import { get } from '@/api/client';
import type { SettingsData } from '@/api/types';
import { useSettings, useUpdateSettings } from '@/features/settings/api';
import type { ReligiousDayRow } from './holyDays';

// --- Types (backend src/content/content.service.ts) -------------------------

export interface DuaCategory {
  id: string;
  nameTr: string;
  nameEn: string | null;
  nameAr: string | null;
  icon: string | null;
  sortOrder: number;
  count: number;
}

export interface Dua {
  id: string;
  key: string;
  categoryId: string;
  title: string;
  arabic: string | null;
  transliteration: string | null;
  meaningTr: string;
  meaningEn: string | null;
  source: string | null;
  sortOrder: number;
  updatedAt: string;
}

export interface DuasResponse {
  categories: DuaCategory[];
  duas: Dua[];
}

export interface EsmaName {
  no: number;
  arabic: string;
  transliteration: string;
  meaningTr: string;
  meaningEn: string | null;
}

export interface ZakatRates {
  currency: string;
  goldGramPrice: number | null;
  silverGramPrice: number | null;
  goldNisabGrams: number;
  silverNisabGrams: number;
  nisabAmount: number | null;
  usdTry: number | null;
  source: 'auto' | 'manual';
  fetchedAt: string | null;
  stale: boolean;
  sources: string[];
  updatedAt: string | null;
}

// --- Queries ------------------------------------------------------------------
// Editorial content changes rarely: long stale times, cached on disk ('content').

export function useDuas() {
  return useQuery({
    queryKey: ['content', 'duas'],
    queryFn: () => get<DuasResponse>('/content/duas', undefined, { auth: false }),
    staleTime: 12 * 3600_000,
  });
}

export function useEsma() {
  return useQuery({
    queryKey: ['content', 'esma'],
    queryFn: () => get<EsmaName[]>('/content/esma', undefined, { auth: false }),
    staleTime: 24 * 3600_000,
  });
}

export function useReligiousDays() {
  return useQuery({
    queryKey: ['content', 'religious-days'],
    queryFn: () => get<ReligiousDayRow[]>('/content/religious-days', undefined, { auth: false }),
    staleTime: 12 * 3600_000,
  });
}

export function useZakatRates() {
  return useQuery({
    queryKey: ['content', 'zakat-rates'],
    queryFn: () => get<ZakatRates>('/content/zakat-rates', undefined, { auth: false }),
    staleTime: 3600_000,
  });
}

// --- Favourites & reminders (stored in the synced settings document) ---------------

export function useFavorites() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const { duas, esma } = settings.favorites;
  return {
    duas,
    esma,
    isDuaFav: (key: string) => duas.includes(key),
    isEsmaFav: (no: number) => esma.includes(no),
    // Changes are idempotent ("make it X", not "flip it"): the settings mutation
    // may apply the same change to an already-optimistic copy.
    toggleDua: (key: string) => {
      const want = !duas.includes(key);
      update.mutate((cur) => ({
        ...cur,
        favorites: { ...cur.favorites, duas: want ? [...cur.favorites.duas.filter((k) => k !== key), key] : cur.favorites.duas.filter((k) => k !== key) },
      }));
    },
    toggleEsma: (no: number) => {
      const want = !esma.includes(no);
      update.mutate((cur) => ({
        ...cur,
        favorites: {
          ...cur.favorites,
          esma: want ? [...cur.favorites.esma.filter((n) => n !== no), no].sort((a, b) => a - b) : cur.favorites.esma.filter((n) => n !== no),
        },
      }));
    },
  };
}

/**
 * Holy-day reminders are keyed by event key (e.g. "berat-kandili",
 * "ramazan-bayrami"), so a choice applies every year. Unset = on.
 */
export function isHolyDayReminderOn(settings: SettingsData, key: string): boolean {
  return settings.holyDayReminders[key] ?? true;
}

export function useHolyDayReminders() {
  const settings = useSettings();
  const update = useUpdateSettings();
  return {
    isOn: (key: string) => isHolyDayReminderOn(settings, key),
    set: (key: string, on: boolean) =>
      update.mutate((cur) => ({ ...cur, holyDayReminders: { ...cur.holyDayReminders, [key]: on } })),
  };
}
