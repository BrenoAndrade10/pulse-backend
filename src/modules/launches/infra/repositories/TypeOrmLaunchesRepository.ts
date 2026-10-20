import { Injectable } from '@nestjs/common';
import { IsNull, QueryFailedError, type Repository } from 'typeorm';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Launch } from '../../domain/entities/Launch';
import type { LaunchesRepository } from '../../domain/repositories/LaunchesRepository';
import { LaunchOrmEntity } from '../entities/LaunchOrmEntity';
import { LaunchMapper } from '../mappers/LaunchMapper';

@Injectable()
export class TypeOrmLaunchesRepository implements LaunchesRepository {
  constructor(private readonly repository: Repository<LaunchOrmEntity>) {}

  async create(launch: Launch): Promise<Launch> {
    try {
      const saved = await this.repository.save(
        LaunchMapper.toPersistence(launch),
      );
      return LaunchMapper.toDomain(saved);
    } catch (error) {
      this.translatePersistenceError(error);
    }
  }

  async save(launch: Launch): Promise<Launch> {
    const entity = LaunchMapper.toPersistence(launch);

    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(LaunchOrmEntity)
        .set({
          expertId: entity.expertId,
          slug: entity.slug,
          type: entity.type,
          name: entity.name,
          description: entity.description,
          status: entity.status,
          startsAt: entity.startsAt,
          endsAt: entity.endsAt,
          timezone: entity.timezone,
          updatedBy: entity.updatedBy,
          updatedAt: entity.updatedAt,
          version: () => '"version" + 1',
        })
        .where('"tenantId" = :tenantId', { tenantId: entity.tenantId })
        .andWhere('"id" = :id', { id: entity.id })
        .andWhere('"version" = :version', { version: entity.version })
        .andWhere('"deletedAt" IS NULL')
        .returning('*')
        .execute();

      const updated = (result.raw as unknown[])[0] as
        LaunchOrmEntity | undefined;
      if (!updated) {
        throw new DomainError(409, 'LAUNCH_VERSION_CONFLICT');
      }
      return LaunchMapper.toDomain(updated);
    } catch (error) {
      this.translatePersistenceError(error);
    }
  }

  async findByTenantIdAndId(
    tenantId: string,
    id: string,
  ): Promise<Launch | null> {
    const launch = await this.repository.findOne({
      where: { tenantId, id, deletedAt: IsNull() },
    });
    return launch ? LaunchMapper.toDomain(launch) : null;
  }

  async findByTenantId(tenantId: string): Promise<Launch[]> {
    const launches = await this.repository.find({
      where: { tenantId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return launches.map((launch) => LaunchMapper.toDomain(launch));
  }

  async findByTenantIdAndExpertId(
    tenantId: string,
    expertId: string,
  ): Promise<Launch[]> {
    const launches = await this.repository.find({
      where: { tenantId, expertId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return launches.map((launch) => LaunchMapper.toDomain(launch));
  }

  async softDeleteByTenantIdAndId(
    tenantId: string,
    id: string,
    deletedBy: string,
  ): Promise<boolean> {
    const now = new Date();
    const result = await this.repository
      .createQueryBuilder()
      .update(LaunchOrmEntity)
      .set({
        deletedAt: now,
        deletedBy,
        updatedBy: deletedBy,
        updatedAt: now,
        version: () => '"version" + 1',
      })
      .where('"tenantId" = :tenantId', { tenantId })
      .andWhere('"id" = :id', { id })
      .andWhere('"deletedAt" IS NULL')
      .execute();
    return (result.affected ?? 0) > 0;
  }

  private translatePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const constraint = (error.driverError as { constraint?: string })
        .constraint;
      if (constraint === 'FK_launches_expert_tenant') {
        throw DomainError.expertNotFound();
      }
      if (constraint === 'IDX_launches_tenant_slug_active') {
        throw new DomainError(409, 'LAUNCH_SLUG_ALREADY_EXISTS');
      }
    }
    throw error;
  }
}
