import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
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
import { RefreshTokenCodec } from './RefreshTokenCodec';

export type IssueSessionInput = {
  userId: string;
  tenantId: string | null;
  rememberMe: boolean;
  ip: string | null;
  userAgent: string | null;
};

@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(AUTH_ACCOUNTS_REPOSITORY)
    private readonly accounts: AuthAccountsRepository,
    @Inject(SESSIONS_REPOSITORY)
    private readonly sessions: SessionsRepository,
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokens: AccessTokenService,
    @Inject(ID_GENERATOR)
    private readonly ids: IdGenerator,
    @Inject(AUTH_SETTINGS)
    private readonly settings: AuthSettings,
  ) {}

  async issue(input: IssueSessionInput): Promise<AuthResult> {
    const user = await this.accounts.findUserById(input.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new DomainError(401, 'UNAUTHENTICATED');
    }
    const memberships = await this.accounts.findMembershipsByUserId(user.id);
    const membership = input.tenantId
      ? memberships.find((item) => item.tenantId === input.tenantId)
      : (memberships[0] ?? null);
    if (input.tenantId && !membership) {
      throw new DomainError(403, 'TENANT_ACCESS_DENIED');
    }

    const now = new Date();
    const id = this.ids.generate();
    const refresh = RefreshTokenCodec.generate(id);
    const session = new Session({
      id,
      userId: user.id,
      tenantId: membership?.tenantId ?? null,
      refreshTokenHash: refresh.hash,
      previousRefreshTokenHash: null,
      rotatedAt: null,
      ip: input.ip,
      userAgent: input.userAgent,
      rememberMe: input.rememberMe,
      createdAt: now,
      expiresAt: new Date(
        now.getTime() + this.settings.sessionAbsoluteTtlSeconds * 1000,
      ),
    });
    await this.sessions.create(
      session,
      session.remainingTtlSeconds(
        now,
        this.settings.refreshTokenIdleTtlSeconds,
      ),
    );
    await this.accounts.updateLastLoginAt(user.id, now);
    const accessToken = await this.accessTokens.sign({
      userId: user.id,
      sessionId: id,
      tenantId: session.tenantId,
      role: membership?.role ?? null,
    });
    return {
      accessToken,
      accessTokenExpiresIn: this.settings.accessTokenTtlSeconds,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: session.expiresAt,
      rememberMe: session.rememberMe,
      profile: buildAuthProfile(user, memberships, session.tenantId),
    };
  }
}
