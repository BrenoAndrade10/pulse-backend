import { Injectable } from '@nestjs/common';
import { IsNull, QueryFailedError, type Repository } from 'typeorm';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { Link } from '../../domain/entities/Link';
import type {
  LinkFilters,
  LinkPageQuery,
  LinkUpdate,
  LinksRepository,
} from '../../domain/repositories/LinksRepository';
import { LinkOrmEntity } from '../entities/LinkOrmEntity';
import { LinkMapper } from '../mappers/LinkMapper';

@Injectable()
export class TypeOrmLinksRepository implements LinksRepository {
  constructor(private readonly repository: Repository<LinkOrmEntity>) {}

  async create(link: Link): Promise<Link> {
    try {
      const saved = await this.repository.save(LinkMapper.toPersistence(link));
      return LinkMapper.toDomain(saved);
    } catch (error) {
      this.translatePersistenceError(error);
    }
  }

  async tryCreate(link: Link): Promise<Link | null> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(LinkOrmEntity)
      .values(LinkMapper.toPersistence(link))
      .orIgnore()
      .returning('*')
      .execute();
    const entity = (result.raw as LinkOrmEntity[])[0];
    return entity ? LinkMapper.toDomain(entity) : null;
  }

  async findByCode(code: string): Promise<Link | null> {
    const entity = await this.repository.findOne({
      where: { code, deletedAt: IsNull() },
    });
    return entity ? LinkMapper.toDomain(entity) : null;
  }

  async findByTenantIdAndId(
    tenantId: string,
    id: string,
  ): Promise<Link | null> {
    const entity = await this.repository.findOne({
      where: { tenantId, id, deletedAt: IsNull() },
    });
    return entity ? LinkMapper.toDomain(entity) : null;
  }

  async findByTenantId(
    tenantId: string,
    filters: LinkFilters = {},
  ): Promise<Link[]> {
    const entities = await this.repository.find({
      where: {
        tenantId,
        ...(filters.expertId !== undefined && { expertId: filters.expertId }),
        ...(filters.launchId !== undefined && { launchId: filters.launchId }),
        ...(filters.status !== undefined && { status: filters.status }),
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
    return entities.map((entity) => LinkMapper.toDomain(entity));
  }

  async findPage(query: LinkPageQuery): Promise<Link[]> {
    const builder = this.repository
      .createQueryBuilder('link')
      .where('link."tenantId" = :tenantId', { tenantId: query.tenantId })
      .andWhere('link."deletedAt" IS NULL')
      .orderBy('link."createdAt"', 'DESC')
      .addOrderBy('link."id"', 'DESC')
      .take(query.limit);
    if (query.expertId)
      builder.andWhere('link."expertId" = :expertId', {
        expertId: query.expertId,
      });
    if (query.launchId)
      builder.andWhere('link."launchId" = :launchId', {
        launchId: query.launchId,
      });
    if (query.channel)
      builder.andWhere('link."channel" = :channel', { channel: query.channel });
    if (query.status)
      builder.andWhere('link."status" = :status', { status: query.status });
    if (query.search) {
      const search = query.search.replace(/[\\%_]/g, '\\$&');
      builder.andWhere('link."name" ILIKE :search ESCAPE \'\\\' ', {
        search: `%${search}%`,
      });
    }
    if (query.cursor) {
      builder.andWhere(
        '(link."createdAt", link."id") < (:cursorCreatedAt, :cursorId)',
        {
          cursorCreatedAt: query.cursor.createdAt,
          cursorId: query.cursor.id,
        },
      );
    }
    const entities = await builder.getMany();
    return entities.map((entity) => LinkMapper.toDomain(entity));
  }

  async save(link: Link): Promise<Link> {
    try {
      const saved = await this.repository.save(LinkMapper.toPersistence(link));
      return LinkMapper.toDomain(saved);
    } catch (error) {
      this.translatePersistenceError(error);
    }
  }

  async updateByTenant(
    tenantId: string,
    id: string,
    update: LinkUpdate,
  ): Promise<Link | null> {
    const result = await this.repository
      .createQueryBuilder()
      .update(LinkOrmEntity)
      .set(update)
      .where('"id" = :id', { id })
      .andWhere('"tenantId" = :tenantId', { tenantId })
      .andWhere('"deletedAt" IS NULL')
      .returning('*')
      .execute();
    const entity = (result.raw as LinkOrmEntity[])[0];
    return entity ? LinkMapper.toDomain(entity) : null;
  }

  async softDelete(tenantId: string, id: string): Promise<boolean> {
    const now = new Date();
    const result = await this.repository
      .createQueryBuilder()
      .update(LinkOrmEntity)
      .set({ deletedAt: now, updatedAt: now })
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
      if (constraint === 'UQ_links_code') {
        throw new DomainError(409, 'LINK_CODE_ALREADY_EXISTS');
      }
    }
    throw error;
  }
}
