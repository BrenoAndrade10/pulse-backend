import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  RegisterTenantUserTransaction,
  RegisterTenantUserTransactionRepositories,
} from '../../application/transactions/RegisterTenantUserTransaction';
import { TenantOrmEntity } from '../../../tenants/infra/entities/TenantOrmEntity';
import { TenantUserOrmEntity } from '../../../tenants/infra/entities/TenantUserOrmEntity';
import { TypeOrmTenantUsersRepository } from '../../../tenants/infra/repositories/TypeOrmTenantUsersRepository';
import { TypeOrmTenantsRepository } from '../../../tenants/infra/repositories/TypeOrmTenantsRepository';
import { UserOrmEntity } from '../entities/UserOrmEntity';
import { TypeOrmUsersRepository } from '../repositories/TypeOrmUsersRepository';

@Injectable()
export class TypeOrmRegisterTenantUserTransaction implements RegisterTenantUserTransaction {
  constructor(private readonly dataSource: DataSource) {}

  execute<TResult>(
    callback: (
      repositories: RegisterTenantUserTransactionRepositories,
    ) => Promise<TResult>,
  ): Promise<TResult> {
    return this.dataSource.transaction((entityManager) =>
      callback({
        usersRepository: new TypeOrmUsersRepository(
          entityManager.getRepository(UserOrmEntity),
        ),
        tenantsRepository: new TypeOrmTenantsRepository(
          entityManager.getRepository(TenantOrmEntity),
        ),
        tenantUsersRepository: new TypeOrmTenantUsersRepository(
          entityManager.getRepository(TenantUserOrmEntity),
        ),
      }),
    );
  }
}
