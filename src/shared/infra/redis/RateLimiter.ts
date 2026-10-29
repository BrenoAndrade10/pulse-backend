import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import { DomainError } from '../../errors/DomainError';
import { REDIS_CLIENT } from './tokens';

const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    try {
      const [count, ttl] = await this.redis.eval<[string], [number, number]>(
        CONSUME_SCRIPT,
        [this.key(key)],
        [String(windowSeconds)],
      );

      return {
        allowed: count <= limit,
        retryAfterSeconds: Math.max(1, ttl),
      };
    } catch {
      this.unavailable();
    }
  }

  async status(key: string, limit: number): Promise<RateLimitResult> {
    try {
      const [rawCount, ttl] = await this.redis
        .multi()
        .get<number>(this.key(key))
        .ttl(this.key(key))
        .exec<[number | null, number]>();

      return {
        allowed: (rawCount ?? 0) < limit,
        retryAfterSeconds: Math.max(1, ttl),
      };
    } catch {
      this.unavailable();
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.redis.del(this.key(key));
    } catch {
      this.unavailable();
    }
  }

  private key(key: string): string {
    return `rate-limit:${key}`;
  }

  private unavailable(): never {
    this.logger.error('RATE_LIMITER_REDIS_UNAVAILABLE');
    throw new DomainError(503, 'SERVICE_UNAVAILABLE');
  }
}
