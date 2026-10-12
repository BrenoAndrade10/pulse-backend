import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { UserStatus } from '../../../users/domain/enums/UserStatus';
import { AUTH_ACCOUNTS_REPOSITORY } from '../../domain/repositories/AuthAccountsRepository';
import type { AuthAccountsRepository } from '../../domain/repositories/AuthAccountsRepository';
import { buildAuthProfile } from '../AuthProfile';
import type { AuthProfile } from '../AuthProfile';

export type GetAuthProfileUseCaseInput = {
  userId: string;
  tenantId: string | null;
};

@Injectable()
export class GetAuthProfileUseCase {
  constructor(
    @Inject(AUTH_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: AuthAccountsRepository,
  ) {}

  async execute(input: GetAuthProfileUseCaseInput): Promise<AuthProfile> {
    const user = await this.accountsRepository.findUserById(input.userId);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new DomainError(401, 'UNAUTHENTICATED');
    }

    const memberships = await this.accountsRepository.findMembershipsByUserId(
      user.id,
    );

    return buildAuthProfile(user, memberships, input.tenantId);
  }
}
