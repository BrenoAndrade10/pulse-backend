import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { EMAIL_SENDER } from '../../../../shared/domain/EmailSender';
import type { EmailSender } from '../../../../shared/domain/EmailSender';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { RateLimiter } from '../../../../shared/infra/redis/RateLimiter';
import { UserStatus } from '../../../users/domain/enums/UserStatus';
import { AUTH_ACCOUNTS_REPOSITORY } from '../../domain/repositories/AuthAccountsRepository';
import type { AuthAccountsRepository } from '../../domain/repositories/AuthAccountsRepository';
import { PASSWORD_RESET_TOKENS_REPOSITORY } from '../../domain/repositories/PasswordResetTokensRepository';
import type { PasswordResetTokensRepository } from '../../domain/repositories/PasswordResetTokensRepository';
import { EmailTemplateRenderer } from '../services/EmailTemplateRenderer';

const TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    @Inject(AUTH_ACCOUNTS_REPOSITORY)
    private readonly accounts: AuthAccountsRepository,
    @Inject(PASSWORD_RESET_TOKENS_REPOSITORY)
    private readonly tokens: PasswordResetTokensRepository,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
    @Inject(ID_GENERATOR)
    private readonly ids: IdGenerator,
    private readonly renderer: EmailTemplateRenderer,
    private readonly rateLimiter: RateLimiter,
  ) {}

  async execute(email: string): Promise<void> {
    const emailLimit = await this.rateLimiter.consume(
      `auth:forgot:email:${this.hash(email)}`,
      3,
      3600,
    );
    if (!emailLimit.allowed) return;

    void this.process(email).catch(() => {
      this.logger.error('Falha ao processar recuperação de senha');
    });
  }

  private async process(email: string): Promise<void> {
    const user = await this.accounts.findUserByEmail(email);
    if (!user || user.status !== UserStatus.ACTIVE) return;

    const rawToken = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.tokens.replaceForUser({
      id: this.ids.generate(),
      userId: user.id,
      tokenHash: this.hash(rawToken),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      createdAt: now,
    });
    const resetUrl = new URL('/redefinir-senha', Environment.vars.FRONTEND_URL);
    resetUrl.hash = `token=${rawToken}`;
    const rendered = this.renderer.render('password-reset', {
      title: 'Redefina sua senha',
      resetUrl: resetUrl.toString(),
    });
    await this.emailSender.send({
      to: user.email,
      subject: 'Redefina sua senha — Pulse Lead',
      ...rendered,
    });
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
