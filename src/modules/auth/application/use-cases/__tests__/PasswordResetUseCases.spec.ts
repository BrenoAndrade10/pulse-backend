import { Environment } from '../../../../../config/Environment';
import { Logger } from '@nestjs/common';
import type { RateLimiter } from '../../../../../shared/infra/redis/RateLimiter';
import { User } from '../../../../users/domain/entities/User';
import { UserStatus } from '../../../../users/domain/enums/UserStatus';
import type { AuthAccountsRepository } from '../../../domain/repositories/AuthAccountsRepository';
import type { CreatePasswordResetTokenInput } from '../../../domain/repositories/PasswordResetTokensRepository';
import type { PasswordResetTokensRepository } from '../../../domain/repositories/PasswordResetTokensRepository';
import type { EmailTemplateRenderer } from '../../services/EmailTemplateRenderer';
import { ForgotPasswordUseCase } from '../ForgotPasswordUseCase';
import type { LogoutAllSessionsUseCase } from '../LogoutAllSessionsUseCase';
import { ResetPasswordUseCase } from '../ResetPasswordUseCase';

describe('Password reset use cases', () => {
  const user = new User({
    id: 'user-id',
    firstName: 'Breno',
    email: 'breno@example.com',
    passwordHash: 'old-hash',
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const rendered = { html: '<p>email</p>', text: 'email' };
  const accounts = { findUserByEmail: jest.fn() };
  const replaceForUser: jest.MockedFunction<
    PasswordResetTokensRepository['replaceForUser']
  > = jest.fn();
  const consumeAndUpdatePassword: jest.MockedFunction<
    PasswordResetTokensRepository['consumeAndUpdatePassword']
  > = jest.fn();
  const findValid: jest.MockedFunction<
    PasswordResetTokensRepository['findValid']
  > = jest.fn();
  const tokens = { replaceForUser, findValid, consumeAndUpdatePassword };
  const emailSender = { send: jest.fn() };
  const render: jest.MockedFunction<EmailTemplateRenderer['render']> = jest
    .fn()
    .mockReturnValue(rendered);
  const renderer = { render };
  const rateLimiter = { consume: jest.fn() };
  const ids = { generate: jest.fn().mockReturnValue('token-id') };
  const passwordHasher = { hash: jest.fn(), verify: jest.fn() };
  const logoutAll = { execute: jest.fn() };
  let storedInput: CreatePasswordResetTokenInput | undefined;
  let renderedTemplate: string | undefined;
  let renderedData: Record<string, unknown> | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    storedInput = undefined;
    renderedTemplate = undefined;
    renderedData = undefined;
    Environment.vars = {
      FRONTEND_URL: 'http://localhost:5173',
    } as typeof Environment.vars;
    accounts.findUserByEmail.mockResolvedValue(user);
    tokens.replaceForUser.mockImplementation(
      (input: CreatePasswordResetTokenInput) => {
        storedInput = input;
        return Promise.resolve();
      },
    );
    tokens.consumeAndUpdatePassword.mockResolvedValue({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    });
    tokens.findValid.mockResolvedValue({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    });
    emailSender.send.mockResolvedValue(undefined);
    rateLimiter.consume.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 1,
    });
    passwordHasher.hash.mockResolvedValue('new-hash');
    logoutAll.execute.mockResolvedValue(undefined);
    renderer.render.mockImplementation(
      (
        name: 'password-reset' | 'password-changed',
        data: Record<string, unknown>,
      ) => {
        renderedTemplate = name;
        renderedData = data;
        return rendered;
      },
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores only a hash and sends the reset link for active users', async () => {
    const useCase = forgotUseCase();

    await useCase.execute(user.email);
    await new Promise((resolve) => setImmediate(resolve));

    expect(storedInput).toMatchObject({ id: 'token-id', userId: user.id });
    expect(storedInput?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        text: 'email',
      }),
    );
    expect(renderedTemplate).toBe('password-reset');
    expect(renderedData?.resetUrl).toContain(
      'http://localhost:5173/redefinir-senha#token=',
    );
  });

  it('keeps the neutral flow when the e-mail limit is exceeded', async () => {
    rateLimiter.consume.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 60,
    });

    await expect(forgotUseCase().execute(user.email)).resolves.toBeUndefined();
    expect(accounts.findUserByEmail).not.toHaveBeenCalled();
  });

  it('consumes a token, revokes sessions and sends confirmation', async () => {
    const useCase = resetUseCase();

    await expect(
      useCase.execute('a'.repeat(43), 'new-secret'),
    ).resolves.toBeUndefined();
    expect(tokens.consumeAndUpdatePassword).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'new-hash',
      expect.any(Date),
    );
    expect(logoutAll.execute).toHaveBeenCalledWith(user.id);
    expect(logoutAll.execute.mock.invocationCallOrder[0]).toBeLessThan(
      tokens.consumeAndUpdatePassword.mock.invocationCallOrder[0],
    );
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: user.email }),
    );
  });

  it('uses one generic error for invalid reset tokens', async () => {
    tokens.findValid.mockResolvedValue(null);

    await expect(
      resetUseCase().execute('a'.repeat(43), 'new-secret'),
    ).rejects.toMatchObject({
      statusCode: 400,
      reason: 'PASSWORD_RESET_TOKEN_INVALID',
    });
    expect(logoutAll.execute).not.toHaveBeenCalled();
    expect(tokens.consumeAndUpdatePassword).not.toHaveBeenCalled();
  });

  it('returns 503 without consuming the token when revocation fails', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    logoutAll.execute.mockRejectedValue(new Error('redis unavailable'));

    await expect(
      resetUseCase().execute('a'.repeat(43), 'new-secret'),
    ).rejects.toMatchObject({
      statusCode: 503,
      reason: 'SERVICE_UNAVAILABLE',
    });
    expect(logoutAll.execute).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledWith(
      `Falha ao revogar sessões antes da alteração de senha: userId=${user.id}`,
    );
    expect(tokens.consumeAndUpdatePassword).not.toHaveBeenCalled();
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  function forgotUseCase(): ForgotPasswordUseCase {
    return new ForgotPasswordUseCase(
      accounts as unknown as AuthAccountsRepository,
      tokens,
      emailSender,
      ids,
      renderer as unknown as EmailTemplateRenderer,
      rateLimiter as unknown as RateLimiter,
    );
  }

  function resetUseCase(): ResetPasswordUseCase {
    return new ResetPasswordUseCase(
      tokens,
      passwordHasher,
      emailSender,
      renderer as unknown as EmailTemplateRenderer,
      logoutAll as unknown as LogoutAllSessionsUseCase,
    );
  }
});
