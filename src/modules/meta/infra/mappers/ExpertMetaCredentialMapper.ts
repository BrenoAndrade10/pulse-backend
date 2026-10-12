import {
  ExpertMetaCredential,
  EncryptedToken,
} from '../../domain/entities/ExpertMetaCredential';
import { ExpertMetaCredentialOrmEntity } from '../entities/ExpertMetaCredentialOrmEntity';

export class ExpertMetaCredentialMapper {
  static toDomain(entity: ExpertMetaCredentialOrmEntity): ExpertMetaCredential {
    return new ExpertMetaCredential({
      id: entity.id,
      tenantId: entity.tenantId,
      expertId: entity.expertId,
      metaUserId: entity.metaUserId,
      instagramUserId: entity.instagramUserId,
      instagramUsername: entity.instagramUsername,
      pageId: entity.pageId,
      pageName: entity.pageName,
      accessToken: {
        encryptedValue: entity.accessTokenEncrypted,
        iv: entity.accessTokenIv,
        authTag: entity.accessTokenAuthTag,
      },
      refreshToken: this.toEncryptedToken(
        entity.refreshTokenEncrypted,
        entity.refreshTokenIv,
        entity.refreshTokenAuthTag,
      ),
      tokenExpiresAt: entity.tokenExpiresAt,
      scopes: entity.scopes,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(
    credential: ExpertMetaCredential,
  ): ExpertMetaCredentialOrmEntity {
    const entity = new ExpertMetaCredentialOrmEntity();

    entity.id = credential.id;
    entity.tenantId = credential.tenantId;
    entity.expertId = credential.expertId;
    entity.metaUserId = credential.metaUserId;
    entity.instagramUserId = credential.instagramUserId;
    entity.instagramUsername = credential.instagramUsername;
    entity.pageId = credential.pageId;
    entity.pageName = credential.pageName;
    entity.accessTokenEncrypted = credential.accessToken.encryptedValue;
    entity.accessTokenIv = credential.accessToken.iv;
    entity.accessTokenAuthTag = credential.accessToken.authTag;
    entity.refreshTokenEncrypted = credential.refreshToken?.encryptedValue;
    entity.refreshTokenIv = credential.refreshToken?.iv;
    entity.refreshTokenAuthTag = credential.refreshToken?.authTag;
    entity.tokenExpiresAt = credential.tokenExpiresAt;
    entity.scopes = credential.scopes;
    entity.isActive = credential.isActive;
    entity.createdAt = credential.createdAt;
    entity.updatedAt = credential.updatedAt;

    return entity;
  }

  private static toEncryptedToken(
    encryptedValue?: string,
    iv?: string,
    authTag?: string,
  ): EncryptedToken | undefined {
    if (!encryptedValue || !iv || !authTag) {
      return undefined;
    }

    return {
      encryptedValue,
      iv,
      authTag,
    };
  }
}
