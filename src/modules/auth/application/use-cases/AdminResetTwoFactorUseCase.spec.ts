import { UserRole } from '../../../users/domain/enums/UserRole';
import { AdminResetTwoFactorUseCase } from './AdminResetTwoFactorUseCase';

describe('AdminResetTwoFactorUseCase', () => {
  const accounts = { findMembershipsByUserId: jest.fn() };
  const twoFactor = { deleteAllForUser: jest.fn() };
  const logoutAll = { execute: jest.fn() };
  const auth = {
    userId: 'admin-id',
    sessionId: 'session-id',
    tenantId: 'tenant-id',
    role: UserRole.ADMIN,
  };
  let useCase: AdminResetTwoFactorUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    accounts.findMembershipsByUserId.mockResolvedValue([
      { tenantId: 'tenant-id', role: UserRole.MEMBER },
    ]);
    twoFactor.deleteAllForUser.mockResolvedValue(undefined);
    logoutAll.execute.mockResolvedValue(undefined);
    useCase = new AdminResetTwoFactorUseCase(
      accounts as never,
      twoFactor as never,
      logoutAll as never,
    );
  });

  it('resets a user in the same tenant and revokes sessions', async () => {
    await expect(useCase.execute(auth, 'target-id')).resolves.toBeUndefined();
    expect(logoutAll.execute).toHaveBeenCalledWith('target-id');
    expect(twoFactor.deleteAllForUser).toHaveBeenCalledWith('target-id');
    expect(logoutAll.execute.mock.invocationCallOrder[0]).toBeLessThan(
      twoFactor.deleteAllForUser.mock.invocationCallOrder[0],
    );
  });

  it.each([
    ['member', { ...auth, role: UserRole.MEMBER }, 'target-id'],
    ['self', auth, 'admin-id'],
    ['other tenant', auth, 'target-id'],
  ])('rejects %s reset', async (scenario, current, target) => {
    if (scenario === 'other tenant') {
      accounts.findMembershipsByUserId.mockResolvedValue([
        { tenantId: 'other', role: UserRole.MEMBER },
      ]);
    }
    await expect(useCase.execute(current, target)).rejects.toMatchObject({
      statusCode: 403,
      reason:
        scenario === 'other tenant'
          ? 'TWO_FACTOR_RESET_FORBIDDEN'
          : 'FORBIDDEN',
    });
  });

  it('rejects a user linked to another tenant too', async () => {
    accounts.findMembershipsByUserId.mockResolvedValue([
      { tenantId: 'tenant-id', role: UserRole.MEMBER },
      { tenantId: 'other-tenant', role: UserRole.MEMBER },
    ]);

    await expect(useCase.execute(auth, 'target-id')).rejects.toMatchObject({
      statusCode: 403,
      reason: 'TWO_FACTOR_RESET_FORBIDDEN',
    });
    expect(logoutAll.execute).not.toHaveBeenCalled();
  });

  it('retries revocation and fails without deleting two-factor state', async () => {
    logoutAll.execute.mockRejectedValue(new Error('redis unavailable'));

    await expect(useCase.execute(auth, 'target-id')).rejects.toMatchObject({
      statusCode: 503,
      reason: 'SERVICE_UNAVAILABLE',
    });
    expect(logoutAll.execute).toHaveBeenCalledTimes(3);
    expect(twoFactor.deleteAllForUser).not.toHaveBeenCalled();
  });
});
