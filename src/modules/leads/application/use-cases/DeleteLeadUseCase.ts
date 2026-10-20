import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { LEADS_REPOSITORY } from '../../domain/repositories/LeadsRepository';
import type { LeadsRepository } from '../../domain/repositories/LeadsRepository';
import { requireExpertTenant } from '../requireExpertTenant';

/**
 * Apaga o lead com os cadastros e as inscrições (pedido de exclusão do
 * titular, LGPD art. 18). Os eventos no ClickHouse guardam só o id do lead,
 * que deixa de apontar para alguém. Idempotente.
 */
@Injectable()
export class DeleteLeadUseCase {
  private readonly logger = new Logger(DeleteLeadUseCase.name);

  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,

    @Inject(LEADS_REPOSITORY)
    private readonly leads: LeadsRepository,
  ) {}

  async execute(
    input: { expertId: string; leadId: string },
    auth: AccessTokenClaims,
  ): Promise<void> {
    const tenantId = await requireExpertTenant(
      this.experts,
      input.expertId,
      auth,
    );
    const deleted = await this.leads.delete(
      tenantId,
      input.expertId,
      input.leadId,
    );

    if (deleted) {
      this.logger.log(
        `Lead ${input.leadId} excluído (empresa ${tenantId}, expert ${input.expertId}, usuário ${auth.userId}).`,
      );
    }
  }
}
