import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Tenant } from '../../domain/entities/Tenant';
import { TenantsRepository } from '../../domain/repositories/TenantsRepository';
import { TenantOrmEntity } from '../entities/TenantOrmEntity';
import { TenantMapper } from '../mappers/TenantMapper';

@Injectable()
export class TypeOrmTenantsRepository implements TenantsRepository {
  constructor(private readonly repository: Repository<TenantOrmEntity>) {}

  async create(tenant: Tenant): Promise<Tenant> {
    const entity = TenantMapper.toPersistence(tenant);
    const savedTenant = await this.repository.save(entity);

    return TenantMapper.toDomain(savedTenant);
  }

  async findById(id: string): Promise<Tenant | null> {
    const tenant = await this.repository.findOne({ where: { id } });

    return tenant ? TenantMapper.toDomain(tenant) : null;
  }

  async findByName(name: string): Promise<Tenant | null> {
    const tenant = await this.repository.findOne({ where: { name } });

    return tenant ? TenantMapper.toDomain(tenant) : null;
  }
}
