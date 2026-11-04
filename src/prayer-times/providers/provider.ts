/**
 * Contract every upstream prayer-times source implements. Swapping Emushaf for the
 * official Diyanet Awqat Salah API later means writing one more class with this
 * shape and changing the provider binding — nothing else in the app changes.
 */
export interface LocationEntry {
  id: string;
  name: string;
  nameEn: string;
}

export interface ProviderDay {
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  /** Local wall-clock times, "HH:mm". */
  imsak: string;
  gunes: string;
  ogle: string;
  ikindi: string;
  aksam: string;
  yatsi: string;
  sunrise?: string;
  sunset?: string;
  qiblaTime?: string;
  hijriShort?: string;
  hijriLong?: string;
  moonPhaseUrl?: string;
}

export interface PrayerTimesProvider {
  readonly name: 'emushaf' | 'diyanet';
  countries(): Promise<LocationEntry[]>;
  cities(countryId: string): Promise<LocationEntry[]>;
  districts(cityId: string): Promise<LocationEntry[]>;
  /** Upcoming days (typically about a month) for one district. */
  times(districtId: string): Promise<ProviderDay[]>;
}

export const PRAYER_TIMES_PROVIDER = Symbol('PRAYER_TIMES_PROVIDER');
