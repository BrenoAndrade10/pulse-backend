import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../../../shared/errors/DomainError';
import { VerifyTwoFactorUseCase } from '../../../../two-factor/application/use-cases/VerifyTwoFactorUseCase';
import { TrustedDevicesService } from '../../../../two-factor/application/services/TrustedDevicesService';
import { AuthChallengeStore } from '../../../../two-factor/infra/redis/AuthChallengeStore';
import type { AuthResult } from '../../AuthProfile';
import { SessionIssuer } from '../../services/SessionIssuer';

export type ChallengeCompletion = {
  auth: AuthResult;
  recoveryCodesRemaining?: number;
  trustedDevice?: { token: string; expiresAt: Date };
};

@Injectable()
export class TwoFactorChallengeUseCase {
  constructor(
    private readonly challenges: AuthChallengeStore,
    private readonly verifyTwoFactor: VerifyTwoFactorUseCase,
    private readonly trustedDevices: TrustedDevicesService,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async verify(input: {
    challengeToken: string;
    code?: string;
    recoveryCode?: string;
    trustDevice: boolean;
    ip: string | null;
    userAgent: string | null;
  }): Promise<ChallengeCompletion> {
    const consumed = await this.take(input.challengeToken, 'totp');
    const challenge = consumed.challenge;
    let verification: { recoveryCodesRemaining?: number };
    try {
      verification = await this.verifyTwoFactor.execute(challenge.userId, {
        code: input.code,
        recoveryCode: input.recoveryCode,
      });
    } catch (error) {
      await this.challenges.restore(
        input.challengeToken,
        challenge,
        consumed.ttlSeconds,
      );
      if (this.isInvalidCode(error))
        await this.challenges.fail(input.challengeToken);
      throw error;
    }
    await this.challenges.complete(input.challengeToken);
    return {
      auth: await this.issue(challenge, input.ip, input.userAgent),
      ...verification,
      trustedDevice: input.trustDevice
        ? await this.trustedDevices.create(challenge.userId, input.userAgent)
        : undefined,
    };
  }

  private async take(token: string, next: 'totp') {
    const consumed = await this.challenges.consume(token);
    if (consumed.challenge.next !== next) {
      await this.challenges.restore(
        token,
        consumed.challenge,
        consumed.ttlSeconds,
      );
      await this.challenges.fail(token);
      throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
    }
    return consumed;
  }

  private issue(
    challenge: {
      userId: string;
      tenantId: string | null;
      remember: boolean;
    },
    ip: string | null,
    userAgent: string | null,
  ): Promise<AuthResult> {
    return this.sessionIssuer.issue({
      userId: challenge.userId,
      tenantId: challenge.tenantId,
      rememberMe: challenge.remember,
      ip,
      userAgent,
    });
  }

  private isInvalidCode(error: unknown): boolean {
    return (
      error instanceof DomainError && error.reason === 'TWO_FACTOR_CODE_INVALID'
    );
  }
}
