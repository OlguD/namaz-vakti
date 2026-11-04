import { sql } from 'drizzle-orm';
import {
  boolean,
  geometry,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const mosqueSource = pgEnum('mosque_source', ['osm', 'user']);

export const mosques = pgTable(
  'mosques',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: mosqueSource('source').notNull(),
    /** "node/123", "way/456" … for OSM rows; null for user-contributed ones. */
    osmRef: text('osm_ref'),
    name: text('name'),
    nameEn: text('name_en'),
    nameAr: text('name_ar'),
    location: geometry('location', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
    address: text('address'),
    website: text('website'),
    phone: text('phone'),
    wheelchair: text('wheelchair'),
    hasWomenSection: boolean('has_women_section'),
    tags: jsonb('tags').$type<Record<string, string>>(),
    /** Hidden rows stay for history but are never returned (closed, duplicate, wrong). */
    hidden: boolean('hidden').notNull().default(false),
    lastSeenInSourceAt: timestamp('last_seen_in_source_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('mosques_osm_ref_unique')
      .on(t.osmRef)
      .where(sql`${t.osmRef} is not null`),
    index('mosques_location_gix').using('gist', t.location),
    // Lets ST_DWithin(location::geography, …) use an index for metre-based radius queries.
    index('mosques_location_geog_gix').using('gist', sql`(${t.location}::geography)`),
  ],
);

/**
 * Mosques are imported lazily, one fixed-size map tile at a time, the first time a
 * user looks at that area. Each row records when a tile was last pulled from OSM.
 */
export const mosqueTiles = pgTable('mosque_tiles', {
  id: text('id').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull(),
  mosqueCount: integer('mosque_count').notNull().default(0),
});

export const suggestionKind = pgEnum('mosque_suggestion_kind', ['add', 'edit', 'closed']);
export const suggestionStatus = pgEnum('mosque_suggestion_status', [
  'open',
  'accepted',
  'rejected',
]);

export const mosqueSuggestions = pgTable(
  'mosque_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: suggestionKind('kind').notNull(),
    mosqueId: uuid('mosque_id').references(() => mosques.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    payload: jsonb('payload')
      .$type<{ name?: string; address?: string; lat?: number; lng?: number; note?: string }>()
      .notNull(),
    status: suggestionStatus('status').notNull().default('open'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('mosque_suggestions_status_idx').on(t.status, t.createdAt)],
);
