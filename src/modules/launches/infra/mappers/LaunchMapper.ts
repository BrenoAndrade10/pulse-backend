import { Launch } from '../../domain/entities/Launch';
import { LaunchOrmEntity } from '../entities/LaunchOrmEntity';

export class LaunchMapper {
  static toDomain(entity: LaunchOrmEntity): Launch {
    return new Launch({
      id: entity.id,
      tenantId: entity.tenantId,
      expertId: entity.expertId,
      slug: entity.slug,
      type: entity.type,
      name: entity.name,
      description: entity.description,
      status: entity.status,
      startsAt: entity.startsAt,
      endsAt: entity.endsAt,
      timezone: entity.timezone,
      deletedAt: entity.deletedAt,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
      deletedBy: entity.deletedBy,
      version: entity.version,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(launch: Launch): LaunchOrmEntity {
    const entity = new LaunchOrmEntity();
    entity.id = launch.id;
    entity.tenantId = launch.tenantId;
    entity.expertId = launch.expertId;
    entity.slug = launch.slug;
    entity.type = launch.type;
    entity.name = launch.name;
    entity.description = launch.description;
    entity.status = launch.status;
    entity.startsAt = launch.startsAt;
    entity.endsAt = launch.endsAt;
    entity.timezone = launch.timezone;
    entity.deletedAt = launch.deletedAt;
    entity.createdBy = launch.createdBy;
    entity.updatedBy = launch.updatedBy;
    entity.deletedBy = launch.deletedBy;
    entity.version = launch.version;
    entity.createdAt = launch.createdAt;
    entity.updatedAt = launch.updatedAt;
    return entity;
  }
}
