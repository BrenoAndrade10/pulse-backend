import type { Redis } from '@upstash/redis';
import { RedisInstagramMediaCache } from './RedisInstagramMediaCache';

describe('RedisInstagramMediaCache', () => {
  const page = { data: [{ id: 'post-1' }], after: 'next' };
  let redis: { get: jest.Mock; set: jest.Mock };
  let cache: RedisInstagramMediaCache;

  beforeEach(() => {
    redis = { get: jest.fn(), set: jest.fn() };
    cache = new RedisInstagramMediaCache(redis as unknown as Redis);
  });

  it('stores pages for two minutes under a namespaced key', async () => {
    await cache.set('credential-a:100:abc', page);

    expect(redis.set).toHaveBeenCalledWith(
      'meta:instagram-media:v2:credential-a:100:abc',
      JSON.stringify(page),
      { ex: 120 },
    );
  });

  it.each([
    ['a JSON string', JSON.stringify(page)],
    ['an already parsed object', page],
  ])('reads %s', async (_, stored) => {
    redis.get.mockResolvedValue(stored);

    await expect(cache.get('key')).resolves.toEqual(page);
  });

  it('treats missing or malformed entries as a miss', async () => {
    redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce({ foo: 1 });

    await expect(cache.get('key')).resolves.toBeNull();
    await expect(cache.get('key')).resolves.toBeNull();
  });

  it('never breaks the listing when Redis is down', async () => {
    redis.get.mockRejectedValue(new Error('ECONNRESET'));
    redis.set.mockRejectedValue(new Error('ECONNRESET'));

    await expect(cache.get('key')).resolves.toBeNull();
    await expect(cache.set('key', page)).resolves.toBeUndefined();
  });
});
