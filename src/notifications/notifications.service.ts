import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { and, asc, eq, gt, inArray, isNotNull, type SQL } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { AppError } from '../common/errors.js';
import { type Database, InjectDb } from '../db/database.module.js';
import { devices, districts } from '../db/schema/index.js';
import { JOBS, QUEUES } from '../jobs/queues.js';
import { InjectRedis } from '../redis/redis.module.js';
import { ExpoPushClient, isExpoPushToken, type PushMessage } from './expo-push.client.js';

export interface DeviceInput {
  installationId: string;
  platform: 'ios' | 'android' | 'web';
  pushToken?: string | null;
  locale?: string;
  appVersion?: string;
  districtId?: string | null;
  liveAlerts?: boolean;
  announcements?: boolean;
}

export type Audience = 'all' | 'live_subscribers' | 'announcements';

export interface BroadcastJob {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  audience: Audience;
  locale?: string;
}

interface SendBatchJob {
  messages: PushMessage[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    private readonly expo: ExpoPushClient,
    @InjectQueue(QUEUES.notifications) private readonly queue: Queue,
  ) {}

  /** Called by the app on launch and whenever the push token or settings change. */
  async registerDevice(userId: string, input: DeviceInput) {
    if (input.pushToken && !isExpoPushToken(input.pushToken)) {
      throw AppError.badRequest('VALIDATION_FAILED', 'pushToken must be an Expo push token');
    }
    if (input.districtId) {
      const [district] = await this.db
        .select({ id: districts.id })
        .from(districts)
        .where(eq(districts.id, input.districtId));
      if (!district) {
        throw AppError.notFound('District');
      }
    }
    return this.db.transaction(async (tx) => {
      if (input.pushToken) {
        // A token belongs to one install; drop it from any stale row (reinstall, account switch).
        await tx
          .update(devices)
          .set({ pushToken: null })
          .where(and(eq(devices.pushToken, input.pushToken)));
      }
      const values = {
        userId,
        installationId: input.installationId,
        platform: input.platform,
        ...(input.pushToken !== undefined ? { pushToken: input.pushToken } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        ...(input.appVersion !== undefined ? { appVersion: input.appVersion } : {}),
        ...(input.districtId !== undefined ? { districtId: input.districtId } : {}),
        ...(input.liveAlerts !== undefined ? { liveAlerts: input.liveAlerts } : {}),
        ...(input.announcements !== undefined ? { announcements: input.announcements } : {}),
        lastSeenAt: new Date(),
      };
      const [row] = await tx
        .insert(devices)
        .values(values)
        .onConflictDoUpdate({ target: devices.installationId, set: values })
        .returning();
      return toDeviceView(row!);
    });
  }

  async removeDevice(userId: string, installationId: string): Promise<void> {
    await this.db
      .delete(devices)
      .where(and(eq(devices.userId, userId), eq(devices.installationId, installationId)));
  }

  async enqueueBroadcast(job: BroadcastJob): Promise<string> {
    const added = await this.queue.add(JOBS.broadcast, job);
    return added.id!;
  }

  /** Worker: walk matching devices with a keyset cursor and fan out 100-message batches. */
  async fanOut(job: BroadcastJob): Promise<number> {
    const conditions: SQL[] = [isNotNull(devices.pushToken)];
    if (job.audience === 'live_subscribers') {
      conditions.push(eq(devices.liveAlerts, true));
    }
    if (job.audience === 'announcements') {
      conditions.push(eq(devices.announcements, true));
    }
    if (job.locale) {
      conditions.push(eq(devices.locale, job.locale));
    }

    let cursor: string | undefined;
    let total = 0;
    while (true) {
      const page = await this.db
        .select({ id: devices.id, pushToken: devices.pushToken })
        .from(devices)
        .where(and(...conditions, cursor ? gt(devices.id, cursor) : undefined))
        .orderBy(asc(devices.id))
        .limit(1_000);
      if (page.length === 0) {
        break;
      }
      cursor = page.at(-1)!.id;
      const messages: PushMessage[] = page.map((device) => ({
        to: device.pushToken!,
        title: job.title,
        body: job.body,
        data: job.data,
        sound: 'default',
      }));
      const batches: Array<{ name: string; data: SendBatchJob }> = [];
      for (let i = 0; i < messages.length; i += 100) {
        batches.push({ name: JOBS.sendPushBatch, data: { messages: messages.slice(i, i + 100) } });
      }
      await this.queue.addBulk(batches);
      total += messages.length;
    }
    return total;
  }

  /** Worker: send one batch, forget dead tokens now, and park ticket ids for the receipt check. */
  async sendBatch(job: SendBatchJob): Promise<void> {
    const tickets = await this.expo.send(job.messages);
    const dead: string[] = [];
    const pending: Array<[string, string]> = [];
    tickets.forEach((ticket, index) => {
      const token = job.messages[index]!.to;
      if (ticket.status === 'ok') {
        pending.push([ticket.id, token]);
      } else if (ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(token);
      } else {
        this.logger.warn(`Push to one device failed: ${ticket.message}`);
      }
    });
    await this.forgetTokens(dead);
    if (pending.length > 0) {
      await this.redis.hset('push:receipts', Object.fromEntries(pending));
    }
  }

  /** Worker: Expo reports uninstalls in receipts; clear those tokens so we stop sending. */
  async checkReceipts(): Promise<number> {
    const entries = await this.redis.hgetall('push:receipts');
    const ids = Object.keys(entries);
    let removed = 0;
    for (let i = 0; i < ids.length; i += 1_000) {
      const chunk = ids.slice(i, i + 1_000);
      const receipts = await this.expo.receipts(chunk);
      const dead = chunk
        .filter((id) => {
          const receipt = receipts[id];
          return receipt?.status === 'error' && receipt.details?.error === 'DeviceNotRegistered';
        })
        .map((id) => entries[id]!);
      removed += await this.forgetTokens(dead);
      // Receipts not ready yet stay for the next round; Expo keeps them for 24h.
      const done = chunk.filter((id) => receipts[id] !== undefined);
      if (done.length > 0) {
        await this.redis.hdel('push:receipts', ...done);
      }
    }
    return removed;
  }

  private async forgetTokens(tokens: string[]): Promise<number> {
    if (tokens.length === 0) {
      return 0;
    }
    const result = await this.db
      .update(devices)
      .set({ pushToken: null })
      .where(inArray(devices.pushToken, tokens));
    return result.rowCount ?? 0;
  }
}

function toDeviceView(row: typeof devices.$inferSelect) {
  return {
    installationId: row.installationId,
    platform: row.platform,
    hasPushToken: row.pushToken !== null,
    locale: row.locale,
    appVersion: row.appVersion,
    districtId: row.districtId,
    liveAlerts: row.liveAlerts,
    announcements: row.announcements,
  };
}
