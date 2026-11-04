import { date, index, pgEnum, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { districts } from './locations.js';

export const prayerTimesSource = pgEnum('prayer_times_source', [
  'emushaf',
  'diyanet',
  'calculated',
]);

/**
 * One row per district per day. Times are stored as local wall-clock "HH:mm" strings
 * exactly as published; converting to instants happens at read time with the
 * district's IANA zone. Storing offsets here would bake in the upstream bug where
 * every row carries Türkiye's offset regardless of location.
 */
export const prayerTimes = pgTable(
  'prayer_times',
  {
    districtId: text('district_id')
      .notNull()
      .references(() => districts.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    imsak: text('imsak').notNull(),
    gunes: text('gunes').notNull(),
    ogle: text('ogle').notNull(),
    ikindi: text('ikindi').notNull(),
    aksam: text('aksam').notNull(),
    yatsi: text('yatsi').notNull(),
    sunrise: text('sunrise'),
    sunset: text('sunset'),
    qiblaTime: text('qibla_time'),
    hijriShort: text('hijri_short'),
    hijriLong: text('hijri_long'),
    moonPhaseUrl: text('moon_phase_url'),
    source: prayerTimesSource('source').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.districtId, t.date] }),
    index('prayer_times_date_idx').on(t.date),
  ],
);
