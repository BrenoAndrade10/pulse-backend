import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { PASSWORD_HASHER } from '../../../../shared/domain/PasswordHasher';
import type { PasswordHasher } from '../../../../shared/domain/PasswordHasher';
import { DomainError } from '../../../../shared/errors/DomainError';
import { UserStatus } from '../../../users/domain/enums/UserStatus';
import { Session } from '../../domain/entities/Session';
import { AUTH_ACCOUNTS_REPOSITORY } from '../../domain/repositories/AuthAccountsRepository';
import type { AuthAccountsRepository } from '../../domain/repositories/AuthAccountsRepository';
import { SESSIONS_REPOSITORY } from '../../domain/repositories/SessionsRepository';
import type { SessionsRepository } from '../../domain/repositories/SessionsRepository';
import { ACCESS_TOKEN_SERVICE } from '../../domain/services/AccessTokenService';
import type { AccessTokenService } from '../../domain/services/AccessTokenService';
import type { AuthMembership } from '../../domain/types/AuthMembership';
import { AUTH_SETTINGS } from '../AuthSettings';
import type { AuthSettings } from '../AuthSettings';
import { buildAuthProfile } from '../AuthProfile';
import type { AuthResult } from '../AuthProfile';
import { RefreshTokenCodec } from '../services/RefreshTokenCodec';

export type LoginUseCaseInput = {
  email: string;
  password: string;
  tenantId?: string;
  rememberMe: boolean;
  ip: string | null;
  userAgent: string | null;
};

@Injectable()
export class LoginUseCase {
  private dummyPasswordHash?: Promise<string>;

  constructor(
    @Inject(AUTH_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: AuthAccountsRepository,

    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: SessionsRepository,

    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokenService: AccessTokenService,

    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,

    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,

    @Inject(AUTH_SETTINGS)
    private readonly settings: AuthSettings,
  ) {}

  async execute(input: LoginUseCaseInput): Promise<AuthResult> {
    const user = await this.accountsRepository.findUserByEmail(input.email);

    const passwordMatches = await this.passwordHasher.verify(
      user?.passwordHash ?? (await this.getDummyPasswordHash()),
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

    const now = new Date();
    const sessionId = this.idGenerator.generate();
    const refreshToken = RefreshTokenCodec.generate(sessionId);
    const session = new Session({
      id: sessionId,
      userId: user.id,
      tenantId: activeMembership?.tenantId ?? null,
      refreshTokenHash: refreshToken.hash,
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

    await this.sessionsRepository.create(
      session,
      session.remainingTtlSeconds(
        now,
        this.settings.refreshTokenIdleTtlSeconds,
      ),
    );
    await this.accountsRepository.updateLastLoginAt(user.id, now);

    const accessToken = await this.accessTokenService.sign({
      userId: user.id,
      sessionId,
      tenantId: activeMembership?.tenantId ?? null,
      role: activeMembership?.role ?? null,
    });

    return {
      accessToken,
      accessTokenExpiresIn: this.settings.accessTokenTtlSeconds,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt: session.expiresAt,
      rememberMe: session.rememberMe,
      profile: buildAuthProfile(user, memberships, session.tenantId),
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

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= this.passwordHasher.hash(
      randomBytes(32).toString('hex'),
    );

    return this.dummyPasswordHash;
  }
}
