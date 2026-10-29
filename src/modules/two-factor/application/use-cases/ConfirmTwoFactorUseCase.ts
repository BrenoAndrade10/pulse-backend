import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import { TWO_FACTOR_REPOSITORY } from '../../domain/repositories/TwoFactorRepository';
import type {
  RecoveryCodeReplacement,
  TwoFactorRepository,
} from '../../domain/repositories/TwoFactorRepository';
import { AesTwoFactorCipher } from '../../infra/crypto/AesTwoFactorCipher';
import { RecoveryCodes } from '../services/RecoveryCodes';
import { TotpService } from '../services/TotpService';

const SETUP_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class ConfirmTwoFactorUseCase {
  private readonly logger = new Logger(ConfirmTwoFactorUseCase.name);

  constructor(
    @Inject(TWO_FACTOR_REPOSITORY)
    private readonly twoFactor: TwoFactorRepository,
    @Inject(ID_GENERATOR)
    private readonly ids: IdGenerator,
    private readonly cipher: AesTwoFactorCipher,
    private readonly totp: TotpService,
    private readonly recoveryCodes: RecoveryCodes,
  ) {}

  async execute(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const state = await this.twoFactor.findByUserId(userId);
    if (state?.confirmedAt) {
      throw new DomainError(409, 'TWO_FACTOR_ALREADY_ENABLED');
    }
    const now = new Date();
    if (!state || state.updatedAt.getTime() + SETUP_TTL_MS <= now.getTime()) {
      throw new DomainError(400, 'TWO_FACTOR_SETUP_EXPIRED');
    }

    const secret = this.cipher.decrypt(
      {
        encryptedValue: state.secretEncrypted,
        iv: state.secretIv,
        authTag: state.secretAuthTag,
      },
      userId,
    );
    const verification = await this.totp.verify(
      secret,
      code,
      state.lastUsedStep,
    );
    if (!verification.valid) {
      throw new DomainError(400, 'TWO_FACTOR_CODE_INVALID');
    }

    const recoveryCodes = this.recoveryCodes.generate();
    const confirmed = await this.twoFactor.confirmAndReplaceRecoveryCodes({
      userId,
      expectedSecretEncrypted: state.secretEncrypted,
      setupValidAfter: new Date(now.getTime() - SETUP_TTL_MS),
      step: verification.step,
      now,
      recoveryCodes: this.records(userId, recoveryCodes, now),
    });
    if (!confirmed) {
      throw new DomainError(400, 'TWO_FACTOR_CODE_INVALID');
    }

    this.logger.log({ event: 'two_factor.enabled', userId });
    return { recoveryCodes };
  }

  private records(
    userId: string,
    codes: string[],
    now: Date,
  ): RecoveryCodeReplacement[] {
    return codes.map((code) => ({
      id: this.ids.generate(),
      userId,
      codeHash: this.recoveryCodes.hash(userId, code),
      createdAt: now,
    }));
  }
}
