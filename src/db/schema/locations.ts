import { sql } from 'drizzle-orm';
import { integer, geometry, index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Location hierarchy mirrors the upstream provider (country → city → district).
 * Upstream IDs are strings, so they are used as primary keys directly; that keeps
 * every provider call a simple lookup with no ID translation.
 */
export const countries = pgTable('countries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameEn: text('name_en').notNull(),
  /** IANA zone used when a district has no coordinates yet (single-zone countries only). */
  defaultTimezone: text('default_timezone'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cities = pgTable(
  'cities',
  {
    id: text('id').primaryKey(),
    countryId: text('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameEn: text('name_en').notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
    districtsSyncedAt: timestamp('districts_synced_at', { withTimezone: true }),
  },
  (t) => [index('cities_country_idx').on(t.countryId)],
);

export const geocodeStatus = pgEnum('geocode_status', ['pending', 'ok', 'not_found', 'manual']);

export const districts = pgTable(
  'districts',
  {
    id: text('id').primaryKey(),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameEn: text('name_en').notNull(),
    location: geometry('location', { type: 'point', mode: 'xy', srid: 4326 }),
    timezone: text('timezone'),
    geocodeStatus: geocodeStatus('geocode_status').notNull().default('pending'),
    geocodeAttempts: integer('geocode_attempts').notNull().default(0),
    geocodedAt: timestamp('geocoded_at', { withTimezone: true }),
    /** Updated (throttled) whenever a client asks for this district's times. */
    lastRequestedAt: timestamp('last_requested_at', { withTimezone: true }),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('districts_city_idx').on(t.cityId),
    index('districts_location_gix').using('gist', t.location),
    index('districts_geocode_pending_idx')
      .on(t.geocodeStatus)
      .where(sql`${t.geocodeStatus} = 'pending'`),
  ],
);
