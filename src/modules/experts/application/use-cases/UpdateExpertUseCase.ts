import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import type { Expert } from '../../domain/entities/Expert';
import { ExpertStatus } from '../../domain/enums/ExpertStatus';
import { EXPERTS_REPOSITORY } from '../../domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../domain/repositories/ExpertsRepository';
import { requireTenantAdmin } from '../ExpertAuthorization';

export type UpdateExpertInput = {
  name?: string;
  commercialName?: string | null;
  email?: string;
  status?: ExpertStatus;
};

@Injectable()
export class UpdateExpertUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
  ) {}

  async execute(
    id: string,
    input: UpdateExpertInput,
    auth: AccessTokenClaims,
  ): Promise<Expert> {
    const tenantId = requireTenantAdmin(auth);
    const expert = await this.experts.findByTenantIdAndId(tenantId, id);
    if (!expert) throw DomainError.expertNotFound();

    if (input.email && input.email !== expert.email) {
      const owner = await this.experts.findByTenantIdAndEmail(
        tenantId,
        input.email,
      );
      if (owner && owner.id !== id) {
        throw new DomainError(409, 'EXPERT_EMAIL_ALREADY_EXISTS');
      }
    }

    expert.update(input);
    return this.experts.save(expert);
  }
}
