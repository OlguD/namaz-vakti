import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),
  /** Browser origins allowed to call the API (web app). Also the CSRF allowlist for cookie auth. */
  CORS_ORIGINS: csv,
  /** Web clients keep the refresh token in an httpOnly cookie with these attributes. */
  WEB_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  WEB_COOKIE_DOMAIN: z.string().optional(),
  WEB_COOKIE_SECURE: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((value) => value === 'true' || value === '1'),
  SWAGGER_ENABLED: bool,
  TRUST_PROXY: bool,
  /** Only for automated tests; never disable in production. */
  RATE_LIMITS_ENABLED: bool.default(true),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(60),

  APPLE_CLIENT_IDS: csv,
  GOOGLE_CLIENT_IDS: csv,
  ADMIN_EMAILS: csv,

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: bool,
  MAIL_FROM: z.string().default('Namaz Vakti <no-reply@example.com>'),
  APP_DEEP_LINK_BASE: z.string().default('namazvakti://'),

  EMUSHAF_BASE_URL: z.url().default('https://ezanvakti.emushaf.net'),
  OUTBOUND_USER_AGENT: z.string().default('NamazVaktiBackend/0.1'),
  NOMINATIM_BASE_URL: z.url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_EMAIL: z.string().optional(),
  OVERPASS_BASE_URL: z.url().default('https://overpass-api.de/api/interpreter'),
  ALADHAN_BASE_URL: z.url().default('https://api.aladhan.com'),
  TCMB_BASE_URL: z.url().default('https://www.tcmb.gov.tr'),
  /** goldapi.io key for gold/silver spot prices (zakat). Without it zakat prices stay manual. */
  GOLDAPI_KEY: z.string().optional(),
  GOLDAPI_BASE_URL: z.url().default('https://www.goldapi.io'),

  YOUTUBE_API_KEY: z.string().optional(),
  LIVE_POLL_CRON: z.string().default('*/2 * * * *'),

  EXPO_ACCESS_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  WORKER_SCHEDULES_ENABLED: bool.default(true),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
