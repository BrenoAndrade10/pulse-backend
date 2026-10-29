import { LogoutAllSessionsUseCase } from './LogoutAllSessionsUseCase';

describe('LogoutAllSessionsUseCase', () => {
  it('revokes sessions and trusted devices', async () => {
    const sessions = {
      deleteAllByUserId: jest.fn().mockResolvedValue(undefined),
    };
    const trustedDevices = {
      revokeAll: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new LogoutAllSessionsUseCase(
      sessions as never,
      trustedDevices as never,
    );

    await expect(useCase.execute('user-id')).resolves.toBeUndefined();

    expect(sessions.deleteAllByUserId).toHaveBeenCalledWith('user-id');
    expect(trustedDevices.revokeAll).toHaveBeenCalledWith('user-id');
  });
});
