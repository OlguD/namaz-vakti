import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Personal khatm progress. `juz` = juz finished in the current khatm (0–30),
 * `page` = pages read inside the next juz (0–19; a juz is ~20 pages).
 */
export const quranProgress = pgTable(
  'quran_progress',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    juz: smallint('juz').notNull().default(0),
    page: smallint('page').notNull().default(0),
    completedKhatms: integer('completed_khatms').notNull().default(0),
    targetDate: date('target_date', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('quran_progress_juz_range', sql`${t.juz} BETWEEN 0 AND 30`),
    check('quran_progress_page_range', sql`${t.page} BETWEEN 0 AND 19`),
  ],
);

/** Pages read per day; feeds the streak and "today" summaries. */
export const quranReadingDays = pgTable(
  'quran_reading_days',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    pages: integer('pages').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    check('quran_reading_days_pages', sql`${t.pages} >= 0`),
  ],
);

export const groupHatims = pgTable(
  'group_hatims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Short, random, rotatable code used in invite links. */
    inviteCode: text('invite_code').notNull(),
    targetDate: date('target_date', { mode: 'string' }),
    /** Increments each time all 30 juz are read and a new round starts. */
    round: integer('round').notNull().default(1),
    completedRounds: integer('completed_rounds').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('group_hatims_invite_unique').on(t.inviteCode)],
);

export const hatimMemberRole = pgEnum('hatim_member_role', ['owner', 'member']);

export const groupHatimMembers = pgTable(
  'group_hatim_members',
  {
    hatimId: uuid('hatim_id')
      .notNull()
      .references(() => groupHatims.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: hatimMemberRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.hatimId, t.userId] }),
    index('group_hatim_members_user_idx').on(t.userId),
  ],
);

export const juzStatus = pgEnum('juz_status', ['open', 'taken', 'read']);

/** Exactly 30 rows per group khatm, created with it. */
export const groupHatimJuz = pgTable(
  'group_hatim_juz',
  {
    hatimId: uuid('hatim_id')
      .notNull()
      .references(() => groupHatims.id, { onDelete: 'cascade' }),
    juz: smallint('juz').notNull(),
    status: juzStatus('status').notNull().default('open'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.hatimId, t.juz] }),
    index('group_hatim_juz_user_idx').on(t.userId),
    check('group_hatim_juz_range', sql`${t.juz} BETWEEN 1 AND 30`),
  ],
);
