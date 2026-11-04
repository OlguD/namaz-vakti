import { Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { AppConfig } from '../config/app-config.service.js';
import { InjectRedis } from '../redis/redis.module.js';

/**
 * Access tokens are stateless JWTs (15 min), so deleting, banning or demoting an
 * account would otherwise leave already-issued tokens working until they expire.
 * We record "tokens issued at or before T are void" per user in Redis, for as
 * long as such a token could still be alive, and the auth guard checks it.
 */
@Injectable()
export class AccessRevocation {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  async revokeUser(userId: string): Promise<void> {
    await this.redis.set(
      key(userId),
      String(Date.now()),
      'EX',
      this.config.get('JWT_ACCESS_TTL_SECONDS') + 60,
    );
  }

  /** `issuedAtMs` is the token's issue time in milliseconds. */
  async isRevoked(userId: string, issuedAtMs: number | undefined): Promise<boolean> {
    const value = await this.redis.get(key(userId));
    if (!value) {
      return false;
    }
    return issuedAtMs === undefined || issuedAtMs <= Number(value);
  }
}

const key = (userId: string) => `auth:revoked:${userId}`;
