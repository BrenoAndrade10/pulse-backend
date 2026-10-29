import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { RECOVERY_CODES_REPOSITORY } from '../../domain/repositories/RecoveryCodesRepository';
import type { RecoveryCodesRepository } from '../../domain/repositories/RecoveryCodesRepository';
import { TWO_FACTOR_REPOSITORY } from '../../domain/repositories/TwoFactorRepository';
import type { TwoFactorRepository } from '../../domain/repositories/TwoFactorRepository';
import { AesTwoFactorCipher } from '../../infra/crypto/AesTwoFactorCipher';
import { RecoveryCodes } from '../services/RecoveryCodes';
import { TotpService } from '../services/TotpService';

@Injectable()
export class VerifyTwoFactorUseCase {
  private readonly logger = new Logger(VerifyTwoFactorUseCase.name);

  constructor(
    @Inject(TWO_FACTOR_REPOSITORY)
    private readonly twoFactor: TwoFactorRepository,
    @Inject(RECOVERY_CODES_REPOSITORY)
    private readonly recoveryRepository: RecoveryCodesRepository,
    private readonly cipher: AesTwoFactorCipher,
    private readonly totp: TotpService,
    private readonly recoveryCodes: RecoveryCodes,
  ) {}

  async execute(
    userId: string,
    input: { code?: string; recoveryCode?: string },
  ): Promise<{ recoveryCodesRemaining?: number }> {
    const state = await this.twoFactor.findByUserId(userId);
    if (!state?.confirmedAt) {
      throw new DomainError(400, 'TWO_FACTOR_CODE_INVALID');
    }

    let recoveryCodesRemaining: number | undefined;
    if (input.code) {
      const secret = this.cipher.decrypt(
        {
          encryptedValue: state.secretEncrypted,
          iv: state.secretIv,
          authTag: state.secretAuthTag,
        },
        userId,
      );
      const result = await this.totp.verify(
        secret,
        input.code,
        state.lastUsedStep,
      );
      if (
        !result.valid ||
        !(await this.twoFactor.updateLastUsedStep(
          userId,
          result.step,
          new Date(),
        ))
      ) {
        throw new DomainError(400, 'TWO_FACTOR_CODE_INVALID');
      }
    } else if (input.recoveryCode) {
      const consumed = await this.recoveryRepository.consume(
        userId,
        this.recoveryCodes.hash(userId, input.recoveryCode),
        new Date(),
      );
      if (!consumed) {
        throw new DomainError(400, 'TWO_FACTOR_CODE_INVALID');
      }
      recoveryCodesRemaining =
        await this.recoveryRepository.countUnused(userId);
      this.logger.warn({ event: 'two_factor.recovery_code_used', userId });
    } else {
      throw new DomainError(400, 'TWO_FACTOR_CODE_INVALID');
    }

    return recoveryCodesRemaining === undefined
      ? {}
      : { recoveryCodesRemaining };
  }
}
