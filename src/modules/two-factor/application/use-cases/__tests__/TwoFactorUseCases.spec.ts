import { Logger } from '@nestjs/common';
import type {
  ConfirmTwoFactorInput,
  TwoFactorState,
} from '../../../domain/repositories/TwoFactorRepository';
import type { AesTwoFactorCipher } from '../../../infra/crypto/AesTwoFactorCipher';
import type { RecoveryCodes } from '../../services/RecoveryCodes';
import { ConfirmTwoFactorUseCase } from '../ConfirmTwoFactorUseCase';
import { GetTwoFactorStatusUseCase } from '../GetTwoFactorStatusUseCase';
import { RegenerateRecoveryCodesUseCase } from '../RegenerateRecoveryCodesUseCase';
import { SetupTwoFactorUseCase } from '../SetupTwoFactorUseCase';

describe('Two-factor configuration use cases', () => {
  const now = new Date('2026-10-21T20:00:00.000Z');
  const userId = 'user-id';
  const rawCodes = Array.from(
    { length: 10 },
    (_, index) => `ABCDE-${String(index).padStart(5, '2')}`,
  );
  const pending: TwoFactorState = {
    userId,
    secretEncrypted: 'encrypted-secret',
    secretIv: 'iv',
    secretAuthTag: 'tag',
    confirmedAt: null,
    lastUsedStep: null,
    createdAt: now,
    updatedAt: now,
  };
  const twoFactor = {
    findByUserId: jest.fn(),
    upsertPending: jest.fn(),
    updateLastUsedStep: jest.fn(),
    confirmAndReplaceRecoveryCodes: jest.fn(),
    regenerateRecoveryCodes: jest.fn(),
    deleteForUser: jest.fn(),
    deleteAllForUser: jest.fn(),
  };
  const codesRepository = {
    countUnused: jest.fn(),
    replaceForUser: jest.fn(),
    consume: jest.fn(),
    deleteForUser: jest.fn(),
  };
  const cipher = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };
  const totp = {
    generateSecret: jest.fn(),
    keyUri: jest.fn(),
    verify: jest.fn(),
  };
  const recoveryCodes = {
    generate: jest.fn(),
    hash: jest.fn(),
  };
  const ids = { generate: jest.fn() };
  let confirmedInput: ConfirmTwoFactorInput | undefined;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.clearAllMocks();
    confirmedInput = undefined;
    twoFactor.findByUserId.mockResolvedValue(null);
    twoFactor.upsertPending.mockResolvedValue(undefined);
    twoFactor.confirmAndReplaceRecoveryCodes.mockImplementation(
      (input: ConfirmTwoFactorInput) => {
        confirmedInput = input;
        return Promise.resolve(true);
      },
    );
    twoFactor.regenerateRecoveryCodes.mockResolvedValue(true);
    codesRepository.countUnused.mockResolvedValue(8);
    cipher.encrypt.mockReturnValue({
      encryptedValue: 'encrypted-secret',
      iv: 'iv',
      authTag: 'tag',
    });
    cipher.decrypt.mockReturnValue('BASE32SECRET');
    totp.generateSecret.mockReturnValue('BASE32SECRET');
    totp.keyUri.mockReturnValue('otpauth://uri');
    totp.verify.mockResolvedValue({ valid: true, step: 123 });
    recoveryCodes.generate.mockReturnValue(rawCodes);
    recoveryCodes.hash.mockImplementation(
      (hashUserId: string, code: string) => `hash:${hashUserId}:${code}`,
    );
    ids.generate.mockReturnValue('code-id');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('SetupTwoFactorUseCase', () => {
    it.each([
      ['new setup', null],
      ['pending replacement', pending],
    ])('starts a %s', async (_case, state) => {
      twoFactor.findByUserId.mockResolvedValue(state);
      twoFactor.findByUserId
        .mockResolvedValueOnce(state)
        .mockResolvedValueOnce({
          ...pending,
          secretEncrypted: 'encrypted-secret',
        });

      await expect(
        setup().execute(userId, 'user@example.com'),
      ).resolves.toEqual({
        otpauthUri: 'otpauth://uri',
        secret: 'BASE32SECRET',
        expiresAt: '2026-10-21T20:15:00.000Z',
      });
      expect(twoFactor.upsertPending).toHaveBeenCalledWith({
        userId,
        secretEncrypted: 'encrypted-secret',
        secretIv: 'iv',
        secretAuthTag: 'tag',
        now,
      });
    });

    it('rejects an already active setup', async () => {
      twoFactor.findByUserId.mockResolvedValue({
        ...pending,
        confirmedAt: now,
      });

      await expect(
        setup().execute(userId, 'user@example.com'),
      ).rejects.toMatchObject({
        statusCode: 409,
        reason: 'TWO_FACTOR_ALREADY_ENABLED',
      });
      expect(twoFactor.upsertPending).not.toHaveBeenCalled();
    });
  });

  describe('ConfirmTwoFactorUseCase', () => {
    it('confirms atomically and returns the recovery codes once', async () => {
      twoFactor.findByUserId.mockResolvedValue(pending);

      await expect(confirm().execute(userId, '123456')).resolves.toEqual({
        recoveryCodes: rawCodes,
      });
      expect(twoFactor.confirmAndReplaceRecoveryCodes).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          expectedSecretEncrypted: pending.secretEncrypted,
          setupValidAfter: new Date('2026-10-21T19:45:00.000Z'),
          step: 123,
        }),
      );
      expect(confirmedInput?.recoveryCodes[0]?.codeHash).toBe(
        `hash:${userId}:${rawCodes[0]}`,
      );
    });

    it('rejects an incorrect code', async () => {
      twoFactor.findByUserId.mockResolvedValue(pending);
      totp.verify.mockResolvedValue({ valid: false, step: null });

      await expect(confirm().execute(userId, '000000')).rejects.toMatchObject({
        statusCode: 400,
        reason: 'TWO_FACTOR_CODE_INVALID',
      });
    });

    it('rejects an expired setup', async () => {
      twoFactor.findByUserId.mockResolvedValue({
        ...pending,
        updatedAt: new Date(now.getTime() - 15 * 60 * 1000),
      });

      await expect(confirm().execute(userId, '123456')).rejects.toMatchObject({
        statusCode: 400,
        reason: 'TWO_FACTOR_SETUP_EXPIRED',
      });
      expect(totp.verify).not.toHaveBeenCalled();
    });

    it('rejects a replay lost in the atomic update', async () => {
      twoFactor.findByUserId.mockResolvedValue(pending);
      twoFactor.confirmAndReplaceRecoveryCodes.mockResolvedValue(false);

      await expect(confirm().execute(userId, '123456')).rejects.toMatchObject({
        statusCode: 400,
        reason: 'TWO_FACTOR_CODE_INVALID',
      });
    });
  });

  describe('RegenerateRecoveryCodesUseCase', () => {
    it('replaces codes after atomic anti-replay verification', async () => {
      twoFactor.findByUserId.mockResolvedValue({
        ...pending,
        confirmedAt: now,
        lastUsedStep: 122,
      });

      await expect(regenerate().execute(userId, '123456')).resolves.toEqual({
        recoveryCodes: rawCodes,
      });
      expect(twoFactor.regenerateRecoveryCodes).toHaveBeenCalledWith(
        expect.objectContaining({ userId, step: 123 }),
      );
    });

    it('requires enabled two-factor authentication', async () => {
      twoFactor.findByUserId.mockResolvedValue(pending);

      await expect(
        regenerate().execute(userId, '123456'),
      ).rejects.toMatchObject({
        statusCode: 400,
        reason: 'TWO_FACTOR_NOT_ENABLED',
      });
    });

    it('rejects an incorrect code', async () => {
      twoFactor.findByUserId.mockResolvedValue({
        ...pending,
        confirmedAt: now,
      });
      totp.verify.mockResolvedValue({ valid: false, step: null });

      await expect(
        regenerate().execute(userId, '000000'),
      ).rejects.toMatchObject({
        statusCode: 400,
        reason: 'TWO_FACTOR_CODE_INVALID',
      });
    });
  });

  describe('GetTwoFactorStatusUseCase', () => {
    it('returns disabled for missing or pending setup', async () => {
      await expect(status().execute(userId)).resolves.toEqual({
        enabled: false,
        confirmedAt: null,
        recoveryCodesRemaining: 0,
      });
    });

    it('returns confirmation and unused code count', async () => {
      twoFactor.findByUserId.mockResolvedValue({
        ...pending,
        confirmedAt: now,
      });

      await expect(status().execute(userId)).resolves.toEqual({
        enabled: true,
        confirmedAt: now.toISOString(),
        recoveryCodesRemaining: 8,
      });
    });
  });

  function setup(): SetupTwoFactorUseCase {
    return new SetupTwoFactorUseCase(
      twoFactor,
      cipher as unknown as AesTwoFactorCipher,
      totp,
    );
  }

  function confirm(): ConfirmTwoFactorUseCase {
    return new ConfirmTwoFactorUseCase(
      twoFactor,
      ids,
      cipher as unknown as AesTwoFactorCipher,
      totp,
      recoveryCodes as unknown as RecoveryCodes,
    );
  }

  function regenerate(): RegenerateRecoveryCodesUseCase {
    return new RegenerateRecoveryCodesUseCase(
      twoFactor,
      ids,
      cipher as unknown as AesTwoFactorCipher,
      totp,
      recoveryCodes as unknown as RecoveryCodes,
    );
  }

  function status(): GetTwoFactorStatusUseCase {
    return new GetTwoFactorStatusUseCase(twoFactor, codesRepository);
  }
});
