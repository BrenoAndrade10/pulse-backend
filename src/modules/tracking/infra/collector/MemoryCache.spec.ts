import { MemoryCache, WindowRateLimiter } from './MemoryCache';

describe('MemoryCache', () => {
  it('evicts the least recently used key', async () => {
    const cache = new MemoryCache<string>(60_000, 2);
    await cache.get('a', () => Promise.resolve('a'));
    await cache.get('b', () => Promise.resolve('b'));
    await cache.get('a', () => Promise.resolve('stale'));
    await cache.get('c', () => Promise.resolve('c'));

    expect(cache.peek('a')).toBe('a');
    expect(cache.peek('b')).toBeUndefined();
    expect(cache.peek('c')).toBe('c');
  });

  it('loads a missing key only once for concurrent reads', async () => {
    const cache = new MemoryCache<string>(60_000);
    const load = jest.fn(() => Promise.resolve('value'));

    const values = await Promise.all([
      cache.get('key', load),
      cache.get('key', load),
      cache.get('key', load),
    ]);

    expect(values).toEqual(['value', 'value', 'value']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries a key whose load failed', async () => {
    const cache = new MemoryCache<string>(60_000);
    await expect(
      cache.get('key', () => Promise.reject(new Error('down'))),
    ).rejects.toThrow('down');

    await expect(cache.get('key', () => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
  });
});

describe('WindowRateLimiter', () => {
  it('never keeps more keys than the limit', () => {
    const limiter = new WindowRateLimiter(10, 60_000, 3);
    for (const key of ['a', 'b', 'c', 'd', 'e']) limiter.take(key);

    expect(
      (limiter as unknown as { windows: Map<string, unknown> }).windows.size,
    ).toBe(3);
  });
});
