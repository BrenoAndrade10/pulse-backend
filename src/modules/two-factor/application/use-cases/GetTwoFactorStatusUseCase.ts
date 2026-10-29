import { Inject, Injectable } from '@nestjs/common';
import { RECOVERY_CODES_REPOSITORY } from '../../domain/repositories/RecoveryCodesRepository';
import type { RecoveryCodesRepository } from '../../domain/repositories/RecoveryCodesRepository';
import { TWO_FACTOR_REPOSITORY } from '../../domain/repositories/TwoFactorRepository';
import type { TwoFactorRepository } from '../../domain/repositories/TwoFactorRepository';

export type TwoFactorStatus = {
  enabled: boolean;
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
};

@Injectable()
export class GetTwoFactorStatusUseCase {
  constructor(
    @Inject(TWO_FACTOR_REPOSITORY)
    private readonly twoFactor: TwoFactorRepository,
    @Inject(RECOVERY_CODES_REPOSITORY)
    private readonly recoveryCodes: RecoveryCodesRepository,
  ) {}

  async execute(userId: string): Promise<TwoFactorStatus> {
    const state = await this.twoFactor.findByUserId(userId);
    if (!state?.confirmedAt) {
      return {
        enabled: false,
        confirmedAt: null,
        recoveryCodesRemaining: 0,
      };
    }

    return {
      enabled: true,
      confirmedAt: state.confirmedAt.toISOString(),
      recoveryCodesRemaining: await this.recoveryCodes.countUnused(userId),
    };
  }
}
