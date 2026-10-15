import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { Expert } from '../../domain/entities/Expert';
import { ExpertStatus } from '../../domain/enums/ExpertStatus';
import { EXPERTS_REPOSITORY } from '../../domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../domain/repositories/ExpertsRepository';
import { requireTenantAdmin } from '../ExpertAuthorization';

export type CreateExpertInput = {
  name: string;
  commercialName?: string;
  email: string;
};

@Injectable()
export class CreateExpertUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: CreateExpertInput,
    auth: AccessTokenClaims,
  ): Promise<Expert> {
    const tenantId = requireTenantAdmin(auth);
    if (await this.experts.findByTenantIdAndEmail(tenantId, input.email)) {
      throw new DomainError(409, 'EXPERT_EMAIL_ALREADY_EXISTS');
    }
    const now = new Date();
    return this.experts.create(
      new Expert({
        id: this.ids.generate(),
        tenantId,
        name: input.name,
        commercialName: input.commercialName,
        email: input.email,
        status: ExpertStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
}
