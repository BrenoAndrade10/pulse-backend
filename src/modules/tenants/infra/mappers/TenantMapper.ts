import { Tenant } from '../../domain/entities/Tenant';
import { TenantOrmEntity } from '../entities/TenantOrmEntity';

export class TenantMapper {
  static toDomain(entity: TenantOrmEntity): Tenant {
    return new Tenant({
      id: entity.id,
      name: entity.name,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(tenant: Tenant): TenantOrmEntity {
    const entity = new TenantOrmEntity();

    entity.id = tenant.id;
    entity.name = tenant.name;
    entity.status = tenant.status;
    entity.createdAt = tenant.createdAt;
    entity.updatedAt = tenant.updatedAt;

    return entity;
  }
}
