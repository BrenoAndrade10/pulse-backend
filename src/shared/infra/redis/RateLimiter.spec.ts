import type { Redis } from '@upstash/redis';
import { Logger } from '@nestjs/common';
import { RateLimiter } from './RateLimiter';

describe('RateLimiter', () => {
  const multi = {
    get: jest.fn(),
    ttl: jest.fn(),
    exec: jest.fn(),
  };
  const redis = {
    eval: jest.fn(),
    multi: jest.fn().mockReturnValue(multi),
    del: jest.fn(),
  };
  let limiter: RateLimiter;
  let errorLog: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    jest.clearAllMocks();
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    multi.get.mockReturnValue(multi);
    multi.ttl.mockReturnValue(multi);
    limiter = new RateLimiter(redis as unknown as Redis);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the atomic count and retry time', async () => {
    redis.eval.mockResolvedValue([6, 812]);

    await expect(limiter.consume('login', 5, 900)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 812,
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      ['rate-limit:login'],
      ['900'],
    );
  });

  it('checks and resets a window without incrementing it', async () => {
    multi.exec.mockResolvedValue([4, 120]);

    await expect(limiter.status('login', 5)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 120,
    });
    await limiter.reset('login');
    expect(redis.del).toHaveBeenCalledWith('rate-limit:login');
  });

  it.each([
    ['consume', () => limiter.consume('login', 5, 900), () => redis.eval],
    ['status', () => limiter.status('login', 5), () => multi.exec],
    ['reset', () => limiter.reset('login'), () => redis.del],
  ])('fails closed when Redis rejects during %s', async (_name, call, mock) => {
    mock().mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(call()).rejects.toMatchObject({
      statusCode: 503,
      reason: 'SERVICE_UNAVAILABLE',
    });
    expect(errorLog).toHaveBeenCalledWith('RATE_LIMITER_REDIS_UNAVAILABLE');
  });
});
