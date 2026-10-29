import type { Request, Response } from 'express';
import { Environment } from '../../../../config/Environment';
import { ValidationError } from 'yup';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { UserRole } from '../../../users/domain/enums/UserRole';
import type { ConfirmTwoFactorUseCase } from '../../application/use-cases/ConfirmTwoFactorUseCase';
import type { GetTwoFactorStatusUseCase } from '../../application/use-cases/GetTwoFactorStatusUseCase';
import type { RegenerateRecoveryCodesUseCase } from '../../application/use-cases/RegenerateRecoveryCodesUseCase';
import type { SetupTwoFactorUseCase } from '../../application/use-cases/SetupTwoFactorUseCase';
import { TwoFactorController } from './TwoFactorController';

describe('TwoFactorController', () => {
  const auth: AccessTokenClaims = {
    userId: 'user-id',
    sessionId: 'session-id',
    tenantId: 'tenant-id',
    role: UserRole.ADMIN,
  };
  const status = { execute: jest.fn() };
  const setup = { execute: jest.fn() };
  const confirm = { execute: jest.fn() };
  const regenerate = { execute: jest.fn() };
  const users = { findById: jest.fn() };
  const trustedDevices = {
    list: jest.fn(),
    hash: jest.fn(),
    revoke: jest.fn(),
  };
  const setHeader = jest.fn();
  const clearCookie = jest.fn();
  const response = { setHeader, clearCookie } as unknown as Response;
  const request = {
    cookies: { pulse_trusted_device: 'current-token' },
  } as unknown as Request;
  let controller: TwoFactorController;

  beforeEach(() => {
    jest.clearAllMocks();
    Environment.vars = { AUTH_COOKIE_SECURE: false } as typeof Environment.vars;
    status.execute.mockResolvedValue({ enabled: false });
    setup.execute.mockResolvedValue({ secret: 'secret' });
    confirm.execute.mockResolvedValue({ recoveryCodes: [] });
    regenerate.execute.mockResolvedValue({ recoveryCodes: [] });
    users.findById.mockResolvedValue({ email: 'user@example.com' });
    trustedDevices.list.mockResolvedValue([]);
    trustedDevices.hash.mockReturnValue('current-hash');
    controller = new TwoFactorController(
      status as unknown as GetTwoFactorStatusUseCase,
      setup as unknown as SetupTwoFactorUseCase,
      confirm as unknown as ConfirmTwoFactorUseCase,
      regenerate as unknown as RegenerateRecoveryCodesUseCase,
      users as never,
      trustedDevices as never,
    );
  });

  it('clears the cookie when the current device is removed', async () => {
    trustedDevices.list.mockResolvedValue([
      { id: 'device-id', tokenHash: 'current-hash' },
    ]);

    await controller.revokeDevice(auth, 'device-id', request, response);

    expect(trustedDevices.revoke).toHaveBeenCalledWith(
      auth.userId,
      'device-id',
    );
    expect(clearCookie).toHaveBeenCalledWith(
      'pulse_trusted_device',
      expect.objectContaining({ path: '/auth' }),
    );
  });

  it('sets no-store on every response', async () => {
    await controller.getStatus(auth, response);
    await controller.setupTwoFactor(auth, response);
    await controller.confirmTwoFactor(auth, { code: '123456' }, response);
    await controller.regenerateRecoveryCodes(
      auth,
      { code: '123456' },
      response,
    );

    expect(setHeader).toHaveBeenCalledTimes(4);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(setup.execute).toHaveBeenCalledWith(auth.userId, 'user@example.com');
  });

  it.each([
    ['wrong length', { code: '12345' }],
    ['non numeric', { code: '12345a' }],
    ['unknown field', { code: '123456', extra: true }],
  ])('rejects %s input', async (_case, body) => {
    await expect(
      controller.confirmTwoFactor(auth, body, response),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(confirm.execute).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
