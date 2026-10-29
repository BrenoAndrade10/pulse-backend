import type { Redis } from '@upstash/redis';
import { AuthChallengeStore } from './AuthChallengeStore';

describe('AuthChallengeStore', () => {
  const redis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    eval: jest.fn(),
  };
  const challenge = {
    userId: 'user-id',
    tenantId: 'tenant-id',
    remember: true,
    next: 'totp' as const,
    attempts: 0,
  };
  let store: AuthChallengeStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new AuthChallengeStore(redis as unknown as Redis);
  });

  it('rejects an expired challenge', async () => {
    redis.get.mockResolvedValue(null);
    await expect(store.get('expired')).rejects.toMatchObject({
      statusCode: 401,
      reason: 'AUTH_CHALLENGE_INVALID',
    });
  });

  it('consumes a challenge only once', async () => {
    redis.eval
      .mockResolvedValueOnce([challenge, 240])
      .mockResolvedValueOnce(null);

    await expect(store.consume('token')).resolves.toEqual({
      challenge,
      ttlSeconds: 240,
    });
    await expect(store.consume('token')).rejects.toMatchObject({
      reason: 'AUTH_CHALLENGE_INVALID',
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('GETDEL', KEYS[1])"),
      expect.any(Array),
      [],
    );
  });

  it('restores the same challenge key with the remaining ttl', async () => {
    redis.set.mockResolvedValue('OK');

    await store.restore('token', challenge, 117);

    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:challenge:/),
      challenge,
      { ex: 117, nx: true },
    );
  });

  it('uses an atomic counter that deletes at five failures', async () => {
    redis.eval.mockResolvedValue(5);
    await store.fail('token');

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('attempts >= tonumber(ARGV[1])'),
      expect.any(Array),
      ['5'],
    );
  });

  it('uses ten minutes for email challenges', async () => {
    redis.set.mockResolvedValue('OK');

    await store.create({
      ...challenge,
      next: 'email',
      emailCodeHash: 'hash',
      emailLastSentAt: Date.now(),
      emailResendCount: 0,
    });

    expect(redis.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ next: 'email' }),
      { ex: 600 },
    );
  });

  it('reserves an email resend atomically with the remaining ttl', async () => {
    redis.eval.mockResolvedValue([1, 2, 2_000, 420]);

    await expect(store.reserveEmailResend('token', 2_000)).resolves.toEqual({
      resendCount: 2,
      lastSentAt: 2_000,
      ttlSeconds: 420,
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("challenge.next ~= 'email'"),
      expect.any(Array),
      ['3', '2000', '60000'],
    );
  });

  it.each([
    [-2, 'EMAIL_CODE_RESEND_COOLDOWN'],
    [-3, 'EMAIL_CODE_RESEND_LIMIT'],
  ])('rejects resend state %s', async (state, reason) => {
    redis.eval.mockResolvedValue([state, 42]);

    await expect(
      store.reserveEmailResend('token', 2_000),
    ).rejects.toMatchObject({ statusCode: 429, reason });
  });
});
