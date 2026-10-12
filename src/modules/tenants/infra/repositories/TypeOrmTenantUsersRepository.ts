import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { TenantUser } from '../../domain/entities/TenantUser';
import { TenantUsersRepository } from '../../domain/repositories/TenantUsersRepository';
import { TenantUserOrmEntity } from '../entities/TenantUserOrmEntity';
import { TenantUserMapper } from '../mappers/TenantUserMapper';

@Injectable()
export class TypeOrmTenantUsersRepository implements TenantUsersRepository {
  constructor(private readonly repository: Repository<TenantUserOrmEntity>) {}

  async create(tenantUser: TenantUser): Promise<TenantUser> {
    const entity = TenantUserMapper.toPersistence(tenantUser);
    const savedTenantUser = await this.repository.save(entity);

    return TenantUserMapper.toDomain(savedTenantUser);
  }

  async findByTenantIdAndUserId(
    tenantId: string,
    userId: string,
  ): Promise<TenantUser | null> {
    const tenantUser = await this.repository.findOne({
      where: {
        tenantId,
        userId,
      },
    });

    return tenantUser ? TenantUserMapper.toDomain(tenantUser) : null;
  }
}
