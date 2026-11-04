import { Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { type Database, InjectDb } from '../db/database.module.js';
import { metalPriceHistory, zakatSettings } from '../db/schema/index.js';
import { GoldApiClient, TcmbClient } from './metal-prices.clients.js';

export const TROY_OUNCE_GRAMS = 31.1034768;
/** A move bigger than this between two refreshes is treated as bad data, not news. */
export const MAX_JUMP = 0.25;

/** Wide bounds on USD per gram; anything outside is a broken feed. */
const BOUNDS = { gold: [10, 1_000], silver: [0.05, 50], usdTry: [1, 1_000] } as const;

export interface PriceSnapshot {
  usdTry: number;
  fxDate: string;
  goldUsdOunce: number;
  silverUsdOunce: number;
  goldGramPrice: number;
  silverGramPrice: number;
}

export type RefreshResult =
  | { applied: true; snapshot: PriceSnapshot }
  | {
      applied: false;
      reason: 'manual' | 'not_configured' | 'rejected' | 'upstream';
      detail?: string;
    };

export function toSnapshot(
  usdTry: number,
  fxDate: string,
  goldUsdOunce: number,
  silverUsdOunce: number,
): PriceSnapshot {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  return {
    usdTry,
    fxDate,
    goldUsdOunce,
    silverUsdOunce,
    goldGramPrice: round2((goldUsdOunce / TROY_OUNCE_GRAMS) * usdTry),
    silverGramPrice: round2((silverUsdOunce / TROY_OUNCE_GRAMS) * usdTry),
  };
}

/** Returns why a snapshot must not be published, or null if it looks sane. */
export function validateSnapshot(next: PriceSnapshot, previous?: PriceSnapshot): string | null {
  const goldUsdGram = next.goldUsdOunce / TROY_OUNCE_GRAMS;
  const silverUsdGram = next.silverUsdOunce / TROY_OUNCE_GRAMS;
  if (goldUsdGram < BOUNDS.gold[0] || goldUsdGram > BOUNDS.gold[1]) {
    return `gold price out of bounds (${goldUsdGram.toFixed(2)} USD/g)`;
  }
  if (silverUsdGram < BOUNDS.silver[0] || silverUsdGram > BOUNDS.silver[1]) {
    return `silver price out of bounds (${silverUsdGram.toFixed(2)} USD/g)`;
  }
  if (next.usdTry < BOUNDS.usdTry[0] || next.usdTry > BOUNDS.usdTry[1]) {
    return `USD/TRY out of bounds (${next.usdTry})`;
  }
  if (previous) {
    for (const key of ['goldGramPrice', 'silverGramPrice', 'usdTry'] as const) {
      const change = Math.abs(next[key] - previous[key]) / previous[key];
      if (change > MAX_JUMP) {
        return `${key} moved ${(change * 100).toFixed(1)}% since the last accepted price`;
      }
    }
  }
  return null;
}

/**
 * Zakat inputs from market data: gold and silver spot (USD/oz, goldapi.io)
 * converted at the official TCMB USD/TRY rate. A bad or wildly jumping quote is
 * rejected and the last good price stays published. An admin pin (manual
 * source) stops automatic updates until switched back.
 */
@Injectable()
export class MetalPricesService {
  private readonly logger = new Logger(MetalPricesService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly tcmb: TcmbClient,
    private readonly goldApi: GoldApiClient,
  ) {}

  async refresh(): Promise<RefreshResult> {
    const [settings] = await this.db.select().from(zakatSettings).where(eq(zakatSettings.id, 1));
    if (settings?.source === 'manual') {
      return { applied: false, reason: 'manual' };
    }
    if (!this.goldApi.configured) {
      await this.recordError('GOLDAPI_KEY is not configured');
      return { applied: false, reason: 'not_configured' };
    }

    let snapshot: PriceSnapshot;
    try {
      const [fx, gold, silver] = await Promise.all([
        this.tcmb.usdTry(),
        this.goldApi.ounceUsd('XAU'),
        this.goldApi.ounceUsd('XAG'),
      ]);
      snapshot = toSnapshot(fx.rate, fx.date, gold, silver);
    } catch (error) {
      const detail = (error as Error).message;
      this.logger.warn(`Metal price refresh failed: ${detail}`);
      await this.recordError(detail);
      return { applied: false, reason: 'upstream', detail };
    }

    const [last] = await this.db
      .select()
      .from(metalPriceHistory)
      .orderBy(desc(metalPriceHistory.fetchedAt))
      .limit(1);
    const previous = last
      ? toSnapshot(
          Number(last.usdTry),
          last.fxDate ?? '',
          Number(last.goldUsdOunce),
          Number(last.silverUsdOunce),
        )
      : undefined;
    const problem = validateSnapshot(snapshot, previous);
    if (problem) {
      this.logger.error(`Metal price rejected: ${problem}`);
      await this.recordError(`Rejected: ${problem}`);
      return { applied: false, reason: 'rejected', detail: problem };
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx.insert(metalPriceHistory).values({
        fetchedAt: now,
        usdTry: snapshot.usdTry.toFixed(4),
        goldUsdOunce: snapshot.goldUsdOunce.toFixed(4),
        silverUsdOunce: snapshot.silverUsdOunce.toFixed(4),
        goldGramPrice: snapshot.goldGramPrice.toFixed(2),
        silverGramPrice: snapshot.silverGramPrice.toFixed(2),
        fxDate: snapshot.fxDate,
      });
      const values = {
        goldGramPrice: snapshot.goldGramPrice.toFixed(2),
        silverGramPrice: snapshot.silverGramPrice.toFixed(2),
        usdTry: snapshot.usdTry.toFixed(4),
        source: 'auto' as const,
        fetchedAt: now,
        lastError: null,
        updatedAt: now,
      };
      await tx
        .insert(zakatSettings)
        .values({ id: 1, ...values })
        .onConflictDoUpdate({
          target: zakatSettings.id,
          set: values,
          setWhere: eq(zakatSettings.source, 'auto'),
        });
    });
    return { applied: true, snapshot };
  }

  /** Admin switches back from a pinned price to market data. */
  async resumeAuto(): Promise<void> {
    await this.db
      .insert(zakatSettings)
      .values({ id: 1, source: 'auto' })
      .onConflictDoUpdate({
        target: zakatSettings.id,
        set: { source: 'auto', updatedAt: new Date() },
      });
  }

  private async recordError(message: string): Promise<void> {
    await this.db
      .insert(zakatSettings)
      .values({ id: 1, lastError: message.slice(0, 500) })
      .onConflictDoUpdate({ target: zakatSettings.id, set: { lastError: message.slice(0, 500) } });
  }
}
