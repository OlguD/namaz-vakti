import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Applies pending SQL migrations from ./drizzle. Run as a one-off step before
 * starting new api/worker containers (see docker-compose `migrate` service).
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // Works from both src/db (tsx) and dist/db (compiled): the folder sits at the repo root.
    const migrationsFolder = path.resolve(here, '..', '..', 'drizzle');
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntrypoint) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => {
      console.log('Migrations applied');
    })
    .catch((error: unknown) => {
      console.error('Migration failed', error);
      process.exit(1);
    });
}
