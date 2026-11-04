import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
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

export const contentSource = pgEnum('content_source', ['auto', 'manual']);

/**
 * Holy days. `auto` rows are generated from the Diyanet hijri calendar every
 * week; `manual` rows (admin overrides) are never touched by the generator and
 * take the place of the auto row with the same key and hijri year.
 */
export const religiousDays = pgTable(
  'religious_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    /** Stable kind, e.g. "regaip-kandili", "ramazan-bayrami-1", for icons and reminders. */
    key: text('key').notNull(),
    hijriYear: integer('hijri_year').notNull(),
    nameTr: text('name_tr').notNull(),
    nameEn: text('name_en'),
    hijri: text('hijri'),
    note: text('note'),
    source: contentSource('source').notNull().default('manual'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('religious_days_key_year_unique').on(t.key, t.hijriYear),
    index('religious_days_date_idx').on(t.date),
  ],
);

export const hijriMonthSource = pgEnum('hijri_month_source', ['diyanet_tables', 'aladhan_diyanet']);

/**
 * Gregorian start of each hijri month, per Diyanet. Taken from Diyanet's own
 * daily tables (via the prayer-times provider) where we have them, else from
 * Aladhan's DIYANET calendar; `verified` means both sources agree.
 */
export const hijriMonths = pgTable(
  'hijri_months',
  {
    hijriYear: integer('hijri_year').notNull(),
    month: smallint('month').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    length: smallint('length'),
    source: hijriMonthSource('source').notNull(),
    verified: boolean('verified').notNull().default(false),
    /** Set when the two sources disagree; holy days of that month then wait for an admin. */
    conflict: text('conflict'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.hijriYear, t.month] }),
    check('hijri_months_month_range', sql`${t.month} BETWEEN 1 AND 12`),
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
    usdTry: numeric('usd_try', { precision: 14, scale: 4 }),
    goldNisabGrams: numeric('gold_nisab_grams', { precision: 8, scale: 2 })
      .notNull()
      .default('80.18'),
    silverNisabGrams: numeric('silver_nisab_grams', { precision: 8, scale: 2 })
      .notNull()
      .default('561'),
    /** `auto`: refreshed from market data; `manual`: pinned by an admin. */
    source: contentSource('source').notNull().default('auto'),
    /** When prices were last taken from market data (null if never). */
    fetchedAt: timestamp('fetched_at', { withTimezone: true }),
    lastError: text('last_error'),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('zakat_settings_single_row', sql`${t.id} = 1`)],
);

/** Every accepted market-price snapshot, for audit and the jump check. */
export const metalPriceHistory = pgTable(
  'metal_price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    usdTry: numeric('usd_try', { precision: 14, scale: 4 }).notNull(),
    goldUsdOunce: numeric('gold_usd_ounce', { precision: 14, scale: 4 }).notNull(),
    silverUsdOunce: numeric('silver_usd_ounce', { precision: 14, scale: 4 }).notNull(),
    goldGramPrice: numeric('gold_gram_price', { precision: 14, scale: 2 }).notNull(),
    silverGramPrice: numeric('silver_gram_price', { precision: 14, scale: 2 }).notNull(),
    fxDate: date('fx_date', { mode: 'string' }),
  },
  (t) => [index('metal_price_history_fetched_idx').on(t.fetchedAt)],
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
