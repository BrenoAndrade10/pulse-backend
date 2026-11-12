import type { Redis } from '@upstash/redis';
import { LinkRedirectCache } from './LinkRedirectCache';
import { LinkStatus } from '../../domain/enums/LinkStatus';

const entry = {
  v: 1 as const,
  id: 'id',
  tenantId: 'tenant',
  expertId: null,
  launchId: null,
  destinationUrl: 'https://example.com',
  destinationVersion: 1,
  status: LinkStatus.ACTIVE,
  utm: {
    source: null,
    medium: null,
    campaign: null,
    content: null,
    term: null,
  },
};

describe('LinkRedirectCache', () => {
  it('serves L1 hits without Redis and invalidates both layers', async () => {
    const redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
    };
    const cache = new LinkRedirectCache(redis as never);
    await cache.set('abc', entry);
    redis.get.mockClear();
    await expect(cache.get('abc')).resolves.toEqual(entry);
    expect(redis.get).not.toHaveBeenCalled();
    await cache.invalidate('abc');
    expect(redis.del).toHaveBeenCalledWith('link:redirect:abc');
  });

  it('fails open when Redis is unavailable', async () => {
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('down')),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
    } as unknown as Redis;
    await expect(new LinkRedirectCache(redis).get('abc')).resolves.toBeNull();
  });

  it('opens a 30 second breaker after a Redis failure', async () => {
    jest.useFakeTimers();
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('down')),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
    } as unknown as Redis;
    const cache = new LinkRedirectCache(redis);
    await cache.get('abc');
    await cache.get('def');
    expect(redis.get).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30_001);
    await cache.get('ghi');
    expect(redis.get).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('renews L2 TTL without awaiting a second Redis round trip', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(entry)),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn().mockResolvedValue(true),
    };
    const cache = new LinkRedirectCache(redis as never);
    await expect(cache.get('abc')).resolves.toEqual(entry);
    await Promise.resolve();
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith('link:redirect:abc', 900);
  });
});
