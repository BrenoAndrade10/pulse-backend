import { TwoFactorChallengeUseCase } from './TwoFactorChallengeUseCase';
import { DomainError } from '../../../../../shared/errors/DomainError';

describe('TwoFactorChallengeUseCase', () => {
  const challenge = {
    userId: 'user-id',
    tenantId: 'tenant-id',
    remember: true,
    next: 'totp' as const,
    attempts: 0,
  };
  const challenges = {
    get: jest.fn(),
    fail: jest.fn(),
    consume: jest.fn(),
    restore: jest.fn(),
    complete: jest.fn(),
  };
  const verify = { execute: jest.fn() };
  const devices = { create: jest.fn() };
  const issuer = { issue: jest.fn() };
  let useCase: TwoFactorChallengeUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    challenges.get.mockResolvedValue(challenge);
    challenges.consume.mockResolvedValue({ challenge, ttlSeconds: 240 });
    verify.execute.mockResolvedValue({});
    issuer.issue.mockResolvedValue({ accessToken: 'access' });
    devices.create.mockResolvedValue({
      token: 'trusted',
      expiresAt: new Date(),
    });
    useCase = new TwoFactorChallengeUseCase(
      challenges as never,
      verify as never,
      devices as never,
      issuer as never,
    );
  });

  it('verifies TOTP, consumes once and creates a trusted device', async () => {
    await expect(
      useCase.verify({
        challengeToken: 'token',
        code: '123456',
        trustDevice: true,
        ip: '127.0.0.1',
        userAgent: 'Chrome',
      }),
    ).resolves.toMatchObject({
      trustedDevice: { token: 'trusted' },
    });
    expect(challenges.consume).toHaveBeenCalledWith('token');
    expect(verify.execute.mock.invocationCallOrder[0]).toBeGreaterThan(
      challenges.consume.mock.invocationCallOrder[0],
    );
    expect(challenges.complete).toHaveBeenCalledWith('token');
  });

  it('rejects the wrong next step and increments attempts', async () => {
    challenges.consume.mockResolvedValue({
      challenge: { ...challenge, next: 'email' },
      ttlSeconds: 180,
    });
    await expect(
      useCase.verify({
        challengeToken: 'token',
        code: '123456',
        trustDevice: false,
        ip: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ reason: 'AUTH_CHALLENGE_INVALID' });
    expect(challenges.fail).toHaveBeenCalledWith('token');
  });

  it('keeps the generic error and increments attempts on replay', async () => {
    challenges.consume.mockResolvedValue({
      challenge: { ...challenge, next: 'totp' },
      ttlSeconds: 180,
    });
    verify.execute.mockRejectedValue(
      new DomainError(400, 'TWO_FACTOR_CODE_INVALID'),
    );

    await expect(
      useCase.verify({
        challengeToken: 'token',
        code: '123456',
        trustDevice: false,
        ip: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ reason: 'TWO_FACTOR_CODE_INVALID' });
    expect(challenges.restore).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ next: 'totp' }),
      180,
    );
    expect(challenges.fail).toHaveBeenCalledWith('token');
  });

  it('restores an infrastructure failure without counting an attempt', async () => {
    const error = new DomainError(503, 'SERVICE_UNAVAILABLE');
    verify.execute.mockRejectedValue(error);

    await expect(
      useCase.verify({
        challengeToken: 'token',
        code: '123456',
        trustDevice: false,
        ip: null,
        userAgent: null,
      }),
    ).rejects.toBe(error);
    expect(challenges.restore).toHaveBeenCalledWith('token', challenge, 240);
    expect(challenges.fail).not.toHaveBeenCalled();
  });
});
