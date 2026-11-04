import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { AdminModule } from './admin/admin.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { ChatModule } from './chat/chat.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { RedisThrottlerStorage, UserAwareThrottlerGuard } from './common/throttling.js';
import { AppConfig } from './config/app-config.service.js';
import { CoreModule } from './core.module.js';
import { HealthController } from './health/health.controller.js';
import { LiveModule } from './live/live.module.js';
import { MosquesModule } from './mosques/mosques.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrayerTimesModule } from './prayer-times/prayer-times.module.js';
import { REDIS } from './redis/redis.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    CoreModule,
    TerminusModule,
    ThrottlerModule.forRootAsync({
      inject: [REDIS, AppConfig],
      useFactory: (redis: Redis, config: AppConfig) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        storage: new RedisThrottlerStorage(redis),
        skipIf: () => !config.get('RATE_LIMITS_ENABLED'),
      }),
    }),
    AuthModule,
    UsersModule,
    PrayerTimesModule,
    MosquesModule,
    LiveModule,
    NotificationsModule,
    ChatModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authentication runs first so rate limits can key on the user.
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
