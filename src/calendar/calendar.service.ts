import { Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, like, sql } from 'drizzle-orm';
import { type Database, InjectDb } from '../db/database.module.js';
import { hijriMonths, prayerTimes, religiousDays } from '../db/schema/index.js';
import { AladhanClient } from './aladhan.client.js';
import { approximateHijriYear, startsFromDiyanetRows } from './hijri.js';
import { generateReligiousDays, type MonthStarts } from './religious-days.js';

type MonthRow = typeof hijriMonths.$inferSelect;

export interface SyncReport {
  hijriYear: number;
  months: Array<{
    month: number;
    start: string | null;
    source: MonthRow['source'] | null;
    verified: boolean;
    conflict: string | null;
  }>;
  generated: number;
}

/**
 * Keeps the hijri calendar and the holy-day list current without anyone typing
 * dates in:
 *
 * 1. Month starts come from Diyanet's own daily tables (which we already store
 *    with every prayer-times fetch) where available — authoritative — and from
 *    Aladhan's DIYANET calendar otherwise. Where both exist they are compared;
 *    agreement marks the month verified, disagreement is recorded for an admin
 *    while Diyanet's table wins.
 * 2. Holy days are derived from those starts by Diyanet's rules and upserted as
 *    `auto` rows. Admin (`manual`) rows are never overwritten.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly aladhan: AladhanClient,
  ) {}

  /** The current and the next hijri year. */
  async syncUpcoming(): Promise<SyncReport[]> {
    const current = approximateHijriYear();
    const reports: SyncReport[] = [];
    for (const year of [current, current + 1]) {
      reports.push(await this.syncYear(year));
    }
    return reports;
  }

  async syncYear(hijriYear: number): Promise<SyncReport> {
    const existing = new Map(
      (await this.db.select().from(hijriMonths).where(eq(hijriMonths.hijriYear, hijriYear))).map(
        (row) => [row.month, row],
      ),
    );

    const diyanetRows = await this.db
      .selectDistinct({ date: prayerTimes.date, hijriShort: prayerTimes.hijriShort })
      .from(prayerTimes)
      .where(like(prayerTimes.hijriShort, `%.${hijriYear}`));
    const fromTables = startsFromDiyanetRows(diyanetRows, hijriYear);

    for (let month = 1; month <= 12; month += 1) {
      const previous = existing.get(month);
      let aladhan: { start: string; length: number } | undefined;
      try {
        aladhan = await this.aladhan.month(month, hijriYear);
      } catch (error) {
        this.logger.warn(`Aladhan ${month}/${hijriYear}: ${(error as Error).message}`);
      }

      const tableStart =
        fromTables.starts.get(month) ??
        (previous?.source === 'diyanet_tables' ? previous.startDate : undefined);
      const notes: string[] = [];
      if (fromTables.inconsistent.has(month)) {
        notes.push('Diyanet tables imply more than one start date');
      }

      let row: typeof hijriMonths.$inferInsert | undefined;
      if (tableStart) {
        const agrees = aladhan ? aladhan.start === tableStart : undefined;
        if (agrees === false) {
          notes.push(
            `Aladhan says ${aladhan!.start}, Diyanet tables say ${tableStart}; using Diyanet`,
          );
        }
        row = {
          hijriYear,
          month,
          startDate: tableStart,
          length: aladhan?.length ?? previous?.length ?? null,
          source: 'diyanet_tables',
          verified: agrees ?? previous?.verified ?? false,
          conflict: notes.length > 0 ? notes.join('; ') : null,
        };
      } else if (aladhan) {
        row = {
          hijriYear,
          month,
          startDate: aladhan.start,
          length: aladhan.length,
          source: 'aladhan_diyanet',
          verified: false,
          conflict: notes.length > 0 ? notes.join('; ') : null,
        };
      }
      if (row) {
        await this.db
          .insert(hijriMonths)
          .values({ ...row, fetchedAt: new Date() })
          .onConflictDoUpdate({
            target: [hijriMonths.hijriYear, hijriMonths.month],
            set: { ...row, fetchedAt: new Date() },
          });
      }
    }

    const months = await this.db
      .select()
      .from(hijriMonths)
      .where(eq(hijriMonths.hijriYear, hijriYear))
      .orderBy(asc(hijriMonths.month));
    const starts: MonthStarts = Object.fromEntries(months.map((row) => [row.month, row.startDate]));
    const generated = await this.upsertGenerated(hijriYear, starts);

    return {
      hijriYear,
      months: Array.from({ length: 12 }, (_, i) => {
        const row = months.find((m) => m.month === i + 1);
        return {
          month: i + 1,
          start: row?.startDate ?? null,
          source: row?.source ?? null,
          verified: row?.verified ?? false,
          conflict: row?.conflict ?? null,
        };
      }),
      generated,
    };
  }

  /** Calendar health for the admin screen. */
  async status() {
    const current = approximateHijriYear();
    const months = await this.db
      .select()
      .from(hijriMonths)
      .where(inArray(hijriMonths.hijriYear, [current - 1, current, current + 1]))
      .orderBy(asc(hijriMonths.hijriYear), asc(hijriMonths.month));
    return {
      currentHijriYear: current,
      months,
      conflicts: months.filter((month) => month.conflict),
    };
  }

  private async upsertGenerated(hijriYear: number, starts: MonthStarts): Promise<number> {
    const days = generateReligiousDays(hijriYear, starts);
    if (days.length === 0) {
      return 0;
    }
    await this.db
      .insert(religiousDays)
      .values(days.map((day) => ({ ...day, note: day.note ?? null, source: 'auto' as const })))
      .onConflictDoUpdate({
        target: [religiousDays.key, religiousDays.hijriYear],
        set: {
          date: sql`excluded.date`,
          nameTr: sql`excluded.name_tr`,
          nameEn: sql`excluded.name_en`,
          hijri: sql`excluded.hijri`,
          updatedAt: sql`now()`,
        },
        // Never overwrite an admin's correction.
        setWhere: eq(religiousDays.source, 'auto'),
      });
    return days.length;
  }

  /** Drop an admin override so the generated date applies again. */
  async revertToAuto(key: string, hijriYear: number): Promise<void> {
    await this.db
      .delete(religiousDays)
      .where(
        and(
          eq(religiousDays.key, key),
          eq(religiousDays.hijriYear, hijriYear),
          eq(religiousDays.source, 'manual'),
        ),
      );
    const months = await this.db
      .select()
      .from(hijriMonths)
      .where(eq(hijriMonths.hijriYear, hijriYear));
    await this.upsertGenerated(
      hijriYear,
      Object.fromEntries(months.map((row) => [row.month, row.startDate])),
    );
  }
}
