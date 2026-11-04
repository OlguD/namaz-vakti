import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // E2E suites share one database and one Redis, so they run one file at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://vakit:vakit@localhost:5432/vakit_test',
      REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-test-secret',
      APPLE_CLIENT_IDS: 'com.example.test',
      GOOGLE_CLIENT_IDS: 'test-google-client',
      ADMIN_EMAILS: 'admin@example.com',
      YOUTUBE_API_KEY: 'test-key',
      SWAGGER_ENABLED: 'false',
      WORKER_SCHEDULES_ENABLED: 'false',
      RATE_LIMITS_ENABLED: 'false',
    },
    hookTimeout: 60_000,
  },
});
