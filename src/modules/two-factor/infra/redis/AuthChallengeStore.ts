import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import { createHash, randomBytes } from 'node:crypto';
import { DomainError } from '../../../../shared/errors/DomainError';
import { REDIS_CLIENT } from '../../../../shared/infra/redis/tokens';

const TOTP_TTL_SECONDS = 300;
const EMAIL_TTL_SECONDS = 600;
const FAIL_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
local ttl = redis.call('TTL', KEYS[1])
if ttl <= 0 then return -1 end
local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then redis.call('EXPIRE', KEYS[2], ttl) end
if attempts >= tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1], KEYS[2])
end
return attempts
`;
const CONSUME_SCRIPT = `
local ttl = redis.call('TTL', KEYS[1])
if ttl <= 0 then return nil end
local value = redis.call('GETDEL', KEYS[1])
if not value then return nil end
return {value, ttl}
`;
const RESEND_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then return {-1} end
local challenge = cjson.decode(value)
if challenge.next ~= 'email' then return {-1} end
local resendCount = tonumber(challenge.emailResendCount or 0)
if resendCount >= tonumber(ARGV[1]) then return {-3} end
local lastSentAt = tonumber(challenge.emailLastSentAt or 0)
local now = tonumber(ARGV[2])
local cooldown = tonumber(ARGV[3])
if now - lastSentAt < cooldown then
  return {-2, math.ceil((cooldown - (now - lastSentAt)) / 1000)}
end
challenge.emailResendCount = resendCount + 1
challenge.emailLastSentAt = now
local ttl = redis.call('TTL', KEYS[1])
redis.call('SET', KEYS[1], cjson.encode(challenge), 'KEEPTTL')
return {1, challenge.emailResendCount, challenge.emailLastSentAt, ttl}
`;
const REPLACE_EMAIL_CODE_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then return 0 end
local challenge = cjson.decode(value)
if challenge.next ~= 'email' then return 0 end
if tostring(challenge.emailLastSentAt) ~= ARGV[1] then return 0 end
challenge.emailCodeHash = ARGV[2]
redis.call('SET', KEYS[1], cjson.encode(challenge), 'KEEPTTL')
return 1
`;

export type AuthChallenge = {
  userId: string;
  tenantId: string | null;
  remember: boolean;
  next: 'email' | 'totp';
  attempts: number;
  emailCodeHash?: string;
  emailLastSentAt?: number;
  emailResendCount?: number;
};

export type ConsumedAuthChallenge = {
  challenge: AuthChallenge;
  ttlSeconds: number;
};

@Injectable()
export class AuthChallengeStore {
  private readonly logger = new Logger(AuthChallengeStore.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async create(
    challenge: Omit<AuthChallenge, 'attempts'>,
  ): Promise<{ challengeToken: string; expiresAt: string }> {
    const token = randomBytes(32).toString('base64url');
    try {
      await this.redis.set(
        this.key(token),
        { ...challenge, attempts: 0 },
        { ex: this.ttl(challenge.next) },
      );
    } catch {
      this.unavailable();
    }
    return {
      challengeToken: token,
      expiresAt: new Date(
        Date.now() + this.ttl(challenge.next) * 1000,
      ).toISOString(),
    };
  }

  async get(token: string): Promise<AuthChallenge> {
    try {
      const value = await this.redis.get<unknown>(this.key(token));
      if (!value) throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
      return this.parse(value);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      this.unavailable();
    }
  }

  async fail(token: string): Promise<void> {
    try {
      const key = this.key(token);
      const attempts = await this.redis.eval<[string], number>(
        FAIL_SCRIPT,
        [key, `${key}:attempts`],
        ['5'],
      );
      if (attempts < 0) throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
    } catch (error) {
      if (error instanceof DomainError) throw error;
      this.unavailable();
    }
  }

  async consume(token: string): Promise<ConsumedAuthChallenge> {
    try {
      const key = this.key(token);
      const result = await this.redis.eval<[], [unknown, number] | null>(
        CONSUME_SCRIPT,
        [key],
        [],
      );
      if (!result) throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
      return {
        challenge: this.parse(result[0]),
        ttlSeconds: Number(result[1]),
      };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      this.unavailable();
    }
  }

  async restore(
    token: string,
    challenge: AuthChallenge,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const restored = await this.redis.set(this.key(token), challenge, {
        ex: Math.max(1, ttlSeconds),
        nx: true,
      });
      if (!restored) throw new Error();
    } catch {
      this.unavailable();
    }
  }

  async complete(token: string): Promise<void> {
    try {
      await this.redis.del(`${this.key(token)}:attempts`);
    } catch {
      this.unavailable();
    }
  }

  async discard(token: string): Promise<void> {
    try {
      const key = this.key(token);
      await this.redis.del(key, `${key}:attempts`);
    } catch {
      this.unavailable();
    }
  }

  async reserveEmailResend(
    token: string,
    now: number,
  ): Promise<{
    resendCount: number;
    lastSentAt: number;
    ttlSeconds: number;
  }> {
    try {
      const result = await this.redis.eval<[string, string, string], number[]>(
        RESEND_SCRIPT,
        [this.key(token)],
        ['3', String(now), '60000'],
      );
      if (result[0] === -1)
        throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
      if (result[0] === -2) {
        throw new DomainError(429, 'EMAIL_CODE_RESEND_COOLDOWN', {
          retryAfterSeconds: result[1] ?? 60,
        });
      }
      if (result[0] === -3) {
        throw new DomainError(429, 'EMAIL_CODE_RESEND_LIMIT', {
          retryAfterSeconds: 600,
        });
      }
      return {
        resendCount: result[1],
        lastSentAt: result[2],
        ttlSeconds: result[3],
      };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      this.unavailable();
    }
  }

  async replaceEmailCode(
    token: string,
    lastSentAt: number,
    codeHash: string,
  ): Promise<void> {
    try {
      const replaced = await this.redis.eval<[string, string], number>(
        REPLACE_EMAIL_CODE_SCRIPT,
        [this.key(token)],
        [String(lastSentAt), codeHash],
      );
      if (replaced !== 1) throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
    } catch (error) {
      if (error instanceof DomainError) throw error;
      this.unavailable();
    }
  }

  private key(token: string): string {
    return `auth:challenge:${createHash('sha256').update(token).digest('hex')}`;
  }

  private ttl(next: AuthChallenge['next']): number {
    return next === 'email' ? EMAIL_TTL_SECONDS : TOTP_TTL_SECONDS;
  }

  private parse(value: unknown): AuthChallenge {
    try {
      const parsed =
        typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
      if (!parsed || typeof parsed !== 'object') throw new Error();
      return parsed as AuthChallenge;
    } catch {
      throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
    }
  }

  private unavailable(): never {
    this.logger.error('AUTH_CHALLENGE_REDIS_UNAVAILABLE');
    throw new DomainError(503, 'SERVICE_UNAVAILABLE');
  }
}
