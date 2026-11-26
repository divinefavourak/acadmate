import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { AddressInfo, createServer, Server, Socket } from 'net';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

// A dead or stalled Redis must never hold a request: the cache answers "miss" quickly and the
// caller reads the database.
const FAST_MS = 1500;

const config = (url: string) =>
  ({ get: (key: string, fallback?: unknown) => (key === 'REDIS_URL' ? url : fallback) }) as ConfigService;

async function timed<T>(fn: () => Promise<T>) {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

describe('CacheService when Redis is unavailable', () => {
  let cache: CacheService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });
  afterEach(async () => {
    await cache?.onModuleDestroy();
  });

  it('misses at once when nothing listens on the port', async () => {
    const probe = createServer();
    await new Promise<void>((r) => probe.listen(0, '127.0.0.1', () => r()));
    const { port } = probe.address() as AddressInfo;
    await new Promise<void>((r) => probe.close(() => r())); // the port is now closed

    cache = new CacheService(config(`redis://127.0.0.1:${port}`));
    cache.onModuleInit();

    for (let i = 0; i < 3; i++) {
      const { value, ms } = await timed(() => cache.get('k'));
      expect(value).toBeNull();
      expect(ms).toBeLessThan(FAST_MS);
    }
    const writes = await timed(async () => {
      await cache.set('k', { a: 1 }, 60);
      await cache.del('k');
      await cache.delByPrefix('k');
    });
    expect(writes.ms).toBeLessThan(FAST_MS);
  });

  it('misses at once when the server accepts the connection but never answers', async () => {
    const sockets: Socket[] = [];
    const silent: Server = createServer((s) => sockets.push(s));
    await new Promise<void>((r) => silent.listen(0, '127.0.0.1', () => r()));
    const { port } = silent.address() as AddressInfo;

    try {
      cache = new CacheService(config(`redis://127.0.0.1:${port}`));
      cache.onModuleInit();
      await new Promise((r) => setTimeout(r, 100)); // TCP connected, Redis handshake never completes

      const { value, ms } = await timed(() => cache.get('k'));
      expect(value).toBeNull();
      expect(ms).toBeLessThan(FAST_MS);
    } finally {
      await cache.onModuleDestroy();
      sockets.forEach((s) => s.destroy());
      await new Promise<void>((r) => silent.close(() => r()));
    }
  });

  it('shuts down cleanly while Redis is down', async () => {
    cache = new CacheService(config('redis://127.0.0.1:1'));
    cache.onModuleInit();
    await expect(cache.onModuleDestroy()).resolves.toBeUndefined();
  });
});
