import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Redis } from 'ioredis';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0`;

/**
 * Runs `fn` while holding a Redis lock; concurrent callers wait for the holder to
 * finish and then run `fn` themselves (which normally hits a now-warm cache).
 * Used to stop a burst of requests for the same uncached district from all
 * calling the upstream API at once.
 */
export async function withRedisLock<T>(
  redis: Redis,
  key: string,
  fn: () => Promise<T>,
  { ttlMs = 30_000, waitMs = 15_000 }: { ttlMs?: number; waitMs?: number } = {},
): Promise<T> {
  const token = randomUUID();
  const deadline = Date.now() + waitMs;
  while (true) {
    const acquired = await redis.set(key, token, 'PX', ttlMs, 'NX');
    if (acquired === 'OK') {
      try {
        return await fn();
      } finally {
        await redis.eval(RELEASE_SCRIPT, 1, key, token).catch(() => undefined);
      }
    }
    if (Date.now() > deadline) {
      // Holder is slow or dead; proceed rather than fail the user's request.
      return fn();
    }
    await sleep(100);
  }
}

/** Returns true at most once per `ttlSeconds` for the given key (cheap "do occasionally"). */
export async function oncePer(redis: Redis, key: string, ttlSeconds: number): Promise<boolean> {
  return (await redis.set(key, '1', 'EX', ttlSeconds, 'NX')) === 'OK';
}
