import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { and, asc, eq, gte, lt, max, sql } from 'drizzle-orm';
import { find as findTimezone } from 'geo-tz';
import type { Redis } from 'ioredis';
import { AppError } from '../common/errors.js';
import { UpstreamError } from '../common/http-client.js';
import { oncePer, withRedisLock } from '../common/redis-lock.js';
import { type Database, InjectDb } from '../db/database.module.js';
import { districts, prayerTimes } from '../db/schema/index.js';
import { jobId, JOBS, QUEUES } from '../jobs/queues.js';
import { type DistrictView, LocationsService } from '../locations/locations.service.js';
import { InjectRedis } from '../redis/redis.module.js';
import { calculateDays } from './providers/calculated.js';
import {
  PRAYER_TIMES_PROVIDER,
  type PrayerTimesProvider,
  type ProviderDay,
} from './providers/provider.js';
import { addDays, localDate, localToInstant } from './time-utils.js';

export const PRAYER_KEYS = ['imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];

export interface HijriDate {
  day: number;
  month: number;
  year: number;
  /** e.g. "24 Cemaziyelevvel 1448" */
  long: string | null;
}

export interface DayView {
  date: string;
  hijri: HijriDate | null;
  /** Hijri month 9. Drives the app's Ramadan mode (iftar = aksam, sahur ends at imsak). */
  isRamadan: boolean;
  moonPhaseUrl: string | null;
  /** Local wall-clock times, exactly as published. */
  times: Record<PrayerKey, string>;
  /** Same times as UTC instants; null when the district's time zone is unknown. */
  instants: Record<PrayerKey, string> | null;
  sunrise: string | null;
  sunset: string | null;
  qiblaTime: string | null;
}

export interface PrayerTimesResult {
  district: DistrictView | null;
  /** Set when times were calculated for raw coordinates instead of a district. */
  location: { lat: number; lng: number } | null;
  timezone: string | null;
  source: 'emushaf' | 'diyanet' | 'calculated';
  /** True when the upstream was unreachable and cached data past its refresh time was served. */
  stale: boolean;
  days: DayView[];
}

const REFETCH_AFTER_MS = 6 * 60 * 60 * 1000;
/** Keep at least this many future days stored for active districts. */
const MIN_FUTURE_DAYS = 10;
const RESPONSE_CACHE_SECONDS = 600;

@Injectable()
export class PrayerTimesService {
  private readonly logger = new Logger(PrayerTimesService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    @Inject(PRAYER_TIMES_PROVIDER) private readonly provider: PrayerTimesProvider,
    private readonly locations: LocationsService,
    @InjectQueue(QUEUES.prayerTimes) private readonly queue: Queue,
  ) {}

  async forDistrict(districtId: string, days: number, from?: string): Promise<PrayerTimesResult> {
    const district = await this.locations.getDistrict(districtId);
    const timezone = district.timezone;
    const today = timezone
      ? localDate(new Date(), timezone)
      : addDays(localDate(new Date(), 'UTC'), -1);
    const start = from ?? today;

    // A per-district version number in the key lets a refresh invalidate every
    // cached range at once without scanning keys.
    const version = (await this.redis.get(`pt:ver:${districtId}`)) ?? '0';
    const cacheKey = `pt:v1:${districtId}:${version}:${start}:${days}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      void this.touch(districtId);
      return JSON.parse(cached) as PrayerTimesResult;
    }

    let rows = await this.readRows(districtId, start, days);
    let stale = false;
    if (rows.length < days && (await this.isDueForFetch(districtId))) {
      try {
        await withRedisLock(this.redis, `lock:pt:${districtId}`, async () => {
          if (await this.isDueForFetch(districtId)) {
            await this.fetchAndStore(districtId);
          }
        });
        rows = await this.readRows(districtId, start, days);
      } catch (error) {
        if (!(error instanceof UpstreamError)) {
          throw error;
        }
        this.logger.warn(`Serving cached times for ${districtId}: ${error.message}`);
        stale = true;
      }
    }

    if (rows.length === 0) {
      if (district.location) {
        const zone =
          timezone ?? findTimezone(district.location.lat, district.location.lng)[0] ?? 'UTC';
        const calculated = calculateDays(
          district.location.lat,
          district.location.lng,
          zone,
          start,
          days,
        );
        return this.build({
          district,
          location: null,
          timezone: zone,
          source: 'calculated',
          stale,
          days: calculated,
        });
      }
      throw AppError.upstream('Prayer times source');
    }

    const result = this.build({
      district,
      location: null,
      timezone,
      source: rows[0]!.source,
      stale,
      days: rows,
    });

    await this.ensureFutureCoverage(districtId, today).catch((error: unknown) => {
      this.logger.warn(`Could not queue refresh for ${districtId}: ${(error as Error).message}`);
    });
    void this.touch(districtId);
    if (!stale) {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', RESPONSE_CACHE_SECONDS);
    }
    return result;
  }

  /**
   * Times for a GPS position: the nearest district's official table when one is
   * close enough, otherwise a local calculation for the exact coordinates.
   */
  async forCoordinates(lat: number, lng: number, days: number): Promise<PrayerTimesResult> {
    const nearest = await this.locations.nearest(lat, lng);
    if (nearest) {
      return this.forDistrict(nearest.district.id, days);
    }
    const timezone = findTimezone(lat, lng)[0];
    if (!timezone) {
      throw AppError.badRequest('LOCATION_UNSUPPORTED', 'No time zone is known for this position');
    }
    const start = localDate(new Date(), timezone);
    return this.build({
      district: null,
      location: { lat, lng },
      timezone,
      source: 'calculated',
      stale: false,
      days: calculateDays(lat, lng, timezone, start, days),
    });
  }

  /** Pulls the upstream table for one district and upserts it. Used by API and worker. */
  async fetchAndStore(districtId: string): Promise<number> {
    const fetched = await this.provider.times(districtId);
    if (fetched.length === 0) {
      return 0;
    }
    const now = new Date();
    await this.db
      .insert(prayerTimes)
      .values(fetched.map((day) => toRow(districtId, day, this.provider.name, now)))
      .onConflictDoUpdate({
        target: [prayerTimes.districtId, prayerTimes.date],
        set: {
          imsak: sql`excluded.imsak`,
          gunes: sql`excluded.gunes`,
          ogle: sql`excluded.ogle`,
          ikindi: sql`excluded.ikindi`,
          aksam: sql`excluded.aksam`,
          yatsi: sql`excluded.yatsi`,
          sunrise: sql`excluded.sunrise`,
          sunset: sql`excluded.sunset`,
          qiblaTime: sql`excluded.qibla_time`,
          hijriShort: sql`excluded.hijri_short`,
          hijriLong: sql`excluded.hijri_long`,
          moonPhaseUrl: sql`excluded.moon_phase_url`,
          source: sql`excluded.source`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
    await this.invalidate(districtId);
    return fetched.length;
  }

  /** Worker: queue refreshes for districts people used recently whose table runs out soon. */
  async enqueueRefreshForActiveDistricts(): Promise<number> {
    const horizon = addDays(localDate(new Date(), 'UTC'), MIN_FUTURE_DAYS);
    const result = await this.db.execute<{ id: string }>(sql`
      SELECT d.id
      FROM ${districts} d
      LEFT JOIN ${prayerTimes} p ON p.district_id = d.id
      WHERE d.last_requested_at > now() - interval '14 days'
      GROUP BY d.id
      HAVING coalesce(max(p.date), '1970-01-01'::date) < ${horizon}::date
    `);
    const ids = result.rows.map((row) => row.id);
    // Spread requests over ~30 minutes so a big batch does not hammer the upstream.
    await this.queue.addBulk(
      ids.map((id, index) => ({
        name: JOBS.refreshDistrictTimes,
        data: { districtId: id },
        opts: {
          jobId: jobId('refresh', id, horizon),
          delay: Math.floor((index / Math.max(ids.length, 1)) * 30 * 60 * 1000),
        },
      })),
    );
    return ids.length;
  }

  /** Worker: drop rows more than a week in the past. */
  async pruneOld(): Promise<number> {
    const cutoff = addDays(localDate(new Date(), 'UTC'), -7);
    const result = await this.db.delete(prayerTimes).where(lt(prayerTimes.date, cutoff));
    return result.rowCount ?? 0;
  }

  private build(input: {
    district: DistrictView | null;
    location: { lat: number; lng: number } | null;
    timezone: string | null;
    source: PrayerTimesResult['source'];
    stale: boolean;
    days: Array<ProviderDay | typeof prayerTimes.$inferSelect>;
  }): PrayerTimesResult {
    return {
      district: input.district,
      location: input.location,
      timezone: input.timezone,
      source: input.source,
      stale: input.stale,
      days: input.days.map((day) => toDayView(day, input.timezone)),
    };
  }

  private async readRows(districtId: string, from: string, days: number) {
    return this.db
      .select()
      .from(prayerTimes)
      .where(and(eq(prayerTimes.districtId, districtId), gte(prayerTimes.date, from)))
      .orderBy(asc(prayerTimes.date))
      .limit(days);
  }

  private async isDueForFetch(districtId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ last: max(prayerTimes.fetchedAt) })
      .from(prayerTimes)
      .where(eq(prayerTimes.districtId, districtId));
    return !row?.last || Date.now() - row.last.getTime() > REFETCH_AFTER_MS;
  }

  private async ensureFutureCoverage(districtId: string, today: string): Promise<void> {
    const [row] = await this.db
      .select({ last: max(prayerTimes.date) })
      .from(prayerTimes)
      .where(eq(prayerTimes.districtId, districtId));
    if (!row?.last || row.last < addDays(today, MIN_FUTURE_DAYS)) {
      await this.queue.add(
        JOBS.refreshDistrictTimes,
        { districtId },
        { jobId: jobId('refresh', districtId, today) },
      );
    }
  }

  private async touch(districtId: string): Promise<void> {
    try {
      if (await oncePer(this.redis, `touch:district:${districtId}`, 3600)) {
        await this.db
          .update(districts)
          .set({ lastRequestedAt: new Date() })
          .where(eq(districts.id, districtId));
        // Someone uses this district: make sure its coordinates get looked up soon.
        await this.locations.enqueueGeocode([districtId], 1);
      }
    } catch (error) {
      this.logger.warn(`Could not record district usage: ${(error as Error).message}`);
    }
  }

  private async invalidate(districtId: string): Promise<void> {
    await this.redis.incr(`pt:ver:${districtId}`);
  }
}

function toRow(
  districtId: string,
  day: ProviderDay,
  source: 'emushaf' | 'diyanet',
  fetchedAt: Date,
): typeof prayerTimes.$inferInsert {
  return {
    districtId,
    date: day.date,
    imsak: day.imsak,
    gunes: day.gunes,
    ogle: day.ogle,
    ikindi: day.ikindi,
    aksam: day.aksam,
    yatsi: day.yatsi,
    sunrise: day.sunrise ?? null,
    sunset: day.sunset ?? null,
    qiblaTime: day.qiblaTime ?? null,
    hijriShort: day.hijriShort ?? null,
    hijriLong: day.hijriLong ?? null,
    moonPhaseUrl: day.moonPhaseUrl ?? null,
    source,
    fetchedAt,
  };
}

export function parseHijri(
  short: string | null | undefined,
  long: string | null | undefined,
): HijriDate | null {
  const match = short ? /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(short) : null;
  if (!match) {
    return null;
  }
  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3]),
    long: long ?? null,
  };
}

export function toDayView(
  day: ProviderDay | typeof prayerTimes.$inferSelect,
  timezone: string | null,
): DayView {
  const times = {
    imsak: day.imsak,
    gunes: day.gunes,
    ogle: day.ogle,
    ikindi: day.ikindi,
    aksam: day.aksam,
    yatsi: day.yatsi,
  };
  const hijri = parseHijri(day.hijriShort, day.hijriLong);
  let instants: DayView['instants'] = null;
  if (timezone) {
    instants = Object.fromEntries(
      PRAYER_KEYS.map((key) => [key, localToInstant(day.date, times[key], timezone).toISOString()]),
    ) as Record<PrayerKey, string>;
  }
  return {
    date: day.date,
    hijri,
    isRamadan: hijri?.month === 9,
    moonPhaseUrl: day.moonPhaseUrl ?? null,
    times,
    instants,
    sunrise: day.sunrise ?? null,
    sunset: day.sunset ?? null,
    qiblaTime: day.qiblaTime ?? null,
  };
}
