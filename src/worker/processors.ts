import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Job } from 'bullmq';
import { JOBS, QUEUES } from '../jobs/queues.js';
import { LiveService } from '../live/live.service.js';
import { GeocoderService } from '../locations/geocoder.service.js';
import { LocationsService } from '../locations/locations.service.js';
import { MosquesService } from '../mosques/mosques.service.js';
import { type BroadcastJob, NotificationsService } from '../notifications/notifications.service.js';
import { PrayerTimesService } from '../prayer-times/prayer-times.service.js';
import { WorshipService } from '../worship/worship.service.js';

/** Pause between upstream calls during full syncs, to stay polite to free services. */
const SYNC_DELAY_MS = 400;

@Processor(QUEUES.locations, { concurrency: 1 })
export class LocationsProcessor extends WorkerHost {
  private readonly logger = new Logger(LocationsProcessor.name);

  constructor(private readonly locations: LocationsService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOBS.syncAllLocations:
        return this.syncAll(job);
      case JOBS.syncCityDistricts:
        return this.locations.syncDistricts((job.data as { cityId: string }).cityId);
      case JOBS.enqueuePendingGeocodes: {
        const ids = await this.locations.pendingGeocodeIds(5_000);
        await this.locations.enqueueGeocode(ids);
        return { queued: ids.length };
      }
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }

  /** Weekly: countries → cities → districts. ~2k requests, spaced out. */
  private async syncAll(job: Job): Promise<unknown> {
    const countries = await this.locations.syncCountries();
    let cities = 0;
    let districts = 0;
    const countryIds = await this.locations.allCountryIds();
    for (const [index, countryId] of countryIds.entries()) {
      cities += await this.tolerate(() => this.locations.syncCities(countryId));
      await sleep(SYNC_DELAY_MS);
      await job.updateProgress(Math.round(((index + 1) / countryIds.length) * 50));
    }
    const cityIds = await this.locations.allCityIds();
    for (const [index, cityId] of cityIds.entries()) {
      districts += await this.tolerate(() => this.locations.syncDistricts(cityId));
      await sleep(SYNC_DELAY_MS);
      if (index % 25 === 0) {
        await job.updateProgress(50 + Math.round(((index + 1) / cityIds.length) * 50));
      }
    }
    this.logger.log(
      `Location sync done: ${countries} countries, ${cities} cities, ${districts} districts`,
    );
    return { countries, cities, districts };
  }

  private async tolerate(fn: () => Promise<number>): Promise<number> {
    try {
      return await fn();
    } catch (error) {
      this.logger.warn(`Skipped during sync: ${(error as Error).message}`);
      return 0;
    }
  }
}

/** Nominatim allows 1 request/second; the limiter below enforces it across all workers. */
@Processor(QUEUES.geocode, { concurrency: 1, limiter: { max: 1, duration: 1_100 } })
export class GeocodeProcessor extends WorkerHost {
  constructor(
    private readonly locations: LocationsService,
    private readonly geocoder: GeocoderService,
  ) {
    super();
  }

  async process(job: Job<{ districtId: string }>): Promise<unknown> {
    const district = await this.locations.findDistrict(job.data.districtId);
    if (!district || district.location) {
      return { skipped: true };
    }
    const point = await this.geocoder.locateDistrict(
      district.nameEn,
      district.city.nameEn,
      district.country.nameEn,
    );
    if (!point) {
      await this.locations.markGeocodeFailed(district.id);
      return { found: false };
    }
    await this.locations.setDistrictLocation(district.id, point);
    return point;
  }
}

@Processor(QUEUES.prayerTimes, { concurrency: 2 })
export class PrayerTimesProcessor extends WorkerHost {
  constructor(private readonly prayerTimes: PrayerTimesService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOBS.refreshDistrictTimes:
        return {
          days: await this.prayerTimes.fetchAndStore(
            (job.data as { districtId: string }).districtId,
          ),
        };
      case JOBS.refreshActiveDistricts:
        return {
          queued: await this.prayerTimes.enqueueRefreshForActiveDistricts(),
          pruned: await this.prayerTimes.pruneOld(),
        };
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}

/** Overpass allows ~2 concurrent requests per IP; one at a time leaves room for the API. */
@Processor(QUEUES.mosques, { concurrency: 1, limiter: { max: 1, duration: 2_000 } })
export class MosquesProcessor extends WorkerHost {
  constructor(private readonly mosques: MosquesService) {
    super();
  }

  async process(job: Job<{ tileId: string }>): Promise<unknown> {
    return { mosques: await this.mosques.importTile(job.data.tileId) };
  }
}

@Processor(QUEUES.live, { concurrency: 1 })
export class LiveProcessor extends WorkerHost {
  constructor(private readonly live: LiveService) {
    super();
  }

  async process(): Promise<unknown> {
    return this.live.poll();
  }
}

@Processor(QUEUES.notifications, { concurrency: 4 })
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOBS.broadcast:
        return { devices: await this.notifications.fanOut(job.data as BroadcastJob) };
      case JOBS.sendPushBatch:
        await this.notifications.sendBatch(
          job.data as Parameters<NotificationsService['sendBatch']>[0],
        );
        return null;
      case JOBS.checkPushReceipts:
        return { removedTokens: await this.notifications.checkReceipts() };
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}

@Processor(QUEUES.maintenance, { concurrency: 1 })
export class MaintenanceProcessor extends WorkerHost {
  constructor(private readonly worship: WorshipService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOBS.pruneSyncBatches:
        return { pruned: await this.worship.pruneSyncBatches() };
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}
