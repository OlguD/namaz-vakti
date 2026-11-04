import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const chatRooms = pgTable('chat_rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  language: text('language'),
  slowModeSeconds: integer('slow_mode_seconds').notNull().default(3),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  'chat_messages',
  {
    // Monotonic numeric IDs give cheap, stable cursor pagination.
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    roomId: text('room_id')
      .notNull()
      .references(() => chatRooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    /** Client-generated id so a resent message is not stored twice. */
    clientMessageId: text('client_message_id'),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenReason: text('hidden_reason'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('chat_messages_room_id_idx').on(t.roomId, t.id),
    index('chat_messages_user_idx').on(t.userId, t.createdAt),
    uniqueIndex('chat_messages_client_id_unique').on(t.userId, t.clientMessageId),
  ],
);

export const reportReason = pgEnum('chat_report_reason', [
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'misinformation',
  'other',
]);
export const reportStatus = pgEnum('chat_report_status', ['open', 'actioned', 'dismissed']);

export const chatReports = pgTable(
  'chat_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: bigint('message_id', { mode: 'number' })
      .notNull()
      .references(() => chatMessages.id, { onDelete: 'cascade' }),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: reportReason('reason').notNull(),
    note: text('note'),
    status: reportStatus('status').notNull().default('open'),
    handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('chat_reports_message_reporter_unique').on(t.messageId, t.reporterId),
    index('chat_reports_status_idx').on(t.status, t.createdAt),
  ],
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);
