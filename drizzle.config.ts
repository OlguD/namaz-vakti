import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://vakit:vakit@localhost:5432/vakit',
  },
  // PostGIS owns these tables; drizzle-kit must never try to drop them.
  extensionsFilters: ['postgis'],
  strict: true,
  verbose: true,
});
