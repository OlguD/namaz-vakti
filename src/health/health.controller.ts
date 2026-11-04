import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import { Public } from '../auth/auth.decorators.js';
import { PG_POOL } from '../db/database.module.js';
import { InjectRedis } from '../redis/redis.module.js';

@ApiTags('Health')
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Liveness: the process is up. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies answer. Point Traefik/Docker health checks here. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.probe('database', () => this.pool.query('SELECT 1')),
      () => this.probe('redis', () => this.redis.ping()),
    ]);
  }

  private async probe(key: string, fn: () => Promise<unknown>): Promise<HealthIndicatorResult> {
    const check = this.indicator.check(key);
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2_000)),
      ]);
      return check.up();
    } catch (error) {
      return check.down({ message: (error as Error).message });
    }
  }
}
