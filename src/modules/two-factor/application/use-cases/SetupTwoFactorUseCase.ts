import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { TWO_FACTOR_REPOSITORY } from '../../domain/repositories/TwoFactorRepository';
import type { TwoFactorRepository } from '../../domain/repositories/TwoFactorRepository';
import { AesTwoFactorCipher } from '../../infra/crypto/AesTwoFactorCipher';
import { TotpService } from '../services/TotpService';

const SETUP_TTL_MS = 15 * 60 * 1000;

export type SetupTwoFactorResult = {
  otpauthUri: string;
  secret: string;
  expiresAt: string;
};

@Injectable()
export class SetupTwoFactorUseCase {
  private readonly logger = new Logger(SetupTwoFactorUseCase.name);

  constructor(
    @Inject(TWO_FACTOR_REPOSITORY)
    private readonly twoFactor: TwoFactorRepository,
    private readonly cipher: AesTwoFactorCipher,
    private readonly totp: TotpService,
  ) {}

  async execute(userId: string, email: string): Promise<SetupTwoFactorResult> {
    const current = await this.twoFactor.findByUserId(userId);
    if (current?.confirmedAt) {
      throw new DomainError(409, 'TWO_FACTOR_ALREADY_ENABLED');
    }

    const secret = this.totp.generateSecret();
    const encrypted = this.cipher.encrypt(secret, userId);
    const now = new Date();
    await this.twoFactor.upsertPending({
      userId,
      secretEncrypted: encrypted.encryptedValue,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      now,
    });
    const stored = await this.twoFactor.findByUserId(userId);
    if (
      stored?.confirmedAt ||
      stored?.secretEncrypted !== encrypted.encryptedValue
    ) {
      throw new DomainError(409, 'TWO_FACTOR_ALREADY_ENABLED');
    }
    this.logger.log({ event: 'two_factor.setup_started', userId });

    return {
      otpauthUri: this.totp.keyUri(email, secret),
      secret,
      expiresAt: new Date(now.getTime() + SETUP_TTL_MS).toISOString(),
    };
  }
}
