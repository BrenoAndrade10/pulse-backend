import type { IntegrationAccount } from '../entities/IntegrationAccount';
import type { IntegrationAccountType } from '../enums/IntegrationAccountType';
import type { IntegrationProvider } from '../enums/IntegrationProvider';

export const INTEGRATION_ACCOUNTS_REPOSITORY = Symbol(
  'INTEGRATION_ACCOUNTS_REPOSITORY',
);

/** Leitura das contas conectadas. A escrita acontece junto com a credencial. */
export interface IntegrationAccountsRepository {
  findConnectedByExpert(
    tenantId: string,
    expertId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationAccount[]>;
  findConnectedByTenant(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationAccount[]>;
  /**
   * Contas conectadas com este id externo, em qualquer empresa. Só para
   * eventos do provedor (webhooks), que chegam sem empresa.
   */
  findConnectedByExternalId(
    provider: IntegrationProvider,
    type: IntegrationAccountType,
    externalId: string,
  ): Promise<IntegrationAccount[]>;
}

export interface WhatsAppIntegrationAccountsRepository extends IntegrationAccountsRepository {
  existsConnectedWhatsAppWaba(
    wabaId: string,
    excludeExpertId?: string,
  ): Promise<boolean>;
}
