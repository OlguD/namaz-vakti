import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { AppError } from '../common/errors.js';
import { type Database, InjectDb } from '../db/database.module.js';
import { liveChannels, liveStreams } from '../db/schema/index.js';
import { jobId, JOBS, QUEUES } from '../jobs/queues.js';
import { InjectRedis } from '../redis/redis.module.js';
import { YoutubeClient, type YoutubeVideoStatus } from './youtube.client.js';

export type LiveCategory = (typeof liveChannels.$inferSelect)['category'];

export interface StreamView {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  status: 'live' | 'upcoming';
  scheduledStartAt: string | null;
  actualStartAt: string | null;
  concurrentViewers: number | null;
  channel: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    category: LiveCategory;
    language: string | null;
  };
  /** Open with the YouTube IFrame player; never extract the raw stream. */
  embedUrl: string;
  watchUrl: string;
}

export interface ChannelInput {
  channel: string;
  category?: LiveCategory;
  language?: string;
  priority?: number;
  notifyOnLive?: boolean;
}

const LIST_CACHE_SECONDS = 30;

@Injectable()
export class LiveService {
  private readonly logger = new Logger(LiveService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    private readonly youtube: YoutubeClient,
    @InjectQueue(QUEUES.notifications) private readonly notifications: Queue,
  ) {}

  async streams(filter: {
    status?: 'live' | 'upcoming';
    category?: LiveCategory;
  }): Promise<StreamView[]> {
    const cacheKey = `live:list:${filter.status ?? 'all'}:${filter.category ?? 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as StreamView[];
    }
    const statuses = filter.status ? [filter.status] : (['live', 'upcoming'] as const);
    const rows = await this.db
      .select({ stream: liveStreams, channel: liveChannels })
      .from(liveStreams)
      .innerJoin(liveChannels, eq(liveChannels.id, liveStreams.channelId))
      .where(
        and(
          eq(liveChannels.enabled, true),
          inArray(liveStreams.status, [...statuses]),
          filter.category ? eq(liveChannels.category, filter.category) : undefined,
        ),
      )
      .orderBy(
        // Live before upcoming; then editor priority; then audience; then start time.
        sql`case when ${liveStreams.status} = 'live' then 0 else 1 end`,
        desc(liveChannels.priority),
        sql`${liveStreams.concurrentViewers} desc nulls last`,
        asc(liveStreams.scheduledStartAt),
      )
      .limit(100);
    const views = rows.map(({ stream, channel }) => toView(stream, channel));
    await this.redis.set(cacheKey, JSON.stringify(views), 'EX', LIST_CACHE_SECONDS);
    return views;
  }

  async channels() {
    return this.db
      .select({
        id: liveChannels.id,
        title: liveChannels.title,
        thumbnailUrl: liveChannels.thumbnailUrl,
        category: liveChannels.category,
        language: liveChannels.language,
        youtubeChannelId: liveChannels.youtubeChannelId,
      })
      .from(liveChannels)
      .where(eq(liveChannels.enabled, true))
      .orderBy(desc(liveChannels.priority), asc(liveChannels.title));
  }

  // ---- admin -------------------------------------------------------------

  async adminChannels() {
    return this.db
      .select()
      .from(liveChannels)
      .orderBy(desc(liveChannels.priority), asc(liveChannels.title));
  }

  async addChannel(input: ChannelInput) {
    const info = await this.youtube.resolveChannel(input.channel);
    const [row] = await this.db
      .insert(liveChannels)
      .values({
        youtubeChannelId: info.id,
        title: info.title,
        thumbnailUrl: info.thumbnailUrl,
        category: input.category ?? 'other',
        language: input.language ?? null,
        priority: input.priority ?? 0,
        notifyOnLive: input.notifyOnLive ?? false,
      })
      .onConflictDoUpdate({
        target: liveChannels.youtubeChannelId,
        set: { title: info.title, thumbnailUrl: info.thumbnailUrl, enabled: true },
      })
      .returning();
    return row!;
  }

  async updateChannel(
    id: string,
    patch: Partial<Omit<ChannelInput, 'channel'>> & { enabled?: boolean },
  ) {
    const [row] = await this.db
      .update(liveChannels)
      .set(patch)
      .where(eq(liveChannels.id, id))
      .returning();
    if (!row) {
      throw AppError.notFound('Channel');
    }
    await this.clearListCache();
    return row;
  }

  async removeChannel(id: string): Promise<void> {
    await this.db.delete(liveChannels).where(eq(liveChannels.id, id));
    await this.clearListCache();
  }

  /** Track a specific video (e.g. a 24/7 stream started long ago, no longer in the feed). */
  async pinStream(channelId: string, videoId: string) {
    if (!/^[\w-]{11}$/.test(videoId)) {
      throw AppError.badRequest('VALIDATION_FAILED', 'Invalid YouTube video id');
    }
    const [channel] = await this.db
      .select()
      .from(liveChannels)
      .where(eq(liveChannels.id, channelId));
    if (!channel) {
      throw AppError.notFound('Channel');
    }
    const status = (await this.youtube.videoStatuses([videoId])).get(videoId);
    if (!status) {
      throw AppError.notFound('YouTube video');
    }
    await this.upsertStatuses(channelId, [status], true);
    await this.clearListCache();
    return status;
  }

  async unpinStream(videoId: string): Promise<void> {
    await this.db
      .update(liveStreams)
      .set({ pinned: false })
      .where(eq(liveStreams.videoId, videoId));
  }

  // ---- worker -------------------------------------------------------------

  /**
   * One polling round: discover recent videos from every channel's RSS feed, then
   * refresh the status of everything that could be (or become) live. Videos already
   * known to be plain uploads or finished streams are not re-checked.
   */
  async poll(): Promise<{ checked: number; live: number }> {
    if (!this.youtube.enabled) {
      return { checked: 0, live: 0 };
    }
    const channels = await this.db
      .select()
      .from(liveChannels)
      .where(eq(liveChannels.enabled, true));
    if (channels.length === 0) {
      return { checked: 0, live: 0 };
    }

    const owner = new Map<string, string>();
    for (const channel of channels) {
      try {
        for (const videoId of await this.youtube.recentVideoIds(channel.youtubeChannelId)) {
          owner.set(videoId, channel.id);
        }
      } catch (error) {
        this.logger.warn(`Feed for ${channel.title} failed: ${(error as Error).message}`);
      }
    }

    const known = owner.size
      ? await this.db
          .select({
            videoId: liveStreams.videoId,
            status: liveStreams.status,
            pinned: liveStreams.pinned,
          })
          .from(liveStreams)
          .where(inArray(liveStreams.videoId, [...owner.keys()]))
      : [];
    const settled = new Set(
      known
        .filter((row) => !row.pinned && (row.status === 'ended' || row.status === 'none'))
        .map((row) => row.videoId),
    );

    const active = await this.db
      .select({ videoId: liveStreams.videoId, channelId: liveStreams.channelId })
      .from(liveStreams)
      .where(or(inArray(liveStreams.status, ['live', 'upcoming']), eq(liveStreams.pinned, true)));
    for (const row of active) {
      owner.set(row.videoId, row.channelId);
      settled.delete(row.videoId);
    }

    const toCheck = [...owner.keys()].filter((id) => !settled.has(id));
    if (toCheck.length === 0) {
      return { checked: 0, live: 0 };
    }
    const statuses = await this.youtube.videoStatuses(toCheck);

    // Requested but not returned: deleted or made private.
    const vanished = toCheck.filter((id) => !statuses.has(id));
    if (vanished.length > 0) {
      await this.db
        .update(liveStreams)
        .set({ status: 'ended', checkedAt: new Date() })
        .where(inArray(liveStreams.videoId, vanished));
    }

    const byChannel = new Map<string, YoutubeVideoStatus[]>();
    for (const status of statuses.values()) {
      const channelId = owner.get(status.videoId)!;
      byChannel.set(channelId, [...(byChannel.get(channelId) ?? []), status]);
    }
    for (const [channelId, list] of byChannel) {
      await this.upsertStatuses(channelId, list, false);
    }
    await this.db
      .update(liveChannels)
      .set({ lastPolledAt: new Date() })
      .where(
        inArray(
          liveChannels.id,
          channels.map((channel) => channel.id),
        ),
      );

    await this.notifyNewlyLive();
    await this.clearListCache();
    return {
      checked: toCheck.length,
      live: [...statuses.values()].filter((s) => s.status === 'live').length,
    };
  }

  private async upsertStatuses(
    channelId: string,
    list: YoutubeVideoStatus[],
    pin: boolean,
  ): Promise<void> {
    if (list.length === 0) {
      return;
    }
    const now = new Date();
    await this.db
      .insert(liveStreams)
      .values(
        list.map((status) => ({
          videoId: status.videoId,
          channelId,
          title: status.title,
          thumbnailUrl: status.thumbnailUrl,
          status: status.status,
          pinned: pin,
          scheduledStartAt: status.scheduledStartAt,
          actualStartAt: status.actualStartAt,
          actualEndAt: status.actualEndAt,
          concurrentViewers: status.concurrentViewers,
          checkedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: liveStreams.videoId,
        set: {
          title: sql`excluded.title`,
          thumbnailUrl: sql`excluded.thumbnail_url`,
          status: sql`excluded.status`,
          scheduledStartAt: sql`excluded.scheduled_start_at`,
          actualStartAt: sql`excluded.actual_start_at`,
          actualEndAt: sql`excluded.actual_end_at`,
          concurrentViewers: sql`excluded.concurrent_viewers`,
          checkedAt: sql`excluded.checked_at`,
          ...(pin ? { pinned: sql`true` } : {}),
        },
      });
  }

  /** Streams from notify-enabled channels that just went live get one push each. */
  private async notifyNewlyLive(): Promise<void> {
    const rows = await this.db
      .update(liveStreams)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(liveStreams.status, 'live'),
          isNull(liveStreams.notifiedAt),
          sql`${liveStreams.channelId} in (select id from ${liveChannels} where notify_on_live and enabled)`,
          // Pinned 24/7 streams are always live; announcing them would be noise.
          eq(liveStreams.pinned, false),
        ),
      )
      .returning({ videoId: liveStreams.videoId, title: liveStreams.title });
    for (const row of rows) {
      await this.notifications.add(
        JOBS.broadcast,
        {
          title: 'Canlı yayın başladı',
          body: row.title,
          data: { type: 'live', videoId: row.videoId },
          audience: 'live_subscribers',
        },
        { jobId: jobId('live-notify', row.videoId) },
      );
    }
  }

  private async clearListCache(): Promise<void> {
    const keys: string[] = [];
    for (const status of ['all', 'live', 'upcoming']) {
      for (const category of ['all', 'haramain', 'dua', 'quran', 'sohbet', 'other']) {
        keys.push(`live:list:${status}:${category}`);
      }
    }
    await this.redis.del(...keys);
  }
}

function toView(
  stream: typeof liveStreams.$inferSelect,
  channel: typeof liveChannels.$inferSelect,
): StreamView {
  return {
    videoId: stream.videoId,
    title: stream.title,
    thumbnailUrl: stream.thumbnailUrl,
    status: stream.status as 'live' | 'upcoming',
    scheduledStartAt: stream.scheduledStartAt?.toISOString() ?? null,
    actualStartAt: stream.actualStartAt?.toISOString() ?? null,
    concurrentViewers: stream.concurrentViewers,
    channel: {
      id: channel.id,
      title: channel.title,
      thumbnailUrl: channel.thumbnailUrl,
      category: channel.category,
      language: channel.language,
    },
    embedUrl: `https://www.youtube.com/embed/${stream.videoId}`,
    watchUrl: `https://www.youtube.com/watch?v=${stream.videoId}`,
  };
}
