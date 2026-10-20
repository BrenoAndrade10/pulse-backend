import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { requireTenant } from '../../../experts/application/ExpertAuthorization';
import type { Launch } from '../../domain/entities/Launch';
import { LAUNCHES_REPOSITORY } from '../../domain/repositories/LaunchesRepository';
import type { LaunchesRepository } from '../../domain/repositories/LaunchesRepository';

@Injectable()
export class GetLaunchUseCase {
  constructor(
    @Inject(LAUNCHES_REPOSITORY) private readonly launches: LaunchesRepository,
  ) {}

  async execute(
    id: string,
    auth: AccessTokenClaims,
    expertId?: string,
  ): Promise<Launch> {
    const launch = await this.launches.findByTenantIdAndId(
      requireTenant(auth),
      id,
    );
    if (!launch || (expertId !== undefined && launch.expertId !== expertId)) {
      throw DomainError.launchNotFound();
    }
    return launch;
  }
}
