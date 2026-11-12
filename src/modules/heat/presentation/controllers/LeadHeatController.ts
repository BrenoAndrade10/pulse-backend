import { Controller, Get, Param } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import { GetLeadHeatUseCase } from '../../application/use-cases/GetLeadHeatUseCase';

@Controller('experts/:expertId/leads/:leadId/heat')
export class LeadHeatController {
  constructor(private readonly getLeadHeat: GetLeadHeatUseCase) {}

  @Get()
  async get(
    @Param('expertId') expertId: string,
    @Param('leadId') leadId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateId(expertId);
    this.validateId(leadId);
    return this.getLeadHeat.execute({ expertId, leadId }, auth);
  }

  private validateId(id: string): void {
    if (!isUuidV7(id)) {
      throw DomainError.validationFailed({ errors: ['Informe um id válido.'] });
    }
  }
}
