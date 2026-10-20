import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import type { Launch, UpdateLaunchProps } from '../../domain/entities/Launch';
import { LAUNCHES_REPOSITORY } from '../../domain/repositories/LaunchesRepository';
import type { LaunchesRepository } from '../../domain/repositories/LaunchesRepository';
import { requireLaunchAdmin } from '../LaunchAuthorization';
import { validateLaunchDateRange } from '../validateLaunchDateRange';

export type UpdateLaunchInput = UpdateLaunchProps;

@Injectable()
export class UpdateLaunchUseCase {
  constructor(
    @Inject(LAUNCHES_REPOSITORY) private readonly launches: LaunchesRepository,
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
  ) {}

  async execute(
    id: string,
    input: UpdateLaunchInput,
    auth: AccessTokenClaims,
  ): Promise<Launch> {
    const tenantId = requireLaunchAdmin(auth);
    const launch = await this.launches.findByTenantIdAndId(tenantId, id);
    if (!launch) throw DomainError.launchNotFound();

    if (
      input.expertId !== undefined &&
      input.expertId !== launch.expertId &&
      !(await this.experts.findByTenantIdAndId(tenantId, input.expertId))
    ) {
      throw DomainError.expertNotFound();
    }

    validateLaunchDateRange(
      input.startsAt === null ? undefined : (input.startsAt ?? launch.startsAt),
      input.endsAt === null ? undefined : (input.endsAt ?? launch.endsAt),
    );
    launch.update(input, auth.userId);
    return this.launches.save(launch);
  }
}
