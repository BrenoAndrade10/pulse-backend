import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
import { INTEGRATION_CREDENTIALS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { IntegrationCredentialsRepository } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';

export type RevokeInstagramConnectionInput = {
  tenantId: string | null;
  expertId: string;
};

/**
 * Desconecta o Instagram do expert apagando o token do nosso banco e
 * marcando a conta como desconectada. O Login
 * do Instagram não tem endpoint de revogação: o acesso na Meta acaba quando o
 * token expira ou quando o usuário remove o app nas configurações dele.
 */
@Injectable()
export class RevokeInstagramConnectionUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly expertsRepository: ExpertsRepository,

    @Inject(INTEGRATION_CREDENTIALS_REPOSITORY)
    private readonly credentialsRepository: IntegrationCredentialsRepository,
  ) {}

  async execute(input: RevokeInstagramConnectionInput): Promise<void> {
    if (!input.tenantId) throw new DomainError(403, 'TENANT_REQUIRED');

    const expert = await this.expertsRepository.findByTenantIdAndId(
      input.tenantId,
      input.expertId,
    );
    if (!expert) throw DomainError.expertNotFound();

    // Idempotente: desconectar quem já está desconectado não é erro.
    await this.credentialsRepository.revokeActive(
      input.tenantId,
      input.expertId,
      IntegrationProvider.INSTAGRAM,
      new Date(),
    );
  }
}
