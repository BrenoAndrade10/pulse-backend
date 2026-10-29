import { VerifyTwoFactorUseCase } from './VerifyTwoFactorUseCase';

describe('VerifyTwoFactorUseCase', () => {
  const state = {
    userId: 'user-id',
    secretEncrypted: 'encrypted',
    secretIv: 'iv',
    secretAuthTag: 'tag',
    confirmedAt: new Date(),
    lastUsedStep: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const twoFactor = {
    findByUserId: jest.fn(),
    updateLastUsedStep: jest.fn(),
  };
  const repository = { consume: jest.fn(), countUnused: jest.fn() };
  const cipher = { decrypt: jest.fn() };
  const totp = { verify: jest.fn() };
  const recovery = { hash: jest.fn() };
  let useCase: VerifyTwoFactorUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    twoFactor.findByUserId.mockResolvedValue(state);
    twoFactor.updateLastUsedStep.mockResolvedValue(true);
    repository.consume.mockResolvedValue(true);
    repository.countUnused.mockResolvedValue(7);
    cipher.decrypt.mockReturnValue('secret');
    totp.verify.mockResolvedValue({ valid: true, step: 11 });
    recovery.hash.mockReturnValue('hash');
    useCase = new VerifyTwoFactorUseCase(
      twoFactor as never,
      repository as never,
      cipher as never,
      totp as never,
      recovery as never,
    );
  });

  it('accepts TOTP and records its step atomically', async () => {
    await expect(
      useCase.execute('user-id', { code: '123456' }),
    ).resolves.toEqual({});
    expect(twoFactor.updateLastUsedStep).toHaveBeenCalledWith(
      'user-id',
      11,
      expect.any(Date),
    );
  });

  it('rejects a replay lost in the conditional update', async () => {
    twoFactor.updateLastUsedStep.mockResolvedValue(false);
    await expect(
      useCase.execute('user-id', { code: '123456' }),
    ).rejects.toMatchObject({ reason: 'TWO_FACTOR_CODE_INVALID' });
  });

  it('consumes a recovery code and returns the remaining count', async () => {
    await expect(
      useCase.execute('user-id', { recoveryCode: 'ABCDE-FGHJ2' }),
    ).resolves.toEqual({ recoveryCodesRemaining: 7 });
    expect(recovery.hash).toHaveBeenCalledWith('user-id', 'ABCDE-FGHJ2');
    expect(repository.consume).toHaveBeenCalledWith(
      'user-id',
      'hash',
      expect.any(Date),
    );
  });

  it('uses the same generic error for an invalid recovery code', async () => {
    repository.consume.mockResolvedValue(false);
    await expect(
      useCase.execute('user-id', { recoveryCode: 'invalid' }),
    ).rejects.toMatchObject({ reason: 'TWO_FACTOR_CODE_INVALID' });
  });
});
