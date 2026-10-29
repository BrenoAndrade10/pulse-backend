import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER } from '../../../../shared/domain/PasswordHasher';
import type { PasswordHasher } from '../../../../shared/domain/PasswordHasher';
import { EMAIL_SENDER } from '../../../../shared/domain/EmailSender';
import type { EmailSender } from '../../../../shared/domain/EmailSender';
import { DomainError } from '../../../../shared/errors/DomainError';
import { UserStatus } from '../../../users/domain/enums/UserStatus';
import { TrustedDevicesService } from '../../../two-factor/application/services/TrustedDevicesService';
import { TWO_FACTOR_REPOSITORY } from '../../../two-factor/domain/repositories/TwoFactorRepository';
import type { TwoFactorRepository } from '../../../two-factor/domain/repositories/TwoFactorRepository';
import { AuthChallengeStore } from '../../../two-factor/infra/redis/AuthChallengeStore';
import { AUTH_ACCOUNTS_REPOSITORY } from '../../domain/repositories/AuthAccountsRepository';
import type { AuthAccountsRepository } from '../../domain/repositories/AuthAccountsRepository';
import type { AuthMembership } from '../../domain/types/AuthMembership';
import type { AuthResult } from '../AuthProfile';
import { SessionIssuer } from '../services/SessionIssuer';
import { EmailLoginCodes } from '../services/EmailLoginCodes';
import { EmailTemplateRenderer } from '../services/EmailTemplateRenderer';

export type LoginUseCaseInput = {
  email: string;
  password: string;
  tenantId?: string;
  rememberMe: boolean;
  ip: string | null;
  userAgent: string | null;
  trustedDeviceToken?: string | null;
};

export type LoginChallengeResult = {
  status: 'two_factor_required';
  next: 'email' | 'totp';
  challengeToken: string;
  expiresAt: string;
  emailHint?: string;
};

@Injectable()
export class LoginUseCase {
  private static readonly DUMMY_PASSWORD_HASH =
    '$argon2id$v=19$m=65536,p=4,t=3$Wt5NxPbPVlIN0P/3/1qCIw$DhIBkm97I5t4eHx77lhBDoeqRziz+WwvUqmDR2QasPo';

  constructor(
    @Inject(AUTH_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: AuthAccountsRepository,

    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(TWO_FACTOR_REPOSITORY)
    private readonly twoFactor: TwoFactorRepository,
    private readonly trustedDevices: TrustedDevicesService,
    private readonly challenges: AuthChallengeStore,
    private readonly sessionIssuer: SessionIssuer,
    private readonly emailCodes: EmailLoginCodes,
    private readonly emailTemplates: EmailTemplateRenderer,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
  ) {}

  async execute(
    input: LoginUseCaseInput,
  ): Promise<AuthResult | LoginChallengeResult> {
    const user = await this.accountsRepository.findUserByEmail(input.email);

    const passwordMatches = await this.passwordHasher.verify(
      user?.passwordHash ?? LoginUseCase.DUMMY_PASSWORD_HASH,
      input.password,
    );

    if (!user || !passwordMatches || user.status !== UserStatus.ACTIVE) {
      throw new DomainError(401, 'INVALID_CREDENTIALS');
    }

    const memberships = await this.accountsRepository.findMembershipsByUserId(
      user.id,
    );
    const activeMembership = this.resolveActiveMembership(
      memberships,
      input.tenantId,
    );

    if (
      await this.trustedDevices.validate(
        user.id,
        input.trustedDeviceToken ?? null,
      )
    ) {
      return this.sessionIssuer.issue({
        userId: user.id,
        tenantId: activeMembership?.tenantId ?? null,
        rememberMe: input.rememberMe,
        ip: input.ip,
        userAgent: input.userAgent,
      });
    }

    const state = await this.twoFactor.findByUserId(user.id);
    if (state?.confirmedAt) {
      const challenge = await this.challenges.create({
        userId: user.id,
        tenantId: activeMembership?.tenantId ?? null,
        remember: input.rememberMe,
        next: 'totp',
      });

      return { status: 'two_factor_required', next: 'totp', ...challenge };
    }

    const code = this.emailCodes.generate();
    const challenge = await this.challenges.create({
      userId: user.id,
      tenantId: activeMembership?.tenantId ?? null,
      remember: input.rememberMe,
      next: 'email',
      emailCodeHash: this.emailCodes.hash(user.id, code),
      emailLastSentAt: Date.now(),
      emailResendCount: 0,
    });

    try {
      await this.sendLoginCode(user.email, code, input.userAgent, input.ip);
    } catch {
      await this.challenges
        .discard(challenge.challengeToken)
        .catch(() => undefined);
      throw new DomainError(503, 'EMAIL_SEND_FAILED');
    }

    return {
      status: 'two_factor_required',
      next: 'email',
      emailHint: this.emailCodes.maskEmail(user.email),
      ...challenge,
    };
  }

  private resolveActiveMembership(
    memberships: AuthMembership[],
    tenantId?: string,
  ): AuthMembership | null {
    if (!tenantId) {
      return memberships[0] ?? null;
    }

    const membership = memberships.find(
      (currentMembership) => currentMembership.tenantId === tenantId,
    );

    if (!membership) {
      throw new DomainError(403, 'TENANT_ACCESS_DENIED');
    }

    return membership;
  }

  private sendLoginCode(
    email: string,
    code: string,
    userAgent: string | null,
    ip: string | null,
  ): Promise<void> {
    const rendered = this.emailTemplates.render('login-code', {
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
