import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EMAIL_SENDER } from '../../../../shared/domain/EmailSender';
import type { EmailSender } from '../../../../shared/domain/EmailSender';
import { PASSWORD_HASHER } from '../../../../shared/domain/PasswordHasher';
import type { PasswordHasher } from '../../../../shared/domain/PasswordHasher';
import { DomainError } from '../../../../shared/errors/DomainError';
import { PASSWORD_RESET_TOKENS_REPOSITORY } from '../../domain/repositories/PasswordResetTokensRepository';
import type { PasswordResetTokensRepository } from '../../domain/repositories/PasswordResetTokensRepository';
import { EmailTemplateRenderer } from '../services/EmailTemplateRenderer';
import { LogoutAllSessionsUseCase } from './LogoutAllSessionsUseCase';

@Injectable()
export class ResetPasswordUseCase {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    @Inject(PASSWORD_RESET_TOKENS_REPOSITORY)
    private readonly tokens: PasswordResetTokensRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
    private readonly renderer: EmailTemplateRenderer,
    private readonly logoutAll: LogoutAllSessionsUseCase,
  ) {}

  async execute(token: string, password: string): Promise<void> {
    const now = new Date();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const validToken = await this.tokens.findValid(tokenHash);
    if (!validToken) {
      throw new DomainError(400, 'PASSWORD_RESET_TOKEN_INVALID');
    }

    await this.revokeSessions(validToken.userId);
    const passwordHash = await this.passwordHasher.hash(password);
    const consumed = await this.tokens.consumeAndUpdatePassword(
      tokenHash,
      passwordHash,
      now,
    );
    if (!consumed) {
      throw new DomainError(400, 'PASSWORD_RESET_TOKEN_INVALID');
    }

    const rendered = this.renderer.render('password-changed', {
      title: 'Senha alterada',
      firstName: consumed.firstName,
      changedAt: now.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      }),
    });
    await this.emailSender
      .send({
        to: consumed.email,
        subject: 'Sua senha foi alterada — Pulse Lead',
        ...rendered,
      })
      .catch(() => {
        this.logger.warn('Falha ao enviar confirmação de senha');
      });
  }

  private async revokeSessions(userId: string): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.logoutAll.execute(userId);
        return;
      } catch {
        if (attempt === 3) {
          this.logger.error(
            `Falha ao revogar sessões antes da alteração de senha: userId=${userId}`,
          );
          throw new DomainError(503, 'SERVICE_UNAVAILABLE');
        }
      }
    }
  }
}
