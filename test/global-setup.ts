import { Redis } from 'ioredis';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { defaultContentDir, importContent } from '../src/content/import.js';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema/index.js';

/** Fresh schema and empty Redis DB before the e2e run. Never point these at real data. */
export default async function setup(): Promise<void> {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? 'postgres://vakit:vakit@localhost:5432/vakit_test';
  const redisUrl = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';
  if (!/test/.test(new URL(databaseUrl).pathname)) {
    throw new Error(
      `Refusing to wipe a database whose name does not contain "test": ${databaseUrl}`,
    );
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(
    'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;',
  );
  await client.end();
  await runMigrations(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  await importContent(drizzle(pool, { schema, casing: 'snake_case' }), defaultContentDir());
  await pool.end();

  const redis = new Redis(redisUrl);
  await redis.flushdb();
  await redis.quit();
}
