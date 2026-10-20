import { IntegrationCredential } from '../../domain/entities/IntegrationCredential';
import type { EncryptedToken } from '../../domain/types/EncryptedToken';
import { IntegrationCredentialOrmEntity } from '../entities/IntegrationCredentialOrmEntity';

export class IntegrationCredentialMapper {
  static toDomain(
    entity: IntegrationCredentialOrmEntity,
  ): IntegrationCredential {
    return new IntegrationCredential({
      id: entity.id,
      tenantId: entity.tenantId,
      expertId: entity.expertId,
      provider: entity.provider,
      externalUserId: entity.externalUserId ?? undefined,
      accessToken: this.toEncryptedToken(
        entity.accessTokenEncrypted,
        entity.accessTokenIv,
        entity.accessTokenAuthTag,
      ),
      refreshToken: this.toEncryptedToken(
        entity.refreshTokenEncrypted,
        entity.refreshTokenIv,
        entity.refreshTokenAuthTag,
      ),
      tokenExpiresAt: entity.tokenExpiresAt ?? undefined,
      scopes: entity.scopes,
      status: entity.status,
      revokedAt: entity.revokedAt ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(
    credential: IntegrationCredential,
  ): IntegrationCredentialOrmEntity {
    const entity = new IntegrationCredentialOrmEntity();

    entity.id = credential.id;
    entity.tenantId = credential.tenantId;
    entity.expertId = credential.expertId;
    entity.provider = credential.provider;
    entity.externalUserId = credential.externalUserId ?? null;
    entity.accessTokenEncrypted =
      credential.accessToken?.encryptedValue ?? null;
    entity.accessTokenIv = credential.accessToken?.iv ?? null;
    entity.accessTokenAuthTag = credential.accessToken?.authTag ?? null;
    entity.refreshTokenEncrypted =
      credential.refreshToken?.encryptedValue ?? null;
    entity.refreshTokenIv = credential.refreshToken?.iv ?? null;
    entity.refreshTokenAuthTag = credential.refreshToken?.authTag ?? null;
    entity.tokenExpiresAt = credential.tokenExpiresAt ?? null;
    entity.scopes = credential.scopes;
    entity.status = credential.status;
    entity.revokedAt = credential.revokedAt ?? null;
    entity.createdAt = credential.createdAt;
    entity.updatedAt = credential.updatedAt;

    return entity;
  }

  private static toEncryptedToken(
    encryptedValue?: string | null,
    iv?: string | null,
    authTag?: string | null,
  ): EncryptedToken | undefined {
    if (!encryptedValue || !iv || !authTag) return undefined;

    return { encryptedValue, iv, authTag };
  }
}
