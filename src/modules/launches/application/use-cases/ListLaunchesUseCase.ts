import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { requireTenant } from '../../../experts/application/ExpertAuthorization';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { LAUNCHES_REPOSITORY } from '../../domain/repositories/LaunchesRepository';
import type { LaunchesRepository } from '../../domain/repositories/LaunchesRepository';

@Injectable()
export class ListLaunchesUseCase {
  constructor(
    @Inject(LAUNCHES_REPOSITORY) private readonly launches: LaunchesRepository,
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
  ) {}

  async execute(expertId: string, auth: AccessTokenClaims) {
    const tenantId = requireTenant(auth);
    if (!(await this.experts.findByTenantIdAndId(tenantId, expertId))) {
      throw DomainError.expertNotFound();
    }
    return this.launches.findByTenantIdAndExpertId(tenantId, expertId);
  }
}
