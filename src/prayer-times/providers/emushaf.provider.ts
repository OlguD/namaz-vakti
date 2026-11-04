import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { HttpClient, UpstreamError } from '../../common/http-client.js';
import type { LocationEntry, PrayerTimesProvider, ProviderDay } from './provider.js';

type RawRecord = Record<string, unknown>;

const TIME = /^\d{2}:\d{2}$/;

/**
 * https://ezanvakti.emushaf.net — community mirror of Diyanet's monthly tables.
 * Known quirks (documented upstream, not expected to be fixed):
 *  - `MiladiTarihUzunIso8601` always carries Türkiye's +03:00 offset, even for
 *    London; we ignore offsets entirely and keep local wall-clock times.
 *  - Some countries list cities as "districts" under a single pseudo-city.
 */
@Injectable()
export class EmushafProvider implements PrayerTimesProvider {
  readonly name = 'emushaf' as const;
  private readonly http: HttpClient;
  private readonly baseUrl: string;

  constructor(config: AppConfig) {
    this.baseUrl = config.get('EMUSHAF_BASE_URL').replace(/\/$/, '');
    this.http = new HttpClient({
      service: 'emushaf',
      userAgent: config.get('OUTBOUND_USER_AGENT'),
      timeoutMs: 10_000,
      retries: 2,
    });
  }

  async countries(): Promise<LocationEntry[]> {
    return parseLocations(await this.get('/ulkeler'), 'Ulke');
  }

  async cities(countryId: string): Promise<LocationEntry[]> {
    return parseLocations(await this.get(`/sehirler/${encodeURIComponent(countryId)}`), 'Sehir');
  }

  async districts(cityId: string): Promise<LocationEntry[]> {
    return parseLocations(await this.get(`/ilceler/${encodeURIComponent(cityId)}`), 'Ilce');
  }

  async times(districtId: string): Promise<ProviderDay[]> {
    return parseTimes(await this.get(`/vakitler/${encodeURIComponent(districtId)}`));
  }

  private async get(path: string): Promise<unknown> {
    return this.http.json<unknown>(`${this.baseUrl}${path}`);
  }
}

export function parseLocations(raw: unknown, prefix: 'Ulke' | 'Sehir' | 'Ilce'): LocationEntry[] {
  if (!Array.isArray(raw)) {
    throw new UpstreamError('emushaf', `expected an array of ${prefix} entries`, undefined, false);
  }
  const entries: LocationEntry[] = [];
  for (const item of raw as RawRecord[]) {
    const id = item[`${prefix}ID`];
    const name = item[`${prefix}Adi`];
    const nameEn = item[`${prefix}AdiEn`];
    if ((typeof id !== 'string' && typeof id !== 'number') || typeof name !== 'string') {
      continue;
    }
    entries.push({
      id: String(id).trim(),
      name: name.trim(),
      nameEn: typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : name.trim(),
    });
  }
  return entries;
}

export function parseTimes(raw: unknown): ProviderDay[] {
  if (!Array.isArray(raw)) {
    throw new UpstreamError('emushaf', 'expected an array of days', undefined, false);
  }
  const days: ProviderDay[] = [];
  for (const item of raw as RawRecord[]) {
    const date = toIsoDate(item.MiladiTarihKisa);
    const required = {
      imsak: item.Imsak,
      gunes: item.Gunes,
      ogle: item.Ogle,
      ikindi: item.Ikindi,
      aksam: item.Aksam,
      yatsi: item.Yatsi,
    };
    if (
      !date ||
      !Object.values(required).every((value) => typeof value === 'string' && TIME.test(value))
    ) {
      continue;
    }
    days.push({
      date,
      ...(required as Record<keyof typeof required, string>),
      sunrise: optionalTime(item.GunesDogus),
      sunset: optionalTime(item.GunesBatis),
      qiblaTime: optionalTime(item.KibleSaati),
      hijriShort: optionalString(item.HicriTarihKisa),
      hijriLong: optionalString(item.HicriTarihUzun),
      moonPhaseUrl: optionalHttpsUrl(item.AyinSekliURL),
    });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

/** "29.10.2026" → "2026-10-29" */
function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const [, day, month, year] = match;
  return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
}

function optionalTime(value: unknown): string | undefined {
  return typeof value === 'string' && TIME.test(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalHttpsUrl(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('https://') ? value : undefined;
}
