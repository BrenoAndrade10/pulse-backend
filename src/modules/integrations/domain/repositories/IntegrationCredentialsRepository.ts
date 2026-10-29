import type { IntegrationAccount } from '../entities/IntegrationAccount';
import type { IntegrationCredential } from '../entities/IntegrationCredential';
import type { IntegrationProvider } from '../enums/IntegrationProvider';

export const INTEGRATION_CREDENTIALS_REPOSITORY = Symbol(
  'INTEGRATION_CREDENTIALS_REPOSITORY',
);

/**
 * Os métodos de leitura não carregam o token, exceto
 * `findActiveWithAccessToken`, usado só por quem precisa chamar o provedor.
 */
export interface IntegrationCredentialsRepository {
  /**
   * Na mesma transação: revoga a credencial ativa do expert no provedor
   * (apagando o token e desconectando as contas dela) e grava a nova com as
   * contas autorizadas.
   */
  replaceActive(
    credential: IntegrationCredential,
    accounts: IntegrationAccount[],
  ): Promise<void>;
  /** Revoga a credencial ativa, apaga o token e desconecta as contas. */
  revokeActive(
    tenantId: string,
    expertId: string,
    provider: IntegrationProvider,
    revokedAt: Date,
  ): Promise<boolean>;
  findActiveWithAccessToken(
    tenantId: string,
    expertId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationCredential | null>;
  findActiveByTenantId(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationCredential[]>;
}

export interface DeletableIntegrationCredentialsRepository extends IntegrationCredentialsRepository {
  deleteActive(
    tenantId: string,
    expertId: string,
    provider: IntegrationProvider,
  ): Promise<boolean>;
}
