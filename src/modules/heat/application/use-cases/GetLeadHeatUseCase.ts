import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { requireExpertTenant } from '../../../leads/application/requireExpertTenant';
import { LeadHeatCalculator } from '../services/LeadHeatCalculator';
import type { LeadHeatCalculation } from '../services/LeadHeatCalculator';

export { todayInTimezone } from '../services/LeadHeatCalculator';

export type GetLeadHeatInput = { expertId: string; leadId: string };

export type GetLeadHeatOutput = LeadHeatCalculation;

@Injectable()
export class GetLeadHeatUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,

    private readonly calculator: LeadHeatCalculator,
  ) {}

  async execute(
    input: GetLeadHeatInput,
    auth: AccessTokenClaims,
  ): Promise<GetLeadHeatOutput> {
    const tenantId = await requireExpertTenant(
      this.experts,
      input.expertId,
      auth,
    );
    const result = await this.calculator.calculate({
      tenantId,
      expertId: input.expertId,
      leadId: input.leadId,
    });
    if (!result) throw DomainError.leadNotFound();
    return result;
  }
}
