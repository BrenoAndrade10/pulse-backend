import { TenantUser } from '../../domain/entities/TenantUser';
import { TenantUserOrmEntity } from '../entities/TenantUserOrmEntity';

export class TenantUserMapper {
  static toDomain(entity: TenantUserOrmEntity): TenantUser {
    return new TenantUser({
      id: entity.id,
      tenantId: entity.tenantId,
      userId: entity.userId,
      role: entity.role,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(tenantUser: TenantUser): TenantUserOrmEntity {
    const entity = new TenantUserOrmEntity();

    entity.id = tenantUser.id;
    entity.tenantId = tenantUser.tenantId;
    entity.userId = tenantUser.userId;
    entity.role = tenantUser.role;
    entity.createdAt = tenantUser.createdAt;
    entity.updatedAt = tenantUser.updatedAt;

    return entity;
  }
}
