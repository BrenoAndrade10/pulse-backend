import { Expert } from '../entities/Expert';

export const EXPERTS_REPOSITORY = Symbol('EXPERTS_REPOSITORY');

export interface ExpertsRepository {
  create(expert: Expert): Promise<Expert>;
  findById(id: string): Promise<Expert | null>;
  findByTenantId(tenantId: string): Promise<Expert[]>;
}
