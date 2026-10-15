import { Expert } from '../entities/Expert';

export const EXPERTS_REPOSITORY = Symbol('EXPERTS_REPOSITORY');

export interface ExpertsRepository {
  create(expert: Expert): Promise<Expert>;
  save(expert: Expert): Promise<Expert>;
  findById(id: string): Promise<Expert | null>;
  findByTenantIdAndId(tenantId: string, id: string): Promise<Expert | null>;
  findByTenantIdAndEmail(
    tenantId: string,
    email: string,
  ): Promise<Expert | null>;
  findByTenantId(tenantId: string): Promise<Expert[]>;
  deleteByTenantIdAndId(tenantId: string, id: string): Promise<boolean>;
}
