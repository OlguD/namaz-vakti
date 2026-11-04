import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AppConfig } from '../config/app-config.service.js';
import { jobId, JOBS, QUEUES } from '../jobs/queues.js';

/**
 * Recurring jobs live in Redis as BullMQ job schedulers, so they fire exactly once
 * per tick no matter how many worker replicas run. Upserting on boot keeps the
 * schedule in sync with this file. Times are UTC.
 */
@Injectable()
export class SchedulesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly config: AppConfig,
    @InjectQueue(QUEUES.locations) private readonly locations: Queue,
    @InjectQueue(QUEUES.prayerTimes) private readonly prayerTimes: Queue,
    @InjectQueue(QUEUES.live) private readonly live: Queue,
    @InjectQueue(QUEUES.notifications) private readonly notifications: Queue,
    @InjectQueue(QUEUES.maintenance) private readonly maintenance: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('WORKER_SCHEDULES_ENABLED')) {
      this.logger.warn('Recurring schedules are disabled (WORKER_SCHEDULES_ENABLED=false)');
      return;
    }
    await Promise.all([
      // Sundays 02:13 — refresh the country/city/district directory.
      this.locations.upsertJobScheduler(
        'weekly-location-sync',
        { pattern: '13 2 * * 0' },
        {
          name: JOBS.syncAllLocations,
        },
      ),
      // Hourly — pick up districts that still need coordinates.
      this.locations.upsertJobScheduler(
        'hourly-geocode-backlog',
        { pattern: '7 * * * *' },
        {
          name: JOBS.enqueuePendingGeocodes,
        },
      ),
      // Daily 01:23 — extend tables for districts people use, prune old days.
      this.prayerTimes.upsertJobScheduler(
        'daily-prayer-refresh',
        { pattern: '23 1 * * *' },
        {
          name: JOBS.refreshActiveDistricts,
        },
      ),
      this.live.upsertJobScheduler(
        'live-poll',
        { pattern: this.config.get('LIVE_POLL_CRON') },
        {
          name: JOBS.pollLiveStreams,
        },
      ),
      // Every 15 minutes — Expo delivery receipts (removes uninstalled devices).
      // Daily 04:17 — hijri month starts + holy days for this and next hijri year.
      this.maintenance.upsertJobScheduler(
        'sync-religious-days',
        { pattern: '17 4 * * *' },
        { name: JOBS.syncReligiousDays },
      ),
      // Weekdays 07:23 and 13:23 UTC (10:23 / 16:23 TR, after TCMB's 15:30 bulletin).
      this.maintenance.upsertJobScheduler(
        'refresh-metal-prices',
        { pattern: '23 7,13 * * 1-5' },
        { name: JOBS.refreshMetalPrices },
      ),
      // Daily 03:37 — forget dhikr-sync idempotency keys older than 30 days.
      this.maintenance.upsertJobScheduler(
        'prune-sync-batches',
        { pattern: '37 3 * * *' },
        { name: JOBS.pruneSyncBatches },
      ),
      this.notifications.upsertJobScheduler(
        'push-receipts',
        { pattern: '*/15 * * * *' },
        {
          name: JOBS.checkPushReceipts,
        },
      ),
    ]);
    // Fill the calendar and prices right after a deploy instead of waiting for the next tick.
    const today = new Date().toISOString().slice(0, 10);
    await this.maintenance.add(JOBS.syncReligiousDays, {}, { jobId: jobId('days', 'boot', today) });
    await this.maintenance.add(
      JOBS.refreshMetalPrices,
      {},
      { jobId: jobId('metals', 'boot', today) },
    );
    this.logger.log('Recurring schedules registered');
  }
}
