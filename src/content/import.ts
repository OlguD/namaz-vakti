import { drizzle } from 'drizzle-orm/node-postgres';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { Database } from '../db/database.module.js';
import * as schema from '../db/schema/index.js';
import { duasFileSchema, esmaFileSchema, religiousDaysFileSchema } from './content.schemas.js';
import { parseOrThrow } from '../common/zod.js';
import { ContentService } from './content.service.js';

/**
 * Loads the editorial files in ./content into the database (idempotent upserts):
 *   duas.json, esma.json, religious-days.json (only if present — the .example
 *   file is never imported, its dates are not authoritative).
 */
export async function importContent(
  db: Database,
  directory: string,
): Promise<Record<string, number>> {
  const content = new ContentService(db);
  const read = (name: string) =>
    JSON.parse(readFileSync(path.join(directory, name), 'utf8')) as unknown;
  const result: Record<string, number> = {};

  if (existsSync(path.join(directory, 'duas.json'))) {
    const file = parseOrThrow(duasFileSchema, read('duas.json'));
    result.categories = await content.upsertCategories(file.categories);
    result.duas = await content.upsertDuas(file.duas);
  }
  if (existsSync(path.join(directory, 'esma.json'))) {
    result.esma = await content.upsertEsma(parseOrThrow(esmaFileSchema, read('esma.json')).names);
  }
  if (existsSync(path.join(directory, 'religious-days.json'))) {
    const file = parseOrThrow(religiousDaysFileSchema, read('religious-days.json'));
    result.religiousDays = await content.upsertReligiousDays(file.days);
  }
  return result;
}

export function defaultContentDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'content');
}

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntrypoint) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  importContent(
    drizzle(pool, { schema, casing: 'snake_case' }),
    process.argv[2] ?? defaultContentDir(),
  )
    .then((result) => console.log('Content imported', result))
    .catch((error: unknown) => {
      console.error('Content import failed', error);
      process.exitCode = 1;
    })
    .finally(() => void pool.end());
}
