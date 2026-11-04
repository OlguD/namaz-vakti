import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { AppError } from '../common/errors.js';
import { type Database, InjectDb } from '../db/database.module.js';
import {
  duaCategories,
  duas,
  esma,
  metalPriceHistory,
  religiousDays,
  zakatSettings,
} from '../db/schema/index.js';
import { addDays, localDate } from '../prayer-times/time-utils.js';
import {
  type DuaCategoryInput,
  type DuaInput,
  type EsmaInput,
  type ReligiousDayInput,
} from './content.schemas.js';

@Injectable()
export class ContentService {
  constructor(@InjectDb() private readonly db: Database) {}

  async duas() {
    const [categories, items] = await Promise.all([
      this.db.select().from(duaCategories).orderBy(asc(duaCategories.sortOrder)),
      this.db
        .select()
        .from(duas)
        .where(eq(duas.published, true))
        .orderBy(asc(duas.categoryId), asc(duas.sortOrder)),
    ]);
    const counts = new Map<string, number>();
    for (const dua of items) {
      counts.set(dua.categoryId, (counts.get(dua.categoryId) ?? 0) + 1);
    }
    return {
      categories: categories.map((category) => ({
        ...category,
        count: counts.get(category.id) ?? 0,
      })),
      duas: items.map(({ published: _published, ...dua }) => ({
        ...dua,
        updatedAt: dua.updatedAt.toISOString(),
      })),
    };
  }

  esma() {
    return this.db.select().from(esma).orderBy(asc(esma.no));
  }

  /** Upcoming holy days; defaults to yesterday … one year ahead. */
  religiousDays(from?: string, to?: string) {
    const today = localDate(new Date(), 'Europe/Istanbul');
    const start = from ?? addDays(today, -1);
    const end = to ?? addDays(start, 400);
    return this.db
      .select({
        id: religiousDays.id,
        date: religiousDays.date,
        key: religiousDays.key,
        hijriYear: religiousDays.hijriYear,
        nameTr: religiousDays.nameTr,
        nameEn: religiousDays.nameEn,
        hijri: religiousDays.hijri,
        note: religiousDays.note,
        source: religiousDays.source,
      })
      .from(religiousDays)
      .where(and(gte(religiousDays.date, start), lte(religiousDays.date, end)))
      .orderBy(asc(religiousDays.date));
  }

  async zakatRates() {
    const [row] = await this.db.select().from(zakatSettings).where(eq(zakatSettings.id, 1));
    const gold = row?.goldGramPrice ? Number(row.goldGramPrice) : null;
    const goldNisab = Number(row?.goldNisabGrams ?? 80.18);
    return {
      currency: row?.currency ?? 'TRY',
      goldGramPrice: gold,
      silverGramPrice: row?.silverGramPrice ? Number(row.silverGramPrice) : null,
      goldNisabGrams: goldNisab,
      silverNisabGrams: Number(row?.silverNisabGrams ?? 561),
      /** Nisab in currency, by the gold standard; null until a price is set. */
      nisabAmount: gold === null ? null : Math.round(gold * goldNisab * 100) / 100,
      usdTry: row?.usdTry ? Number(row.usdTry) : null,
      /** `auto` = market data (TCMB + goldapi.io); `manual` = set by an admin. */
      source: row?.source ?? 'auto',
      fetchedAt: row?.fetchedAt?.toISOString() ?? null,
      /** Automatic prices older than three days: the app shows "may be out of date". */
      stale:
        row?.source === 'manual'
          ? false
          : !row?.fetchedAt || Date.now() - row.fetchedAt.getTime() > 3 * 86_400_000,
      sources: row?.source === 'manual' ? [] : ['TCMB', 'GoldAPI.io'],
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  /** Admin view: public fields plus the last error and recent accepted snapshots. */
  async zakatAdminView() {
    const [row] = await this.db.select().from(zakatSettings).where(eq(zakatSettings.id, 1));
    const history = await this.db
      .select()
      .from(metalPriceHistory)
      .orderBy(desc(metalPriceHistory.fetchedAt))
      .limit(30);
    return { ...(await this.zakatRates()), lastError: row?.lastError ?? null, history };
  }

  // ---- admin -------------------------------------------------------------

  async upsertCategories(input: DuaCategoryInput[]): Promise<number> {
    const categories = lastBy(input, (item) => item.id);
    if (categories.length === 0) {
      return 0;
    }
    await this.db
      .insert(duaCategories)
      .values(categories)
      .onConflictDoUpdate({
        target: duaCategories.id,
        set: {
          nameTr: sql`excluded.name_tr`,
          nameEn: sql`excluded.name_en`,
          nameAr: sql`excluded.name_ar`,
          icon: sql`excluded.icon`,
          sortOrder: sql`excluded.sort_order`,
        },
      });
    return categories.length;
  }

  async upsertDuas(input: DuaInput[]): Promise<number> {
    const items = lastBy(input, (item) => item.key);
    if (items.length === 0) {
      return 0;
    }
    const known = new Set(
      (await this.db.select({ id: duaCategories.id }).from(duaCategories)).map((c) => c.id),
    );
    const missing = items.find((item) => !known.has(item.categoryId));
    if (missing) {
      throw AppError.badRequest('VALIDATION_FAILED', `Unknown category "${missing.categoryId}"`);
    }
    await this.db
      .insert(duas)
      .values(items)
      .onConflictDoUpdate({
        target: duas.key,
        set: {
          categoryId: sql`excluded.category_id`,
          title: sql`excluded.title`,
          arabic: sql`excluded.arabic`,
          transliteration: sql`excluded.transliteration`,
          meaningTr: sql`excluded.meaning_tr`,
          meaningEn: sql`excluded.meaning_en`,
          source: sql`excluded.source`,
          sortOrder: sql`excluded.sort_order`,
          published: sql`excluded.published`,
          updatedAt: sql`now()`,
        },
      });
    return items.length;
  }

  async deleteDua(key: string): Promise<void> {
    const deleted = await this.db.delete(duas).where(eq(duas.key, key)).returning({ id: duas.id });
    if (deleted.length === 0) {
      throw AppError.notFound('Dua');
    }
  }

  async upsertEsma(input: EsmaInput[]): Promise<number> {
    const items = lastBy(input, (item) => String(item.no));
    if (items.length === 0) {
      return 0;
    }
    await this.db
      .insert(esma)
      .values(items)
      .onConflictDoUpdate({
        target: esma.no,
        set: {
          arabic: sql`excluded.arabic`,
          transliteration: sql`excluded.transliteration`,
          meaningTr: sql`excluded.meaning_tr`,
          meaningEn: sql`excluded.meaning_en`,
        },
      });
    return items.length;
  }

  /**
   * Admin overrides / one-off additions. Stored as `manual`, which the automatic
   * generator never overwrites; an override replaces the auto row with the same
   * key and hijri year.
   */
  async upsertReligiousDays(input: ReligiousDayInput[]): Promise<number> {
    const days = lastBy(input, (day) => `${day.key}|${day.hijriYear}`);
    if (days.length === 0) {
      return 0;
    }
    await this.db
      .insert(religiousDays)
      .values(days.map((day) => ({ ...day, source: 'manual' as const })))
      .onConflictDoUpdate({
        target: [religiousDays.key, religiousDays.hijriYear],
        set: {
          date: sql`excluded.date`,
          nameTr: sql`excluded.name_tr`,
          nameEn: sql`excluded.name_en`,
          hijri: sql`excluded.hijri`,
          note: sql`excluded.note`,
          source: sql`'manual'`,
          updatedAt: sql`now()`,
        },
      });
    return days.length;
  }

  async deleteReligiousDay(id: string): Promise<void> {
    const deleted = await this.db
      .delete(religiousDays)
      .where(eq(religiousDays.id, id))
      .returning({ id: religiousDays.id });
    if (deleted.length === 0) {
      throw AppError.notFound('Religious day');
    }
  }

  async setZakatRates(
    adminId: string,
    input: {
      goldGramPrice?: number;
      silverGramPrice?: number;
      goldNisabGrams?: number;
      silverNisabGrams?: number;
    },
  ) {
    const values = {
      ...(input.goldGramPrice !== undefined
        ? { goldGramPrice: input.goldGramPrice.toFixed(2) }
        : {}),
      ...(input.silverGramPrice !== undefined
        ? { silverGramPrice: input.silverGramPrice.toFixed(2) }
        : {}),
      ...(input.goldNisabGrams !== undefined
        ? { goldNisabGrams: input.goldNisabGrams.toFixed(2) }
        : {}),
      ...(input.silverNisabGrams !== undefined
        ? { silverNisabGrams: input.silverNisabGrams.toFixed(2) }
        : {}),
      // Pinning a price stops automatic updates until an admin resumes them.
      source: 'manual' as const,
      updatedBy: adminId,
      updatedAt: new Date(),
    };
    await this.db
      .insert(zakatSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: zakatSettings.id, set: values });
    return this.zakatRates();
  }
}

/**
 * One row per key, last one wins. Postgres rejects an upsert that touches the
 * same row twice, which a list pasted twice into an import would otherwise do.
 */
function lastBy<T>(items: T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
