import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const liveCategory = pgEnum('live_category', [
  'haramain',
  'dua',
  'quran',
  'sohbet',
  'other',
]);

export const liveChannels = pgTable(
  'live_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    youtubeChannelId: text('youtube_channel_id').notNull(),
    title: text('title').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    category: liveCategory('category').notNull().default('other'),
    language: text('language'),
    priority: integer('priority').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    /** Push a notification to subscribers when this channel goes live. */
    notifyOnLive: boolean('notify_on_live').notNull().default(false),
    lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('live_channels_youtube_unique').on(t.youtubeChannelId)],
);

export const liveStatus = pgEnum('live_status', ['live', 'upcoming', 'ended', 'none']);

export const liveStreams = pgTable(
  'live_streams',
  {
    videoId: text('video_id').primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => liveChannels.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    status: liveStatus('status').notNull(),
    /** Pinned videos are always re-checked, even if they fall out of the channel feed. */
    pinned: boolean('pinned').notNull().default(false),
    scheduledStartAt: timestamp('scheduled_start_at', { withTimezone: true }),
    actualStartAt: timestamp('actual_start_at', { withTimezone: true }),
    actualEndAt: timestamp('actual_end_at', { withTimezone: true }),
    concurrentViewers: integer('concurrent_viewers'),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('live_streams_status_idx').on(t.status)],
);
