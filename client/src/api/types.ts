/**
 * Response shapes of the backend (src/ in the API project). Request bodies are
 * typed next to the functions that send them in ./endpoints.
 */
import type { PrayerDay, Vakit } from '@/lib/prayer';

export type UserKind = 'anonymous' | 'registered';

export interface User {
  id: string;
  kind: UserKind;
  role: 'user' | 'moderator' | 'admin';
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  locale: string;
  districtId: string | null;
  providers: ('apple' | 'google' | 'email')[];
  chatMutedUntil: string | null;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  /** null on web: it is set as an httpOnly cookie instead. */
  refreshToken: string | null;
  refreshTokenExpiresAt: string;
}

export interface AuthResponse {
  tokens: TokenPair;
  user: User;
}

// --- Locations & prayer times ------------------------------------------------

export interface LocationEntry {
  id: string;
  name: string;
  nameEn: string;
}

export interface Named {
  id: string;
  name: string;
  nameEn: string;
}

export interface District extends Named {
  city: Named;
  country: Named;
  location: { lat: number; lng: number } | null;
  timezone: string | null;
}

export interface NearestDistrict {
  district: District;
  distanceKm: number;
}

export interface PrayerTimesResult {
  district: District | null;
  location: { lat: number; lng: number } | null;
  timezone: string | null;
  source: 'emushaf' | 'diyanet' | 'calculated';
  stale: boolean;
  days: PrayerDay[];
}

export interface Qibla {
  bearing: number;
  distanceKm: number;
  kaaba: { lat: number; lng: number };
}

// --- Settings ----------------------------------------------------------------

export type AdhanSound = 'mekke' | 'medine' | 'istanbul' | 'kisa' | 'cansesi' | 'sessiz';

export interface PrayerNotificationSetting {
  enabled: boolean;
  remindBeforeMinutes: number;
  sound: AdhanSound;
}

export interface SettingsData {
  theme: 'system' | 'dark' | 'light';
  language: 'tr' | 'en' | 'ar';
  location: { mode: 'auto' | 'manual'; districtId: string | null };
  prayerNotifications: Record<Vakit, PrayerNotificationSetting>;
  reminders: {
    iftar: boolean;
    sahur: boolean;
    haramainLive: boolean;
    dailyQuran: boolean;
    friday: boolean;
  };
  holyDayReminders: Record<string, boolean>;
  favorites: { duas: string[]; esma: number[] };
  zikirmatik: {
    lastDhikrKey: string | null;
    target: number;
    view: 'ring' | 'beads';
    haptics: boolean;
    nightMode: boolean;
  };
}

export interface SettingsDocument {
  version: number;
  data: SettingsData;
  updatedAt: string | null;
}
