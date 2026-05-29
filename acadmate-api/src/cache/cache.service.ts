import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor(config: ConfigService) {
    // REDIS_URL takes precedence — most cloud Redis providers (Railway, Render,
    // Upstash) supply a single connection string. Fall back to individual vars
    // for local dev / custom deployments.
    const url = config.get<string>('REDIS_URL');

    this.redis = url
      ? new Redis(url, { lazyConnect: true })
      : new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          ...(config.get('REDIS_PASSWORD') && {
            password: config.get<string>('REDIS_PASSWORD'),
          }),
          lazyConnect: true,
        });

    this.redis.on('error', (err: Error) =>
      this.logger.error(`Redis error: ${err.message}`),
    );

    this.redis.on('connect', () => this.logger.log('Redis connected ✓'));
    this.redis.on('close', () => this.logger.warn('Redis connection closed'));
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
      this.logger.warn(`Cache set failed for "${key}": ${(err as Error).message}`);
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

  onModuleDestroy() {
    void this.redis.quit();
  }
}
