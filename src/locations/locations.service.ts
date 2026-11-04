import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { find as findTimezone } from 'geo-tz';
import type { Redis } from 'ioredis';
import { AppError } from '../common/errors.js';
import { UpstreamError } from '../common/http-client.js';
import { withRedisLock } from '../common/redis-lock.js';
import { type Database, InjectDb } from '../db/database.module.js';
import { cities, countries, districts } from '../db/schema/index.js';
import { jobId, JOBS, QUEUES } from '../jobs/queues.js';
import {
  type LocationEntry,
  PRAYER_TIMES_PROVIDER,
  type PrayerTimesProvider,
} from '../prayer-times/providers/provider.js';
import { InjectRedis } from '../redis/redis.module.js';
import { defaultTimezoneFor } from './country-timezones.js';
import type { GeoPoint } from './geocoder.service.js';

export interface Named {
  id: string;
  name: string;
  nameEn: string;
}

export interface DistrictView extends Named {
  city: Named;
  country: Named;
  location: GeoPoint | null;
  /** IANA zone, or null when neither coordinates nor a country default are known. */
  timezone: string | null;
}

export interface NearestDistrict {
  district: DistrictView;
  distanceKm: number;
}

/** Districts farther than this from the user are not considered "their" district. */
export const NEAREST_MAX_KM = 75;

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    @Inject(PRAYER_TIMES_PROVIDER) private readonly provider: PrayerTimesProvider,
    @InjectQueue(QUEUES.geocode) private readonly geocodeQueue: Queue,
  ) {}

  async listCountries(): Promise<Named[]> {
    let rows = await this.selectCountries();
    if (rows.length === 0) {
      await withRedisLock(this.redis, 'lock:sync:countries', async () => {
        if ((await this.selectCountries()).length === 0) {
          await this.syncCountries();
        }
      });
      rows = await this.selectCountries();
    }
    return rows;
  }

  async listCities(countryId: string): Promise<Named[]> {
    await this.requireCountry(countryId);
    let rows = await this.selectCities(countryId);
    if (rows.length === 0) {
      await withRedisLock(this.redis, `lock:sync:cities:${countryId}`, async () => {
        if ((await this.selectCities(countryId)).length === 0) {
          await this.syncCities(countryId);
        }
      });
      rows = await this.selectCities(countryId);
    }
    return rows;
  }

  async listDistricts(cityId: string): Promise<Named[]> {
    const [city] = await this.db.select().from(cities).where(eq(cities.id, cityId));
    if (!city) {
      throw AppError.notFound('City');
    }
    if (!city.districtsSyncedAt) {
      await withRedisLock(this.redis, `lock:sync:districts:${cityId}`, async () => {
        const [fresh] = await this.db
          .select({ syncedAt: cities.districtsSyncedAt })
          .from(cities)
          .where(eq(cities.id, cityId));
        if (!fresh?.syncedAt) {
          await this.syncDistricts(cityId);
        }
      });
    }
    return this.db
      .select({ id: districts.id, name: districts.name, nameEn: districts.nameEn })
      .from(districts)
      .where(eq(districts.cityId, cityId))
      .orderBy(asc(districts.name));
  }

  async getDistrict(id: string): Promise<DistrictView> {
    const view = await this.findDistrict(id);
    if (!view) {
      throw AppError.notFound('District');
    }
    return view;
  }

  async findDistrict(id: string): Promise<DistrictView | undefined> {
    const [row] = await this.db
      .select({
        id: districts.id,
        name: districts.name,
        nameEn: districts.nameEn,
        location: districts.location,
        timezone: districts.timezone,
        cityId: cities.id,
        cityName: cities.name,
        cityNameEn: cities.nameEn,
        countryId: countries.id,
        countryName: countries.name,
        countryNameEn: countries.nameEn,
        countryTimezone: countries.defaultTimezone,
      })
      .from(districts)
      .innerJoin(cities, eq(cities.id, districts.cityId))
      .innerJoin(countries, eq(countries.id, cities.countryId))
      .where(eq(districts.id, id));
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      name: row.name,
      nameEn: row.nameEn,
      city: { id: row.cityId, name: row.cityName, nameEn: row.cityNameEn },
      country: { id: row.countryId, name: row.countryName, nameEn: row.countryNameEn },
      location: row.location ? { lat: row.location.y, lng: row.location.x } : null,
      timezone: row.timezone ?? row.countryTimezone ?? null,
    };
  }

  /** Closest geocoded district within NEAREST_MAX_KM, or null. */
  async nearest(lat: number, lng: number): Promise<NearestDistrict | null> {
    const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
    // KNN (<->) on the GiST index narrows candidates cheaply; exact geodesic
    // distance then picks the true nearest among them.
    const candidates = await this.db.execute<{ id: string; meters: number }>(sql`
      SELECT id, meters FROM (
        SELECT ${districts.id} AS id,
               ST_Distance(${districts.location}::geography, ${point}::geography) AS meters
        FROM ${districts}
        WHERE ${districts.location} IS NOT NULL
        ORDER BY ${districts.location} <-> ${point}
        LIMIT 8
      ) nearest
      ORDER BY meters ASC
      LIMIT 1
    `);
    const best = candidates.rows[0];
    if (!best || best.meters / 1000 > NEAREST_MAX_KM) {
      return null;
    }
    const district = await this.findDistrict(best.id);
    return district ? { district, distanceKm: Math.round(best.meters / 100) / 10 } : null;
  }

  /** Stores coordinates and derives the IANA zone from them. */
  async setDistrictLocation(id: string, point: GeoPoint, manual = false): Promise<void> {
    const timezone = findTimezone(point.lat, point.lng)[0] ?? null;
    const updated = await this.db
      .update(districts)
      .set({
        location: { x: point.lng, y: point.lat },
        timezone,
        geocodeStatus: manual ? 'manual' : 'ok',
        geocodedAt: new Date(),
      })
      .where(eq(districts.id, id))
      .returning({ id: districts.id });
    if (updated.length === 0) {
      throw AppError.notFound('District');
    }
  }

  async markGeocodeFailed(id: string): Promise<void> {
    await this.db
      .update(districts)
      .set({
        geocodeStatus: 'not_found',
        geocodeAttempts: sql`${districts.geocodeAttempts} + 1`,
        geocodedAt: new Date(),
      })
      .where(eq(districts.id, id));
  }

  async syncCountries(): Promise<number> {
    const entries = await this.fetchOrThrow(() => this.provider.countries());
    if (entries.length === 0) {
      return 0;
    }
    await this.db
      .insert(countries)
      .values(
        entries.map((entry) => ({
          ...entry,
          defaultTimezone: defaultTimezoneFor(entry.nameEn) ?? defaultTimezoneFor(entry.name),
        })),
      )
      .onConflictDoUpdate({
        target: countries.id,
        set: {
          name: sql`excluded.name`,
          nameEn: sql`excluded.name_en`,
          defaultTimezone: sql`excluded.default_timezone`,
          syncedAt: sql`now()`,
        },
      });
    return entries.length;
  }

  async syncCities(countryId: string): Promise<number> {
    const entries = await this.fetchOrThrow(() => this.provider.cities(countryId));
    if (entries.length === 0) {
      return 0;
    }
    await this.db
      .insert(cities)
      .values(entries.map((entry) => ({ ...entry, countryId })))
      .onConflictDoUpdate({
        target: cities.id,
        set: {
          name: sql`excluded.name`,
          nameEn: sql`excluded.name_en`,
          countryId: sql`excluded.country_id`,
          syncedAt: sql`now()`,
        },
      });
    return entries.length;
  }

  async syncDistricts(cityId: string): Promise<number> {
    const entries = await this.fetchOrThrow(() => this.provider.districts(cityId));
    const before = new Set(
      (
        await this.db
          .select({ id: districts.id })
          .from(districts)
          .where(eq(districts.cityId, cityId))
      ).map((row) => row.id),
    );
    if (entries.length > 0) {
      await this.db
        .insert(districts)
        .values(entries.map((entry) => ({ ...entry, cityId })))
        .onConflictDoUpdate({
          target: districts.id,
          set: {
            name: sql`excluded.name`,
            nameEn: sql`excluded.name_en`,
            cityId: sql`excluded.city_id`,
            syncedAt: sql`now()`,
          },
        });
    }
    await this.db
      .update(cities)
      .set({ districtsSyncedAt: new Date() })
      .where(eq(cities.id, cityId));

    const added = entries.filter((entry) => !before.has(entry.id)).map((entry) => entry.id);
    if (added.length > 0) {
      // Best effort: a queue hiccup must not fail the user's district list.
      await this.enqueueGeocode(added).catch((error: unknown) => {
        this.logger.warn(`Could not queue geocoding: ${(error as Error).message}`);
      });
    }
    return entries.length;
  }

  /** Queues coordinates lookups; lower priority number = sooner. */
  async enqueueGeocode(ids: string[], priority = 10): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.geocodeQueue.addBulk(
      ids.map((id) => ({
        name: JOBS.geocodeDistrict,
        data: { districtId: id },
        opts: { jobId: jobId('geocode', id), priority, attempts: 2 },
      })),
    );
  }

  async pendingGeocodeIds(limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: districts.id })
      .from(districts)
      .where(eq(districts.geocodeStatus, 'pending'))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async citiesWithoutDistricts(): Promise<string[]> {
    const rows = await this.db
      .select({ id: cities.id })
      .from(cities)
      .where(isNull(cities.districtsSyncedAt));
    return rows.map((row) => row.id);
  }

  async allCountryIds(): Promise<string[]> {
    return (await this.db.select({ id: countries.id }).from(countries)).map((row) => row.id);
  }

  async allCityIds(): Promise<string[]> {
    return (await this.db.select({ id: cities.id }).from(cities)).map((row) => row.id);
  }

  async districtNamesForGeocode(
    ids: string[],
  ): Promise<Array<{ id: string; district: string; city: string; country: string }>> {
    if (ids.length === 0) {
      return [];
    }
    return this.db
      .select({
        id: districts.id,
        district: districts.nameEn,
        city: cities.nameEn,
        country: countries.nameEn,
      })
      .from(districts)
      .innerJoin(cities, eq(cities.id, districts.cityId))
      .innerJoin(countries, eq(countries.id, cities.countryId))
      .where(inArray(districts.id, ids));
  }

  private async requireCountry(countryId: string): Promise<void> {
    await this.listCountries();
    const [row] = await this.db
      .select({ id: countries.id })
      .from(countries)
      .where(eq(countries.id, countryId));
    if (!row) {
      throw AppError.notFound('Country');
    }
  }

  private selectCountries(): Promise<Named[]> {
    return this.db
      .select({ id: countries.id, name: countries.name, nameEn: countries.nameEn })
      .from(countries)
      .orderBy(asc(countries.name));
  }

  private selectCities(countryId: string): Promise<Named[]> {
    return this.db
      .select({ id: cities.id, name: cities.name, nameEn: cities.nameEn })
      .from(cities)
      .where(eq(cities.countryId, countryId))
      .orderBy(asc(cities.name));
  }

  private async fetchOrThrow(fn: () => Promise<LocationEntry[]>): Promise<LocationEntry[]> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof UpstreamError) {
        this.logger.warn(`Location sync failed: ${error.message}`);
        throw AppError.upstream('Location directory');
      }
      throw error;
    }
  }
}
