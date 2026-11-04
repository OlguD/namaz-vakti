import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const vakit = pgEnum('vakit', ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi']);
export const prayerStatus = pgEnum('prayer_status', ['prayed', 'jamaah', 'qada']);

/** One row per performed (or made-up) prayer; an unmarked prayer has no row. */
export const prayerLogs = pgTable(
  'prayer_logs',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    vakit: vakit('vakit').notNull(),
    status: prayerStatus('status').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.vakit] })],
);

/** Outstanding make-up prayers per vakit (vitir included, per the Hanafi view). */
export const qadaDebts = pgTable(
  'qada_debts',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    sabah: integer('sabah').notNull().default(0),
    ogle: integer('ogle').notNull().default(0),
    ikindi: integer('ikindi').notNull().default(0),
    aksam: integer('aksam').notNull().default(0),
    yatsi: integer('yatsi').notNull().default(0),
    vitir: integer('vitir').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'qada_debts_non_negative',
      sql`${t.sabah} >= 0 AND ${t.ogle} >= 0 AND ${t.ikindi} >= 0 AND ${t.aksam} >= 0 AND ${t.yatsi} >= 0 AND ${t.vitir} >= 0`,
    ),
  ],
);

/** User-defined dhikr. Built-in ones (sübhanallah, …) live in code, not here. */
export const customDhikrs = pgTable(
  'custom_dhikrs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    arabic: text('arabic'),
    transliteration: text('transliteration').notNull(),
    meaning: text('meaning'),
    target: integer('target').notNull().default(33),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('custom_dhikrs_user_idx').on(t.userId),
    check('custom_dhikrs_target_range', sql`${t.target} BETWEEN 1 AND 100000`),
  ],
);

/**
 * Daily totals per dhikr. The app counts offline and syncs deltas; totals are
 * what the statistics screens need, individual taps are never stored.
 * `dhikrKey` is a built-in key ("subhanallah") or "custom:<uuid>".
 */
export const dhikrCounts = pgTable(
  'dhikr_counts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    dhikrKey: text('dhikr_key').notNull(),
    count: integer('count').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date, t.dhikrKey] }),
    check('dhikr_counts_non_negative', sql`${t.count} >= 0`),
  ],
);

/** Sync batches already applied, so a retried upload is not counted twice. */
export const syncBatches = pgTable(
  'sync_batches',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    batchId: text('batch_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.batchId] }),
    index('sync_batches_created_idx').on(t.createdAt),
  ],
);
