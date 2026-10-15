import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../domain/repositories/ExpertsRepository';
import { requireTenantAdmin } from '../ExpertAuthorization';

@Injectable()
export class DeleteExpertUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
  ) {}

  async execute(id: string, auth: AccessTokenClaims): Promise<void> {
    const deleted = await this.experts.deleteByTenantIdAndId(
      requireTenantAdmin(auth),
      id,
    );
    if (!deleted) throw DomainError.expertNotFound();
  }
}
