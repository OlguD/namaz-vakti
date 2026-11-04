import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Editorial content served to the app, so it can be corrected or extended
 * without an app-store release. Religious texts must be reviewed by a qualified
 * person before they are published.
 */
export const duaCategories = pgTable('dua_categories', {
  id: text('id').primaryKey(),
  nameTr: text('name_tr').notNull(),
  nameEn: text('name_en'),
  nameAr: text('name_ar'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const duas = pgTable(
  'duas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stable slug so content files can be re-imported without duplicates. */
    key: text('key').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => duaCategories.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    arabic: text('arabic').notNull(),
    transliteration: text('transliteration'),
    meaningTr: text('meaning_tr').notNull(),
    meaningEn: text('meaning_en'),
    source: text('source'),
    sortOrder: integer('sort_order').notNull().default(0),
    published: boolean('published').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('duas_key_unique').on(t.key),
    index('duas_category_idx').on(t.categoryId, t.sortOrder),
  ],
);

export const esma = pgTable(
  'esma',
  {
    no: smallint('no').primaryKey(),
    arabic: text('arabic').notNull(),
    transliteration: text('transliteration').notNull(),
    meaningTr: text('meaning_tr'),
    meaningEn: text('meaning_en'),
  },
  (t) => [check('esma_no_range', sql`${t.no} BETWEEN 1 AND 99`)],
);

/** Holy days as published by Diyanet for each year (imported, not computed). */
export const religiousDays = pgTable(
  'religious_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    /** Stable kind, e.g. "regaip", "ramazan-bayrami-1", for client-side icons and reminders. */
    key: text('key').notNull(),
    nameTr: text('name_tr').notNull(),
    nameEn: text('name_en'),
    hijri: text('hijri'),
    note: text('note'),
  },
  (t) => [
    uniqueIndex('religious_days_date_key_unique').on(t.date, t.key),
    index('religious_days_date_idx').on(t.date),
  ],
);

/** Single-row table with the inputs the zakat calculator needs. */
export const zakatSettings = pgTable(
  'zakat_settings',
  {
    id: smallint('id').primaryKey().default(1),
    currency: text('currency').notNull().default('TRY'),
    goldGramPrice: numeric('gold_gram_price', { precision: 14, scale: 2 }),
    silverGramPrice: numeric('silver_gram_price', { precision: 14, scale: 2 }),
    goldNisabGrams: numeric('gold_nisab_grams', { precision: 8, scale: 2 })
      .notNull()
      .default('80.18'),
    silverNisabGrams: numeric('silver_nisab_grams', { precision: 8, scale: 2 })
      .notNull()
      .default('561'),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('zakat_settings_single_row', sql`${t.id} = 1`)],
);

/** Per-user app settings (theme, language, notification prefs, favourites) as one versioned document. */
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
