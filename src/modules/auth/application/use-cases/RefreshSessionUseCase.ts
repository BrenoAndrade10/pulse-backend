import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { UserStatus } from '../../../users/domain/enums/UserStatus';
import { Session } from '../../domain/entities/Session';
import { AUTH_ACCOUNTS_REPOSITORY } from '../../domain/repositories/AuthAccountsRepository';
import type { AuthAccountsRepository } from '../../domain/repositories/AuthAccountsRepository';
import { SESSIONS_REPOSITORY } from '../../domain/repositories/SessionsRepository';
import type { SessionsRepository } from '../../domain/repositories/SessionsRepository';
import { ACCESS_TOKEN_SERVICE } from '../../domain/services/AccessTokenService';
import type { AccessTokenService } from '../../domain/services/AccessTokenService';
import { AUTH_SETTINGS } from '../AuthSettings';
import type { AuthSettings } from '../AuthSettings';
import { buildAuthProfile } from '../AuthProfile';
import type { AuthResult } from '../AuthProfile';
import { RefreshTokenCodec } from '../services/RefreshTokenCodec';

export type RefreshSessionUseCaseInput = {
  refreshToken: string | undefined;
};

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(AUTH_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: AuthAccountsRepository,

    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: SessionsRepository,

    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokenService: AccessTokenService,

    @Inject(AUTH_SETTINGS)
    private readonly settings: AuthSettings,
  ) {}

  async execute(input: RefreshSessionUseCaseInput): Promise<AuthResult> {
    const parsedToken = RefreshTokenCodec.parse(input.refreshToken);

    if (!parsedToken) {
      throw new DomainError(401, 'INVALID_REFRESH_TOKEN');
    }

    let session = await this.findActiveSession(parsedToken.sessionId);
    const now = new Date();
    const presentedHash = RefreshTokenCodec.hashSecret(parsedToken.secret);

    if (
      RefreshTokenCodec.hashesMatch(presentedHash, session.refreshTokenHash)
    ) {
      const nextRefreshToken = RefreshTokenCodec.generate(session.id);
      const rotated = await this.sessionsRepository.rotateRefreshToken({
        sessionId: session.id,
        currentRefreshTokenHash: presentedHash,
        nextRefreshTokenHash: nextRefreshToken.hash,
        rotatedAt: now,
        ttlSeconds: session.remainingTtlSeconds(
          now,
          this.settings.refreshTokenIdleTtlSeconds,
        ),
      });

      if (rotated) {
        return this.issueTokens(session, nextRefreshToken.token);
      }

      // Outra requisição rotacionou no meio do caminho: relê a sessão e
      // segue para a checagem da janela de tolerância.
      session = await this.findActiveSession(session.id);
    }

    // Duas abas renovando ao mesmo tempo: o token anterior ainda vale por
    // alguns segundos, mas só gera um access token novo (sem nova rotação).
    if (
      RefreshTokenCodec.hashesMatch(
        presentedHash,
        session.previousRefreshTokenHash,
      ) &&
      session.wasRotatedWithin(
        now,
        this.settings.refreshTokenGracePeriodSeconds,
      )
    ) {
      return this.issueTokens(session, null);
    }

    // Token já usado fora da janela: sinal de roubo. Revoga a sessão inteira.
    await this.sessionsRepository.delete(session);

    throw new DomainError(401, 'REFRESH_TOKEN_REUSED');
  }

  private async findActiveSession(sessionId: string): Promise<Session> {
    const session = await this.sessionsRepository.findById(sessionId);

    if (!session) {
      throw new DomainError(401, 'INVALID_REFRESH_TOKEN');
    }

    if (session.isExpired(new Date())) {
      await this.sessionsRepository.delete(session);

      throw new DomainError(401, 'SESSION_EXPIRED');
    }

    return session;
  }

  /**
   * Relê usuário e vínculos a cada refresh: usuário desativado ou removido do
   * tenant perde a sessão, e mudanças de papel entram no próximo access token.
   */
  private async issueTokens(
    session: Session,
    refreshToken: string | null,
  ): Promise<AuthResult> {
    const user = await this.accountsRepository.findUserById(session.userId);

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.sessionsRepository.delete(session);

      throw new DomainError(401, 'INVALID_REFRESH_TOKEN');
    }

    const memberships = await this.accountsRepository.findMembershipsByUserId(
      user.id,
    );
    const activeMembership = session.tenantId
      ? memberships.find(
          (membership) => membership.tenantId === session.tenantId,
        )
      : null;

    if (session.tenantId && !activeMembership) {
      await this.sessionsRepository.delete(session);

      throw new DomainError(401, 'TENANT_ACCESS_REVOKED');
    }

    const accessToken = await this.accessTokenService.sign({
      userId: user.id,
      sessionId: session.id,
      tenantId: session.tenantId,
      role: activeMembership?.role ?? null,
    });

    return {
      accessToken,
      accessTokenExpiresIn: this.settings.accessTokenTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
      rememberMe: session.rememberMe,
      profile: buildAuthProfile(user, memberships, session.tenantId),
    };
  }
}
