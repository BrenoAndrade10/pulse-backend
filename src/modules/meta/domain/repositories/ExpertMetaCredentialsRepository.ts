import { ExpertMetaCredential } from '../entities/ExpertMetaCredential';

export const EXPERT_META_CREDENTIALS_REPOSITORY = Symbol(
  'EXPERT_META_CREDENTIALS_REPOSITORY',
);

export interface ExpertMetaCredentialsRepository {
  create(credential: ExpertMetaCredential): Promise<ExpertMetaCredential>;
  /**
   * Desativa a credencial ativa do expert (se houver) e grava a nova como
   * ativa, na mesma transação.
   */
  replaceActive(
    credential: ExpertMetaCredential,
  ): Promise<ExpertMetaCredential>;
  findActiveByExpertId(
    tenantId: string,
    expertId: string,
  ): Promise<ExpertMetaCredential | null>;
  findByInstagramUserId(
    tenantId: string,
    instagramUserId: string,
  ): Promise<ExpertMetaCredential | null>;
}
