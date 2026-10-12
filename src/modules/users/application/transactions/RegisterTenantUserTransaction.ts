import type { TenantUsersRepository } from '../../../tenants/domain/repositories/TenantUsersRepository';
import type { TenantsRepository } from '../../../tenants/domain/repositories/TenantsRepository';
import type { UsersRepository } from '../../domain/repositories/UsersRepository';

export const REGISTER_TENANT_USER_TRANSACTION = Symbol(
  'REGISTER_TENANT_USER_TRANSACTION',
);

export type RegisterTenantUserTransactionRepositories = {
  usersRepository: UsersRepository;
  tenantsRepository: TenantsRepository;
  tenantUsersRepository: TenantUsersRepository;
};

export interface RegisterTenantUserTransaction {
  execute<TResult>(
    callback: (
      repositories: RegisterTenantUserTransactionRepositories,
    ) => Promise<TResult>,
  ): Promise<TResult>;
}
