import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_SENDER } from '../../../../../shared/domain/EmailSender';
import type { EmailSender } from '../../../../../shared/domain/EmailSender';
import { DomainError } from '../../../../../shared/errors/DomainError';
import { TrustedDevicesService } from '../../../../two-factor/application/services/TrustedDevicesService';
import { AuthChallengeStore } from '../../../../two-factor/infra/redis/AuthChallengeStore';
import { AUTH_ACCOUNTS_REPOSITORY } from '../../../domain/repositories/AuthAccountsRepository';
import type { AuthAccountsRepository } from '../../../domain/repositories/AuthAccountsRepository';
import { EmailLoginCodes } from '../../services/EmailLoginCodes';
import { EmailTemplateRenderer } from '../../services/EmailTemplateRenderer';
import { SessionIssuer } from '../../services/SessionIssuer';
import type { ChallengeCompletion } from './TwoFactorChallengeUseCase';

@Injectable()
export class EmailChallengeUseCase {
  constructor(
    private readonly challenges: AuthChallengeStore,
    private readonly codes: EmailLoginCodes,
    private readonly templates: EmailTemplateRenderer,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @Inject(AUTH_ACCOUNTS_REPOSITORY)
    private readonly accounts: AuthAccountsRepository,
    private readonly trustedDevices: TrustedDevicesService,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async verify(input: {
    challengeToken: string;
    code: string;
    trustDevice: boolean;
    ip: string | null;
    userAgent: string | null;
  }): Promise<ChallengeCompletion> {
    const consumed = await this.challenges.consume(input.challengeToken);
    const challenge = consumed.challenge;
    if (challenge.next !== 'email' || !challenge.emailCodeHash) {
      await this.challenges.restore(
        input.challengeToken,
        challenge,
        consumed.ttlSeconds,
      );
      await this.challenges.fail(input.challengeToken);
      throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
    }
    if (
      !this.codes.matches(challenge.userId, input.code, challenge.emailCodeHash)
    ) {
      await this.challenges.restore(
        input.challengeToken,
        challenge,
        consumed.ttlSeconds,
      );
      await this.challenges.fail(input.challengeToken);
      throw new DomainError(400, 'TWO_FACTOR_CODE_INVALID');
    }
    await this.challenges.complete(input.challengeToken);
    return {
      auth: await this.sessionIssuer.issue({
        userId: challenge.userId,
        tenantId: challenge.tenantId,
        rememberMe: challenge.remember,
        ip: input.ip,
        userAgent: input.userAgent,
      }),
      trustedDevice: input.trustDevice
        ? await this.trustedDevices.create(challenge.userId, input.userAgent)
        : undefined,
    };
  }

  async resend(input: {
    challengeToken: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<{ expiresAt: string; emailHint: string }> {
    const challenge = await this.challenges.get(input.challengeToken);
    if (challenge.next !== 'email') {
      await this.challenges.fail(input.challengeToken);
      throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
    }
    const user = await this.accounts.findUserById(challenge.userId);
    if (!user) throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
    const reservation = await this.challenges.reserveEmailResend(
      input.challengeToken,
      Date.now(),
    );
    const code = this.codes.generate();
    try {
      await this.send(user.email, code, input.userAgent, input.ip);
    } catch {
      throw new DomainError(503, 'EMAIL_SEND_FAILED');
    }
    await this.challenges.replaceEmailCode(
      input.challengeToken,
      reservation.lastSentAt,
      this.codes.hash(user.id, code),
    );
    return {
      expiresAt: new Date(
        Date.now() + reservation.ttlSeconds * 1000,
      ).toISOString(),
      emailHint: this.codes.maskEmail(user.email),
    };
  }

  private send(
    email: string,
    code: string,
    userAgent: string | null,
    ip: string | null,
  ): Promise<void> {
    const rendered = this.templates.render('login-code', {
      title: 'Seu código de acesso',
      code,
      validMinutes: 10,
      context: `${this.browser(userAgent)} · ${this.approximateIp(ip)}`,
    });
    return this.emailSender.send({
      to: email,
      subject: 'Seu código de acesso — Pulse Lead',
      ...rendered,
    });
  }

  private browser(userAgent: string | null): string {
    const value = userAgent ?? '';
    if (/Edg\//.test(value)) return 'Edge';
    if (/Firefox\//.test(value)) return 'Firefox';
    if (/Chrome\//.test(value)) return 'Chrome';
    if (/Safari\//.test(value)) return 'Safari';
    return 'Navegador desconhecido';
  }

  private approximateIp(ip: string | null): string {
    if (!ip) return 'IP desconhecido';
    if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}:…`;
    const parts = ip.split('.');
    return parts.length === 4
      ? `${parts.slice(0, 3).join('.')}.x`
      : 'IP desconhecido';
  }
}
