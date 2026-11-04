import { HttpStatus, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { AppError } from '../common/errors.js';
import { parseOrThrow } from '../common/zod.js';
import { type Database, InjectDb } from '../db/database.module.js';
import { userSettings } from '../db/schema/index.js';
import { MAX_SETTINGS_BYTES, type Settings, settingsSchema } from './settings.schema.js';

export interface SettingsDocument {
  version: number;
  data: Settings;
  updatedAt: string | null;
}

@Injectable()
export class SettingsService {
  constructor(@InjectDb() private readonly db: Database) {}

  async get(userId: string): Promise<SettingsDocument> {
    const [row] = await this.db.select().from(userSettings).where(eq(userSettings.userId, userId));
    if (!row) {
      return { version: 0, data: settingsSchema.parse({}), updatedAt: null };
    }
    // Stored documents are re-parsed so defaults for newly added fields apply.
    const parsed = settingsSchema.safeParse(row.data);
    return {
      version: row.version,
      data: parsed.success ? parsed.data : settingsSchema.parse({}),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Replaces the document if `expectedVersion` is still current (optimistic
   * concurrency): two devices editing at once cannot silently overwrite each
   * other — the loser gets 409 with the current document and merges.
   */
  async put(userId: string, expectedVersion: number, raw: unknown): Promise<SettingsDocument> {
    if (JSON.stringify(raw ?? null).length > MAX_SETTINGS_BYTES) {
      throw AppError.badRequest('VALIDATION_FAILED', 'Settings document is too large');
    }
    const data = parseOrThrow(settingsSchema, raw);

    const written =
      expectedVersion === 0
        ? await this.db
            .insert(userSettings)
            .values({ userId, data, version: 1 })
            .onConflictDoNothing()
            .returning()
        : await this.db
            .update(userSettings)
            .set({ data, version: sql`${userSettings.version} + 1`, updatedAt: new Date() })
            .where(and(eq(userSettings.userId, userId), eq(userSettings.version, expectedVersion)))
            .returning();

    if (written.length === 0) {
      const current = await this.get(userId);
      throw new AppError(
        'CONFLICT',
        'Settings were changed on another device',
        HttpStatus.CONFLICT,
        {
          current,
        },
      );
    }
    const row = written[0]!;
    return { version: row.version, data, updatedAt: row.updatedAt.toISOString() };
  }
}
