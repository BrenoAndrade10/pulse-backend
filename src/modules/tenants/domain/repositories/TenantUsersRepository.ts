import { TenantUser } from '../entities/TenantUser';

export const TENANT_USERS_REPOSITORY = Symbol('TENANT_USERS_REPOSITORY');

export interface TenantUsersRepository {
  create(tenantUser: TenantUser): Promise<TenantUser>;
  findByTenantIdAndUserId(
    tenantId: string,
    userId: string,
  ): Promise<TenantUser | null>;
}
