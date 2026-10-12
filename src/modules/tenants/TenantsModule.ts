import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/tokens';
import { TENANT_USERS_REPOSITORY } from './domain/repositories/TenantUsersRepository';
import { TENANTS_REPOSITORY } from './domain/repositories/TenantsRepository';
import { TenantOrmEntity } from './infra/entities/TenantOrmEntity';
import { TenantUserOrmEntity } from './infra/entities/TenantUserOrmEntity';
import { TypeOrmTenantUsersRepository } from './infra/repositories/TypeOrmTenantUsersRepository';
import { TypeOrmTenantsRepository } from './infra/repositories/TypeOrmTenantsRepository';

@Module({
  providers: [
    {
      provide: TENANTS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmTenantsRepository(dataSource.getRepository(TenantOrmEntity)),
    },
    {
      provide: TENANT_USERS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmTenantUsersRepository(
          dataSource.getRepository(TenantUserOrmEntity),
        ),
    },
  ],
  exports: [TENANTS_REPOSITORY, TENANT_USERS_REPOSITORY],
})
export class TenantsModule {}
