import { DomainError } from '../../../../../shared/errors/DomainError';
import { EmailChallengeUseCase } from './EmailChallengeUseCase';

describe('EmailChallengeUseCase', () => {
  const challenge = {
    userId: 'user-id',
    tenantId: 'tenant-id',
    remember: true,
    next: 'email' as const,
    attempts: 0,
    emailCodeHash: 'code-hash',
    emailLastSentAt: 1_000,
    emailResendCount: 0,
  };
  const challenges = {
    consume: jest.fn(),
    restore: jest.fn(),
    fail: jest.fn(),
    complete: jest.fn(),
    get: jest.fn(),
    reserveEmailResend: jest.fn(),
    replaceEmailCode: jest.fn(),
  };
  const codes = {
    matches: jest.fn(),
    generate: jest.fn(),
    hash: jest.fn(),
    maskEmail: jest.fn(),
  };
  const templates = { render: jest.fn() };
  const sender = { send: jest.fn() };
  const accounts = { findUserById: jest.fn() };
  const devices = { create: jest.fn() };
  const issuer = { issue: jest.fn() };
  let useCase: EmailChallengeUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    challenges.consume.mockResolvedValue({ challenge, ttlSeconds: 480 });
    challenges.get.mockResolvedValue(challenge);
    challenges.reserveEmailResend.mockResolvedValue({
      resendCount: 1,
      lastSentAt: 2_000,
      ttlSeconds: 420,
    });
    codes.matches.mockReturnValue(true);
    codes.generate.mockReturnValue('654321');
    codes.hash.mockReturnValue('new-hash');
    codes.maskEmail.mockReturnValue('u****@e****.com');
    templates.render.mockReturnValue({ html: '<p>654321</p>', text: '654321' });
    sender.send.mockResolvedValue(undefined);
    accounts.findUserById.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
    });
    devices.create.mockResolvedValue({
      token: 'trusted',
      expiresAt: new Date(),
    });
    issuer.issue.mockResolvedValue({ accessToken: 'access' });
    useCase = new EmailChallengeUseCase(
      challenges as never,
      codes,
      templates as never,
      sender,
      accounts as never,
      devices as never,
      issuer as never,
    );
  });

  it('consumes the code and creates a trusted device', async () => {
    await expect(
      useCase.verify({
        challengeToken: 'token',
        code: '123456',
        trustDevice: true,
        ip: null,
        userAgent: 'Chrome/100',
      }),
    ).resolves.toMatchObject({ trustedDevice: { token: 'trusted' } });
    expect(codes.matches).toHaveBeenCalledWith(
      'user-id',
      '123456',
      'code-hash',
    );
    expect(challenges.complete).toHaveBeenCalledWith('token');
  });

  it('restores an invalid code and counts the attempt', async () => {
    codes.matches.mockReturnValue(false);

    await expect(
      useCase.verify({
        challengeToken: 'token',
        code: '000000',
        trustDevice: false,
        ip: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ reason: 'TWO_FACTOR_CODE_INVALID' });
    expect(challenges.restore).toHaveBeenCalledWith('token', challenge, 480);
    expect(challenges.fail).toHaveBeenCalledWith('token');
  });

  it('resends and replaces the previous code only after sending', async () => {
    await expect(
      useCase.resend({
        challengeToken: 'token',
        ip: '192.0.2.10',
        userAgent: 'Chrome/100',
      }),
    ).resolves.toMatchObject({ emailHint: 'u****@e****.com' });
    expect(sender.send.mock.invocationCallOrder[0]).toBeLessThan(
      challenges.replaceEmailCode.mock.invocationCallOrder[0],
    );
    expect(challenges.replaceEmailCode).toHaveBeenCalledWith(
      'token',
      2_000,
      'new-hash',
    );
  });

  it('returns 503 and keeps the previous code when sending fails', async () => {
    sender.send.mockRejectedValue(new Error('provider unavailable'));

    await expect(
      useCase.resend({
        challengeToken: 'token',
        ip: null,
        userAgent: null,
      }),
    ).rejects.toEqual(new DomainError(503, 'EMAIL_SEND_FAILED'));
    expect(challenges.replaceEmailCode).not.toHaveBeenCalled();
  });
});
