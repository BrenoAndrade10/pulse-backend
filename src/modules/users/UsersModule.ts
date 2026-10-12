import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/tokens';
import { REGISTER_TENANT_USER_TRANSACTION } from './application/transactions/RegisterTenantUserTransaction';
import { RegisterTenantUserUseCase } from './application/use-cases/RegisterTenantUserUseCase';
import { TypeOrmRegisterTenantUserTransaction } from './infra/transactions/TypeOrmRegisterTenantUserTransaction';
import { UsersController } from './presentation/controllers/UsersController';

@Module({
  controllers: [UsersController],
  providers: [
    RegisterTenantUserUseCase,
    {
      provide: REGISTER_TENANT_USER_TRANSACTION,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmRegisterTenantUserTransaction(dataSource),
    },
  ],
})
export class UsersModule {}
