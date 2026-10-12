import { Tenant } from '../entities/Tenant';

export const TENANTS_REPOSITORY = Symbol('TENANTS_REPOSITORY');

export interface TenantsRepository {
  create(tenant: Tenant): Promise<Tenant>;
  findById(id: string): Promise<Tenant | null>;
  findByName(name: string): Promise<Tenant | null>;
}
