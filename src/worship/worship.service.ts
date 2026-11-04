import { HttpStatus, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { AppError } from '../common/errors.js';
import { type Database, InjectDb, type Tx } from '../db/database.module.js';
import {
  customDhikrs,
  dhikrCounts,
  prayerLogs,
  qadaDebts,
  quranProgress,
  quranReadingDays,
  syncBatches,
} from '../db/schema/index.js';
import { addDays } from '../prayer-times/time-utils.js';
import { BUILTIN_DHIKRS, BUILTIN_KEYS, customDhikrId } from './dhikr-catalog.js';
import { assertRange, assertUserDate, streakLength } from './day.js';
import { estimateQada, QADA_KEYS, type QadaEstimateInput, type QadaKey } from './qada.js';

export const VAKITS = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'] as const;
export type Vakit = (typeof VAKITS)[number];
export type PrayerStatus = 'prayed' | 'jamaah' | 'qada';

export interface DhikrEntry {
  date: string;
  dhikrKey: string;
  count: number;
}

const MAX_CUSTOM_DHIKRS = 50;
const HEATMAP_DAYS = 105;
const STREAK_LOOKBACK_DAYS = 400;

@Injectable()
export class WorshipService {
  constructor(@InjectDb() private readonly db: Database) {}

  // ---- prayers -------------------------------------------------------------

  async prayers(userId: string, from: string, to: string) {
    assertRange(from, to, 62);
    const rows = await this.db
      .select({ date: prayerLogs.date, vakit: prayerLogs.vakit, status: prayerLogs.status })
      .from(prayerLogs)
      .where(
        and(eq(prayerLogs.userId, userId), gte(prayerLogs.date, from), lte(prayerLogs.date, to)),
      )
      .orderBy(asc(prayerLogs.date));

    const byDate = new Map<string, Record<Vakit, PrayerStatus | null>>();
    for (let day = from; day <= to; day = addDays(day, 1)) {
      byDate.set(day, { sabah: null, ogle: null, ikindi: null, aksam: null, yatsi: null });
    }
    let prayed = 0;
    let jamaah = 0;
    let qada = 0;
    for (const row of rows) {
      byDate.get(row.date)![row.vakit] = row.status;
      if (row.status === 'qada') qada += 1;
      else prayed += 1;
      if (row.status === 'jamaah') jamaah += 1;
    }
    return {
      from,
      to,
      days: [...byDate].map(([date, vakits]) => ({ date, ...vakits })),
      // "done" counts prayers on time (alone or in congregation); the app knows
      // how many vakits have already come in and shows done / due.
      totals: { done: prayed, jamaah, qada },
    };
  }

  async setPrayer(
    userId: string,
    date: string,
    vakit: Vakit,
    status: PrayerStatus | null,
  ): Promise<void> {
    assertUserDate(date);
    if (status === null) {
      await this.db
        .delete(prayerLogs)
        .where(
          and(
            eq(prayerLogs.userId, userId),
            eq(prayerLogs.date, date),
            eq(prayerLogs.vakit, vakit),
          ),
        );
      return;
    }
    await this.db
      .insert(prayerLogs)
      .values({ userId, date, vakit, status })
      .onConflictDoUpdate({
        target: [prayerLogs.userId, prayerLogs.date, prayerLogs.vakit],
        set: { status, updatedAt: new Date() },
      });
  }

  // ---- qada ---------------------------------------------------------------

  async qada(userId: string) {
    const [row] = await this.db.select().from(qadaDebts).where(eq(qadaDebts.userId, userId));
    return toQadaView(row);
  }

  async setQada(userId: string, values: Record<QadaKey, number>) {
    const [row] = await this.db
      .insert(qadaDebts)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: qadaDebts.userId, set: { ...values, updatedAt: new Date() } })
      .returning();
    return toQadaView(row);
  }

  /** Atomic +/- on one counter, never below zero (two devices can tap at once). */
  async adjustQada(userId: string, key: QadaKey, delta: number) {
    const column = qadaDebts[key];
    await this.db
      .insert(qadaDebts)
      .values({ userId, [key]: Math.max(0, delta) })
      .onConflictDoUpdate({
        target: qadaDebts.userId,
        set: { [key]: sql`GREATEST(0, ${column} + ${delta})`, updatedAt: new Date() },
      });
    return this.qada(userId);
  }

  estimateQada(input: QadaEstimateInput) {
    if (input.regularSince < input.birthYear + input.pubertyAge) {
      return { ...estimateQada(input), perVakit: 0, total: 0 };
    }
    return estimateQada(input);
  }

  // ---- dhikr ---------------------------------------------------------------

  async dhikrs(userId: string) {
    const custom = await this.db
      .select()
      .from(customDhikrs)
      .where(eq(customDhikrs.userId, userId))
      .orderBy(asc(customDhikrs.createdAt));
    return {
      builtin: BUILTIN_DHIKRS.map((dhikr) => ({ ...dhikr, custom: false })),
      custom: custom.map((row) => ({
        key: `custom:${row.id}`,
        id: row.id,
        arabic: row.arabic,
        transliteration: row.transliteration,
        meaning: row.meaning,
        target: row.target,
        custom: true,
      })),
    };
  }

  async createDhikr(
    userId: string,
    input: { arabic?: string; transliteration: string; meaning?: string; target: number },
  ) {
    const existing = await this.db.$count(customDhikrs, eq(customDhikrs.userId, userId));
    if (existing >= MAX_CUSTOM_DHIKRS) {
      throw AppError.badRequest(
        'VALIDATION_FAILED',
        `You can keep at most ${MAX_CUSTOM_DHIKRS} custom dhikrs`,
      );
    }
    const [row] = await this.db
      .insert(customDhikrs)
      .values({
        userId,
        arabic: input.arabic?.trim() || null,
        transliteration: input.transliteration.trim(),
        meaning: input.meaning?.trim() || null,
        target: input.target,
      })
      .returning();
    return { key: `custom:${row!.id}`, ...row!, custom: true };
  }

  async updateDhikr(
    userId: string,
    id: string,
    patch: {
      arabic?: string | null;
      transliteration?: string;
      meaning?: string | null;
      target?: number;
    },
  ) {
    const [row] = await this.db
      .update(customDhikrs)
      .set(patch)
      .where(and(eq(customDhikrs.id, id), eq(customDhikrs.userId, userId)))
      .returning();
    if (!row) {
      throw AppError.notFound('Dhikr');
    }
    return { key: `custom:${row.id}`, ...row, custom: true };
  }

  /** Counts already synced for it stay in history under its key. */
  async deleteDhikr(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(customDhikrs)
      .where(and(eq(customDhikrs.id, id), eq(customDhikrs.userId, userId)))
      .returning({ id: customDhikrs.id });
    if (deleted.length === 0) {
      throw AppError.notFound('Dhikr');
    }
  }

  /**
   * Applies a batch of count deltas counted on a device. Each batch carries a
   * client-generated id; a batch already seen is acknowledged without being
   * applied again, so retries after a lost response never double-count.
   */
  async syncDhikr(
    userId: string,
    batchId: string,
    entries: DhikrEntry[],
  ): Promise<{ applied: boolean }> {
    for (const entry of entries) {
      assertUserDate(entry.date);
    }
    await this.assertKnownKeys(
      userId,
      entries.map((entry) => entry.dhikrKey),
    );

    // Merge duplicates inside the batch so one upsert per (date, key) runs.
    const merged = new Map<string, DhikrEntry>();
    for (const entry of entries) {
      const id = `${entry.date}|${entry.dhikrKey}`;
      const prev = merged.get(id);
      merged.set(id, prev ? { ...prev, count: prev.count + entry.count } : { ...entry });
    }

    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(syncBatches)
        .values({ userId, batchId })
        .onConflictDoNothing()
        .returning({ batchId: syncBatches.batchId });
      if (inserted.length === 0) {
        return { applied: false };
      }
      if (merged.size > 0) {
        await tx
          .insert(dhikrCounts)
          .values([...merged.values()].map((entry) => ({ userId, ...entry })))
          .onConflictDoUpdate({
            target: [dhikrCounts.userId, dhikrCounts.date, dhikrCounts.dhikrKey],
            set: { count: sql`${dhikrCounts.count} + excluded.count`, updatedAt: new Date() },
          });
      }
      return { applied: true };
    });
  }

  async dhikrStats(userId: string, range: 'week' | 'month', today: string) {
    assertUserDate(today, 'today');
    const span = range === 'week' ? 7 : 30;
    const from = addDays(today, -(span - 1));
    const heatFrom = addDays(today, -(HEATMAP_DAYS - 1));

    const daily = await this.db
      .select({ date: dhikrCounts.date, total: sql<number>`sum(${dhikrCounts.count})::int` })
      .from(dhikrCounts)
      .where(
        and(
          eq(dhikrCounts.userId, userId),
          gte(dhikrCounts.date, heatFrom),
          lte(dhikrCounts.date, today),
        ),
      )
      .groupBy(dhikrCounts.date);
    const totals = new Map(daily.map((row) => [row.date, row.total]));

    const days: Array<{ date: string; total: number }> = [];
    for (let day = from; day <= today; day = addDays(day, 1)) {
      days.push({ date: day, total: totals.get(day) ?? 0 });
    }
    const heatmap: Array<{ date: string; total: number }> = [];
    for (let day = heatFrom; day <= today; day = addDays(day, 1)) {
      heatmap.push({ date: day, total: totals.get(day) ?? 0 });
    }

    const topRows = await this.db
      .select({ key: dhikrCounts.dhikrKey, total: sql<number>`sum(${dhikrCounts.count})::int` })
      .from(dhikrCounts)
      .where(
        and(
          eq(dhikrCounts.userId, userId),
          gte(dhikrCounts.date, from),
          lte(dhikrCounts.date, today),
        ),
      )
      .groupBy(dhikrCounts.dhikrKey)
      .orderBy(desc(sql`sum(${dhikrCounts.count})`))
      .limit(5);
    const labels = await this.dhikrLabels(
      userId,
      topRows.map((row) => row.key),
    );

    const total = days.reduce((sum, day) => sum + day.total, 0);
    return {
      range,
      from,
      to: today,
      days,
      total,
      average: Math.round(total / span),
      top: topRows.map((row) => ({
        key: row.key,
        label: labels.get(row.key) ?? 'Silinmiş zikir',
        total: row.total,
      })),
      heatmap,
      streakDays: await this.streak(userId, today),
    };
  }

  // ---- summary --------------------------------------------------------------

  /** Everything the İbadet home card shows, in one call. */
  async summary(userId: string, today: string) {
    assertUserDate(today, 'date');
    const [prayersToday, [dhikr], [progress], streakDays] = await Promise.all([
      this.db
        .select({ vakit: prayerLogs.vakit, status: prayerLogs.status })
        .from(prayerLogs)
        .where(and(eq(prayerLogs.userId, userId), eq(prayerLogs.date, today))),
      this.db
        .select({ total: sql<number>`coalesce(sum(${dhikrCounts.count}), 0)::int` })
        .from(dhikrCounts)
        .where(and(eq(dhikrCounts.userId, userId), eq(dhikrCounts.date, today))),
      this.db.select().from(quranProgress).where(eq(quranProgress.userId, userId)),
      this.streak(userId, today),
    ]);
    const statuses = Object.fromEntries(VAKITS.map((vakit) => [vakit, null])) as Record<
      Vakit,
      PrayerStatus | null
    >;
    for (const row of prayersToday) {
      statuses[row.vakit] = row.status;
    }
    const juz = progress?.juz ?? 0;
    const page = progress?.page ?? 0;
    return {
      date: today,
      prayers: {
        done: prayersToday.filter((row) => row.status !== 'qada').length,
        total: VAKITS.length,
        statuses,
      },
      dhikrToday: dhikr?.total ?? 0,
      quran: {
        currentJuz: Math.min(30, juz + 1),
        percent: Math.round(((juz * 20 + page) / 600) * 100),
      },
      streakDays,
    };
  }

  /** Days with any recorded worship: a prayer on time, a dhikr, or Qur'an reading. */
  async streak(userId: string, today: string, tx: Database | Tx = this.db): Promise<number> {
    const since = addDays(today, -STREAK_LOOKBACK_DAYS);
    const result = await tx.execute<{ date: string }>(sql`
      SELECT date::text AS date FROM ${prayerLogs}
        WHERE user_id = ${userId} AND date >= ${since}::date AND date <= ${today}::date AND status <> 'qada'
      UNION
      SELECT date::text FROM ${dhikrCounts}
        WHERE user_id = ${userId} AND date >= ${since}::date AND date <= ${today}::date AND count > 0
      UNION
      SELECT date::text FROM ${quranReadingDays}
        WHERE user_id = ${userId} AND date >= ${since}::date AND date <= ${today}::date AND pages > 0
    `);
    return streakLength(new Set(result.rows.map((row) => row.date)), today);
  }

  /** Worker: forget idempotency keys older than any client would retry. */
  async pruneSyncBatches(): Promise<number> {
    const result = await this.db
      .delete(syncBatches)
      .where(sql`${syncBatches.createdAt} < now() - interval '30 days'`);
    return result.rowCount ?? 0;
  }

  private async assertKnownKeys(userId: string, keys: string[]): Promise<void> {
    const customIds = new Set<string>();
    for (const key of new Set(keys)) {
      if (BUILTIN_KEYS.has(key)) {
        continue;
      }
      const id = customDhikrId(key);
      if (!id) {
        throw AppError.badRequest('VALIDATION_FAILED', `Unknown dhikr key: ${key.slice(0, 60)}`);
      }
      customIds.add(id);
    }
    if (customIds.size === 0) {
      return;
    }
    const [{ owned } = { owned: 0 }] = await this.db
      .select({ owned: count() })
      .from(customDhikrs)
      .where(and(eq(customDhikrs.userId, userId), inArray(customDhikrs.id, [...customIds])));
    if (owned !== customIds.size) {
      throw new AppError(
        'NOT_FOUND',
        'One or more custom dhikrs do not exist',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async dhikrLabels(userId: string, keys: string[]): Promise<Map<string, string>> {
    const labels = new Map<string, string>(
      BUILTIN_DHIKRS.map((dhikr) => [dhikr.key, dhikr.transliteration]),
    );
    const ids = keys.map(customDhikrId).filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      const rows = await this.db
        .select({ id: customDhikrs.id, label: customDhikrs.transliteration })
        .from(customDhikrs)
        .where(and(eq(customDhikrs.userId, userId), inArray(customDhikrs.id, ids)));
      for (const row of rows) {
        labels.set(`custom:${row.id}`, row.label);
      }
    }
    return labels;
  }
}

function toQadaView(row: typeof qadaDebts.$inferSelect | undefined) {
  const counts = Object.fromEntries(QADA_KEYS.map((key) => [key, row?.[key] ?? 0])) as Record<
    QadaKey,
    number
  >;
  return {
    ...counts,
    total: QADA_KEYS.reduce((sum, key) => sum + counts[key], 0),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}
