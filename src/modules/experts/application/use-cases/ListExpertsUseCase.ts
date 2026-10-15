import { Inject, Injectable } from '@nestjs/common';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../domain/repositories/ExpertsRepository';
import { requireTenant } from '../ExpertAuthorization';

@Injectable()
export class ListExpertsUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
  ) {}

  execute(auth: AccessTokenClaims) {
    return this.experts.findByTenantId(requireTenant(auth));
  }
}
