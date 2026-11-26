import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

// The cache is optional: every caller treats a miss as "read the database". So a Redis that is down,
// restarting or unreachable must fail fast, never hold a request. ioredis's defaults do the opposite:
// commands wait in an offline queue while it reconnects, and each is retried up to 20 times, so a page
// hung for many seconds instead of falling back to Postgres.
const FAIL_FAST: RedisOptions = {
  lazyConnect: true, // connected in onModuleInit, without blocking boot
  enableOfflineQueue: false, // not connected → reject at once (the caller reads the DB)
  maxRetriesPerRequest: 1,
  commandTimeout: 1000, // a connected but stalled Redis can't hold a request either
  connectTimeout: 5000,
  // Keep reconnecting in the background (every 2s at most), so the cache comes back on its own.
  retryStrategy: (times) => Math.min(times * 200, 2000),
};

const ERROR_LOG_INTERVAL_MS = 60_000;

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(CacheService.name);
  private lastErrorLog = 0;

  constructor(config: ConfigService) {
    // REDIS_URL takes precedence — most cloud Redis providers (Railway, Render,
    // Upstash) supply a single connection string. Fall back to individual vars
    // for local dev / custom deployments.
    const url = config.get<string>('REDIS_URL');

    this.redis = url
      ? new Redis(url, FAIL_FAST)
      : new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          ...(config.get('REDIS_PASSWORD') && {
            password: config.get<string>('REDIS_PASSWORD'),
          }),
          ...FAIL_FAST,
        });

    // While Redis is down this fires on every reconnect attempt; log it at most once a minute.
    this.redis.on('error', (err: Error) => {
      const now = Date.now();
      if (now - this.lastErrorLog < ERROR_LOG_INTERVAL_MS) return;
      this.lastErrorLog = now;
      this.logger.error(`Redis error (serving from the database until it's back): ${err.message}`);
    });

    this.redis.on('ready', () => {
      this.lastErrorLog = 0;
      this.logger.log('Redis connected ✓');
    });
    this.redis.on('close', () => this.logger.warn('Redis connection closed'));
  }

  onModuleInit() {
    // Not awaited: the API starts and serves from the database even if Redis never answers.
    this.redis.connect().catch(() => undefined);
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw) {
        this.logger.debug(`HIT  ${key}`);
        return JSON.parse(raw) as T;
      }
      this.logger.debug(`MISS ${key}`);
      return null;
    } catch {
      return null;
    }
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      this.logger.debug(`Cache set failed for "${key}": ${(err as Error).message}`);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`Cache del failed for "${key}": ${(err as Error).message}`);
    }
  }

  // Deletes all keys matching prefix* using SCAN (non-blocking, production-safe).
  // Use this instead of KEYS to avoid freezing Redis under load.
  async delByPrefix(prefix: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) await this.redis.del(keys);
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(
        `Cache delByPrefix failed for "${prefix}": ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    // QUIT needs a live connection; with Redis down it would reject, so just drop the socket.
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
