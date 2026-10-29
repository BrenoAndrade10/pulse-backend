import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../infra/database/tokens';
import { REGISTER_TENANT_USER_TRANSACTION } from './application/transactions/RegisterTenantUserTransaction';
import { RegisterTenantUserUseCase } from './application/use-cases/RegisterTenantUserUseCase';
import { TypeOrmRegisterTenantUserTransaction } from './infra/transactions/TypeOrmRegisterTenantUserTransaction';
import { USERS_REPOSITORY } from './domain/repositories/UsersRepository';
import { UserOrmEntity } from './infra/entities/UserOrmEntity';
import { TypeOrmUsersRepository } from './infra/repositories/TypeOrmUsersRepository';
import { UsersController } from './presentation/controllers/UsersController';

@Module({
  controllers: [UsersController],
  providers: [
    RegisterTenantUserUseCase,
    {
      provide: USERS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUsersRepository(dataSource.getRepository(UserOrmEntity)),
    },
    {
      provide: REGISTER_TENANT_USER_TRANSACTION,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmRegisterTenantUserTransaction(dataSource),
    },
  ],
  exports: [USERS_REPOSITORY],
})
export class UsersModule {}
