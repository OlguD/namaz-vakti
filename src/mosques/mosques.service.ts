import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { and, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { AppError } from '../common/errors.js';
import { withRedisLock } from '../common/redis-lock.js';
import { type Database, InjectDb } from '../db/database.module.js';
import { mosqueSuggestions, mosques, mosqueTiles } from '../db/schema/index.js';
import { jobId, JOBS, QUEUES } from '../jobs/queues.js';
import { InjectRedis } from '../redis/redis.module.js';
import { OverpassClient } from './overpass.client.js';
import { tileBBox, tilesCovering } from './tiles.js';

export interface MosqueView {
  id: string;
  name: string | null;
  nameEn: string | null;
  nameAr: string | null;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
  phone: string | null;
  wheelchair: string | null;
  source: 'osm' | 'user';
  distanceM?: number;
}

export interface NearbyResult {
  mosques: MosqueView[];
  /** True while some of the area is still being imported; ask again in a few seconds. */
  partial: boolean;
  attribution: string;
}

const TILE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const INLINE_IMPORT_BUDGET_MS = 12_000;
export const ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

type SuggestionPayload = (typeof mosqueSuggestions.$inferInsert)['payload'];

@Injectable()
export class MosquesService {
  private readonly logger = new Logger(MosquesService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    private readonly overpass: OverpassClient,
    @InjectQueue(QUEUES.mosques) private readonly queue: Queue,
  ) {}

  async nearby(lat: number, lng: number, radiusM: number, limit: number): Promise<NearbyResult> {
    const partial = await this.ensureTiles(tilesCovering(lat, lng, radiusM));
    const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
    const rows = await this.db
      .select({
        ...columns,
        distanceM:
          sql<number>`ST_Distance(${mosques.location}::geography, ${point}::geography)`.mapWith(
            Number,
          ),
      })
      .from(mosques)
      .where(
        and(
          eq(mosques.hidden, false),
          sql`ST_DWithin(${mosques.location}::geography, ${point}::geography, ${radiusM})`,
        ),
      )
      .orderBy(sql`${mosques.location}::geography <-> ${point}::geography`)
      .limit(limit);
    return {
      mosques: rows.map((row) => ({ ...toView(row), distanceM: Math.round(row.distanceM) })),
      partial,
      attribution: ATTRIBUTION,
    };
  }

  async get(id: string): Promise<MosqueView & { attribution: string }> {
    const [row] = await this.db
      .select(columns)
      .from(mosques)
      .where(and(eq(mosques.id, id), eq(mosques.hidden, false)));
    if (!row) {
      throw AppError.notFound('Mosque');
    }
    return { ...toView(row), attribution: ATTRIBUTION };
  }

  /** Pulls one tile from OpenStreetMap and reconciles it with the stored rows. */
  async importTile(tileId: string): Promise<number> {
    const startedAt = new Date();
    const found = await this.overpass.mosquesIn(tileBBox(tileId));
    const box = tileBBox(tileId);

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < found.length; i += 500) {
        const chunk = found.slice(i, i + 500);
        await tx
          .insert(mosques)
          .values(
            chunk.map((item) => ({
              source: 'osm' as const,
              osmRef: item.osmRef,
              name: item.name,
              nameEn: item.nameEn,
              nameAr: item.nameAr,
              location: { x: item.lng, y: item.lat },
              address: item.address,
              website: item.website,
              phone: item.phone,
              wheelchair: item.wheelchair,
              tags: item.tags,
              lastSeenInSourceAt: startedAt,
            })),
          )
          .onConflictDoUpdate({
            target: mosques.osmRef,
            targetWhere: isNotNull(mosques.osmRef),
            // Moderator edits to name/address win over OSM until OSM itself changes them.
            set: {
              name: sql`excluded.name`,
              nameEn: sql`excluded.name_en`,
              nameAr: sql`excluded.name_ar`,
              location: sql`excluded.location`,
              address: sql`excluded.address`,
              website: sql`excluded.website`,
              phone: sql`excluded.phone`,
              wheelchair: sql`excluded.wheelchair`,
              tags: sql`excluded.tags`,
              lastSeenInSourceAt: sql`excluded.last_seen_in_source_at`,
            },
          });
      }
      // Anything from OSM inside this tile that OSM no longer lists was deleted upstream.
      await tx
        .update(mosques)
        .set({ hidden: true })
        .where(
          and(
            eq(mosques.source, 'osm'),
            lt(mosques.lastSeenInSourceAt, startedAt),
            sql`${mosques.location} && ST_MakeEnvelope(${box.west}, ${box.south}, ${box.east}, ${box.north}, 4326)`,
          ),
        );
      await tx
        .insert(mosqueTiles)
        .values({ id: tileId, importedAt: startedAt, mosqueCount: found.length })
        .onConflictDoUpdate({
          target: mosqueTiles.id,
          set: { importedAt: startedAt, mosqueCount: found.length },
        });
    });
    return found.length;
  }

  async suggest(
    userId: string,
    kind: 'add' | 'edit' | 'closed',
    mosqueId: string | undefined,
    payload: SuggestionPayload,
  ) {
    if (kind !== 'add') {
      if (!mosqueId) {
        throw AppError.badRequest('VALIDATION_FAILED', 'mosqueId is required for edit and closed');
      }
      await this.get(mosqueId);
    } else if (payload.lat === undefined || payload.lng === undefined || !payload.name) {
      throw AppError.badRequest(
        'VALIDATION_FAILED',
        'name, lat and lng are required to add a mosque',
      );
    }
    const openCount = await this.db.$count(
      mosqueSuggestions,
      and(eq(mosqueSuggestions.userId, userId), eq(mosqueSuggestions.status, 'open')),
    );
    if (openCount >= 20) {
      throw AppError.badRequest('RATE_LIMITED', 'Too many open suggestions; wait for review');
    }
    const [row] = await this.db
      .insert(mosqueSuggestions)
      .values({ userId, kind, mosqueId: kind === 'add' ? null : mosqueId, payload })
      .returning();
    return row!;
  }

  async listSuggestions(status: 'open' | 'accepted' | 'rejected', limit: number) {
    return this.db
      .select()
      .from(mosqueSuggestions)
      .where(eq(mosqueSuggestions.status, status))
      .orderBy(desc(mosqueSuggestions.createdAt))
      .limit(limit);
  }

  async reviewSuggestion(id: string, reviewerId: string, accept: boolean): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [suggestion] = await tx
        .select()
        .from(mosqueSuggestions)
        .where(and(eq(mosqueSuggestions.id, id), eq(mosqueSuggestions.status, 'open')))
        .for('update');
      if (!suggestion) {
        throw AppError.notFound('Open suggestion');
      }
      if (accept) {
        const { payload } = suggestion;
        if (suggestion.kind === 'add') {
          await tx.insert(mosques).values({
            source: 'user',
            name: payload.name ?? null,
            address: payload.address ?? null,
            location: { x: payload.lng!, y: payload.lat! },
          });
        } else if (suggestion.kind === 'edit' && suggestion.mosqueId) {
          await tx
            .update(mosques)
            .set({
              ...(payload.name ? { name: payload.name } : {}),
              ...(payload.address ? { address: payload.address } : {}),
              ...(payload.lat !== undefined && payload.lng !== undefined
                ? { location: { x: payload.lng, y: payload.lat } }
                : {}),
            })
            .where(eq(mosques.id, suggestion.mosqueId));
        } else if (suggestion.kind === 'closed' && suggestion.mosqueId) {
          await tx.update(mosques).set({ hidden: true }).where(eq(mosques.id, suggestion.mosqueId));
        }
      }
      await tx
        .update(mosqueSuggestions)
        .set({
          status: accept ? 'accepted' : 'rejected',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        })
        .where(eq(mosqueSuggestions.id, id));
    });
  }

  /**
   * Imports never-seen tiles right away (bounded by a time budget) so the first
   * user in a city sees mosques on their first request; stale tiles refresh in the
   * background. Returns true if anything is still missing.
   */
  private async ensureTiles(tileIds: string[]): Promise<boolean> {
    const known = await this.db.select().from(mosqueTiles).where(inArray(mosqueTiles.id, tileIds));
    const byId = new Map(known.map((tile) => [tile.id, tile]));
    const missing = tileIds.filter((id) => !byId.has(id));
    const stale = known.filter((tile) => Date.now() - tile.importedAt.getTime() > TILE_MAX_AGE_MS);

    if (stale.length > 0) {
      await this.queue.addBulk(
        stale.map((tile) => ({
          name: JOBS.importMosqueTile,
          data: { tileId: tile.id },
          opts: { jobId: jobId('tile', tile.id, new Date().toISOString().slice(0, 10)) },
        })),
      );
    }
    if (missing.length === 0) {
      return false;
    }

    const imports = missing.map((tileId) =>
      withRedisLock(
        this.redis,
        `lock:tile:${tileId}`,
        async () => {
          const [done] = await this.db.select().from(mosqueTiles).where(eq(mosqueTiles.id, tileId));
          if (!done) {
            await this.importTile(tileId);
          }
        },
        { ttlMs: 90_000, waitMs: INLINE_IMPORT_BUDGET_MS },
      ).then(
        () => true,
        (error: unknown) => {
          this.logger.warn(`Tile ${tileId} import failed: ${(error as Error).message}`);
          return false;
        },
      ),
    );
    const timeout = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), INLINE_IMPORT_BUDGET_MS).unref(),
    );
    const outcome = await Promise.race([Promise.all(imports), timeout]);
    if (outcome === 'timeout' || outcome.includes(false)) {
      // Let the worker finish (or retry) what did not complete in time.
      await this.queue.addBulk(
        missing.map((tileId) => ({
          name: JOBS.importMosqueTile,
          data: { tileId },
          opts: { jobId: jobId('tile', tileId, new Date().toISOString().slice(0, 10)) },
        })),
      );
      return true;
    }
    return false;
  }
}

const columns = {
  id: mosques.id,
  name: mosques.name,
  nameEn: mosques.nameEn,
  nameAr: mosques.nameAr,
  location: mosques.location,
  address: mosques.address,
  website: mosques.website,
  phone: mosques.phone,
  wheelchair: mosques.wheelchair,
  source: mosques.source,
};

function toView(row: {
  id: string;
  name: string | null;
  nameEn: string | null;
  nameAr: string | null;
  location: { x: number; y: number };
  address: string | null;
  website: string | null;
  phone: string | null;
  wheelchair: string | null;
  source: 'osm' | 'user';
}): MosqueView {
  return {
    id: row.id,
    name: row.name,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    lat: row.location.y,
    lng: row.location.x,
    address: row.address,
    website: row.website,
    phone: row.phone,
    wheelchair: row.wheelchair,
    source: row.source,
  };
}
