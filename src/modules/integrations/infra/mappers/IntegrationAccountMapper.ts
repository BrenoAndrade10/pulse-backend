import { IntegrationAccount } from '../../domain/entities/IntegrationAccount';
import { IntegrationAccountOrmEntity } from '../entities/IntegrationAccountOrmEntity';

export class IntegrationAccountMapper {
  static toDomain(entity: IntegrationAccountOrmEntity): IntegrationAccount {
    return new IntegrationAccount({
      id: entity.id,
      tenantId: entity.tenantId,
      expertId: entity.expertId,
      credentialId: entity.credentialId,
      provider: entity.provider,
      type: entity.type,
      externalId: entity.externalId,
      displayName: entity.displayName ?? undefined,
      metadata: entity.metadata,
      connectedAt: entity.connectedAt,
      disconnectedAt: entity.disconnectedAt ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(
    account: IntegrationAccount,
  ): IntegrationAccountOrmEntity {
    const entity = new IntegrationAccountOrmEntity();

    entity.id = account.id;
    entity.tenantId = account.tenantId;
    entity.expertId = account.expertId;
    entity.credentialId = account.credentialId;
    entity.provider = account.provider;
    entity.type = account.type;
    entity.externalId = account.externalId;
    entity.displayName = account.displayName ?? null;
    entity.metadata = account.metadata;
    entity.connectedAt = account.connectedAt;
    entity.disconnectedAt = account.disconnectedAt ?? null;
    entity.createdAt = account.createdAt;
    entity.updatedAt = account.updatedAt;

    return entity;
  }
}
