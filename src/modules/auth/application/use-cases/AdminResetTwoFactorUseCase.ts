import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { UserRole } from '../../../users/domain/enums/UserRole';
import { TWO_FACTOR_REPOSITORY } from '../../../two-factor/domain/repositories/TwoFactorRepository';
import type { TwoFactorRepository } from '../../../two-factor/domain/repositories/TwoFactorRepository';
import { AUTH_ACCOUNTS_REPOSITORY } from '../../domain/repositories/AuthAccountsRepository';
import type { AuthAccountsRepository } from '../../domain/repositories/AuthAccountsRepository';
import type { AccessTokenClaims } from '../../domain/types/AccessTokenClaims';
import { LogoutAllSessionsUseCase } from './LogoutAllSessionsUseCase';

@Injectable()
export class AdminResetTwoFactorUseCase {
  private readonly logger = new Logger(AdminResetTwoFactorUseCase.name);

  constructor(
    @Inject(AUTH_ACCOUNTS_REPOSITORY)
    private readonly accounts: AuthAccountsRepository,
    @Inject(TWO_FACTOR_REPOSITORY)
    private readonly twoFactor: TwoFactorRepository,
    private readonly logoutAll: LogoutAllSessionsUseCase,
  ) {}

  async execute(auth: AccessTokenClaims, userId: string): Promise<void> {
    if (
      auth.role !== UserRole.ADMIN ||
      !auth.tenantId ||
      auth.userId === userId
    ) {
      throw new DomainError(403, 'FORBIDDEN');
    }
    const memberships = await this.accounts.findMembershipsByUserId(userId);
    if (
      memberships.length !== 1 ||
      memberships[0]?.tenantId !== auth.tenantId
    ) {
      throw new DomainError(403, 'TWO_FACTOR_RESET_FORBIDDEN');
    }
    await this.revokeSessions(userId);
    await this.twoFactor.deleteAllForUser(userId);
    this.logger.log({
      event: 'two_factor.reset_by_admin',
      adminId: auth.userId,
      userId,
    });
  }

  private async revokeSessions(userId: string): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.logoutAll.execute(userId);
        return;
      } catch {
        if (attempt === 3) {
          this.logger.error({
            event: 'two_factor.admin_reset_revocation_failed',
            userId,
          });
          throw new DomainError(503, 'SERVICE_UNAVAILABLE');
        }
      }
    }
  }
}
