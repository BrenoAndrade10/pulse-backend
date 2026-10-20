import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { IntegrationAccountType } from '../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
import { INTEGRATION_ACCOUNTS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { IntegrationAccountsRepository } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import { INTEGRATION_CREDENTIALS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { IntegrationCredentialsRepository } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';

export type ListInstagramConnectionsInput = {
  tenantId: string | null;
};

export type InstagramConnectionOutput = {
  expertId: string;
  status: 'connected' | 'expired';
  username: string | null;
  connectedAt: Date;
  expiresAt: Date | null;
};

/**
 * Lista as contas do Instagram conectadas na empresa, sem chamar a Meta e sem
 * carregar tokens. Experts fora da lista não têm conta conectada.
 */
@Injectable()
export class ListInstagramConnectionsUseCase {
  constructor(
    @Inject(INTEGRATION_CREDENTIALS_REPOSITORY)
    private readonly credentialsRepository: IntegrationCredentialsRepository,

    @Inject(INTEGRATION_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: IntegrationAccountsRepository,
  ) {}

  async execute(
    input: ListInstagramConnectionsInput,
  ): Promise<InstagramConnectionOutput[]> {
    if (!input.tenantId) throw new DomainError(403, 'TENANT_REQUIRED');

    const [credentials, accounts] = await Promise.all([
      this.credentialsRepository.findActiveByTenantId(
        input.tenantId,
        IntegrationProvider.INSTAGRAM,
      ),
      this.accountsRepository.findConnectedByTenant(
        input.tenantId,
        IntegrationProvider.INSTAGRAM,
      ),
    ]);
    const credentialsById = new Map(
      credentials.map((credential) => [credential.id, credential]),
    );
    const now = new Date();

    return accounts.flatMap((account) => {
      const credential = credentialsById.get(account.credentialId);

      if (
        !credential ||
        account.type !== IntegrationAccountType.INSTAGRAM_ACCOUNT
      ) {
        return [];
      }

      return [
        {
          expertId: account.expertId,
          status: credential.isExpired(now) ? 'expired' : 'connected',
          username: account.displayName ?? null,
          connectedAt: account.connectedAt,
          expiresAt: credential.tokenExpiresAt ?? null,
        },
      ];
    });
  }
}
