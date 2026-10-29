import type { Request, Response } from 'express';
import { Environment } from '../../../../config/Environment';
import type { ForgotPasswordUseCase } from '../../application/use-cases/ForgotPasswordUseCase';
import type { GetAuthProfileUseCase } from '../../application/use-cases/GetAuthProfileUseCase';
import type { LoginUseCase } from '../../application/use-cases/LoginUseCase';
import type { LogoutAllSessionsUseCase } from '../../application/use-cases/LogoutAllSessionsUseCase';
import type { LogoutUseCase } from '../../application/use-cases/LogoutUseCase';
import type { RefreshSessionUseCase } from '../../application/use-cases/RefreshSessionUseCase';
import type { ResetPasswordUseCase } from '../../application/use-cases/ResetPasswordUseCase';
import type { TwoFactorChallengeUseCase } from '../../application/use-cases/challenge/TwoFactorChallengeUseCase';
import type { EmailChallengeUseCase } from '../../application/use-cases/challenge/EmailChallengeUseCase';
import { AuthController } from './AuthController';

describe('AuthController password reset', () => {
  const forgot = { execute: jest.fn() };
  const reset = { execute: jest.fn() };
  const logout = { execute: jest.fn() };
  const logoutAll = { execute: jest.fn() };
  const setHeader = jest.fn();
  const clearCookie = jest.fn();
  const cookie = jest.fn();
  const challenge = { confirm: jest.fn(), verify: jest.fn(), setup: jest.fn() };
  const emailChallenge = { verify: jest.fn(), resend: jest.fn() };
  const response = {
    setHeader,
    clearCookie,
    cookie,
  } as unknown as Response;
  const request = {
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('Chrome on macOS'),
  } as unknown as Request;
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    Environment.vars = { AUTH_COOKIE_SECURE: false } as typeof Environment.vars;
    forgot.execute.mockResolvedValue(undefined);
    reset.execute.mockResolvedValue(undefined);
    logout.execute.mockResolvedValue(undefined);
    logoutAll.execute.mockResolvedValue(undefined);
    emailChallenge.verify.mockResolvedValue({
      auth: {
        accessToken: 'access',
        accessTokenExpiresIn: 900,
        refreshToken: 'refresh',
        refreshTokenExpiresAt: new Date('2026-11-01T00:00:00.000Z'),
        rememberMe: true,
        profile: { user: {}, activeTenant: null, tenants: [] },
      },
      trustedDevice: {
        token: 'trusted-token',
        expiresAt: new Date('2026-11-20T00:00:00.000Z'),
      },
    });
    emailChallenge.resend.mockResolvedValue({
      expiresAt: '2026-11-01T00:10:00.000Z',
      emailHint: 'u****@e****.com',
    });
    controller = new AuthController(
      {} as LoginUseCase,
      {} as RefreshSessionUseCase,
      logout as unknown as LogoutUseCase,
      logoutAll as unknown as LogoutAllSessionsUseCase,
      {} as GetAuthProfileUseCase,
      forgot as unknown as ForgotPasswordUseCase,
      reset as unknown as ResetPasswordUseCase,
      challenge as unknown as TwoFactorChallengeUseCase,
      emailChallenge as unknown as EmailChallengeUseCase,
    );
  });

  it('resends an email challenge without caching the response', async () => {
    await expect(
      controller.emailChallengeResend(
        { challengeToken: 'a'.repeat(43) },
        request,
        response,
      ),
    ).resolves.toMatchObject({ emailHint: 'u****@e****.com' });
    expect(emailChallenge.resend).toHaveBeenCalledWith({
      challengeToken: 'a'.repeat(43),
      ip: '127.0.0.1',
      userAgent: 'Chrome on macOS',
    });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('sets session and trusted-device cookies after email verification', async () => {
    await controller.emailChallengeVerify(
      {
        challengeToken: 'a'.repeat(43),
        code: '123456',
        trustDevice: true,
      },
      request,
      response,
    );

    expect(cookie).toHaveBeenCalledWith(
      'pulse_trusted_device',
      'trusted-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/auth',
      }),
    );
    expect(cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('always returns the neutral forgot response', async () => {
    await expect(
      controller.forgotPassword({ email: ' User@Example.com ' }, response),
    ).resolves.toEqual({
      message:
        'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.',
    });
    expect(forgot.execute).toHaveBeenCalledWith('user@example.com');
  });

  it('clears auth cookies after a successful reset', async () => {
    await expect(
      controller.resetPassword(
        { token: 'a'.repeat(43), password: 'secret123' },
        response,
      ),
    ).resolves.toEqual({ message: 'Senha redefinida com sucesso.' });
    expect(clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ path: '/auth' }),
    );
    expect(clearCookie).toHaveBeenCalledWith(
      'pulse_trusted_device',
      expect.objectContaining({ path: '/auth' }),
    );
  });

  it('clears the session cookie and keeps the trusted device on logout', async () => {
    const logoutRequest = {
      cookies: { refresh_token: 'refresh' },
    } as unknown as Request;

    await controller.logout(logoutRequest, response);

    expect(logout.execute).toHaveBeenCalledWith({ refreshToken: 'refresh' });
    expect(clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ path: '/auth' }),
    );
    expect(clearCookie).not.toHaveBeenCalledWith(
      'pulse_trusted_device',
      expect.anything(),
    );
  });
});
