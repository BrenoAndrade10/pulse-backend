import { Expert } from '../../domain/entities/Expert';
import { ExpertOrmEntity } from '../entities/ExpertOrmEntity';

export class ExpertMapper {
  static toDomain(entity: ExpertOrmEntity): Expert {
    return new Expert({
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      commercialName: entity.commercialName,
      email: entity.email,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(expert: Expert): ExpertOrmEntity {
    const entity = new ExpertOrmEntity();

    entity.id = expert.id;
    entity.tenantId = expert.tenantId;
    entity.name = expert.name;
    entity.commercialName = expert.commercialName;
    entity.email = expert.email;
    entity.status = expert.status;
    entity.createdAt = expert.createdAt;
    entity.updatedAt = expert.updatedAt;

    return entity;
  }
}
