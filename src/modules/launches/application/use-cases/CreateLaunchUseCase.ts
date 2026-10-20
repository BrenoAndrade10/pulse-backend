import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { Launch } from '../../domain/entities/Launch';
import { LaunchStatus } from '../../domain/enums/LaunchStatus';
import { LaunchType } from '../../domain/enums/LaunchType';
import { LAUNCHES_REPOSITORY } from '../../domain/repositories/LaunchesRepository';
import type { LaunchesRepository } from '../../domain/repositories/LaunchesRepository';
import { requireLaunchAdmin } from '../LaunchAuthorization';
import { validateLaunchDateRange } from '../validateLaunchDateRange';

export type CreateLaunchInput = {
  expertId: string;
  slug: string;
  type?: LaunchType;
  name: string;
  description?: string;
  status?: LaunchStatus;
  startsAt?: Date;
  endsAt?: Date;
  timezone?: string;
};

@Injectable()
export class CreateLaunchUseCase {
  constructor(
    @Inject(LAUNCHES_REPOSITORY) private readonly launches: LaunchesRepository,
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: CreateLaunchInput,
    auth: AccessTokenClaims,
  ): Promise<Launch> {
    const tenantId = requireLaunchAdmin(auth);
    const expert = await this.experts.findByTenantIdAndId(
      tenantId,
      input.expertId,
    );

    if (!expert) {
      throw DomainError.expertNotFound();
    }

    validateLaunchDateRange(input.startsAt, input.endsAt);

    const now = new Date();
    return this.launches.create(
      new Launch({
        id: this.ids.generate(),
        tenantId,
        expertId: input.expertId,
        slug: input.slug,
        type: input.type ?? LaunchType.OTHER,
        name: input.name,
        description: input.description,
        status: input.status ?? LaunchStatus.DRAFT,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: input.timezone ?? 'UTC',
        deletedAt: null,
        createdBy: auth.userId,
        updatedBy: auth.userId,
        deletedBy: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
}
