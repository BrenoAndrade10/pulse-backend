import { Launch } from '../entities/Launch';

export const LAUNCHES_REPOSITORY = Symbol('LAUNCHES_REPOSITORY');

export interface LaunchesRepository {
  create(launch: Launch): Promise<Launch>;
  save(launch: Launch): Promise<Launch>;
  findByTenantIdAndId(tenantId: string, id: string): Promise<Launch | null>;
  findByTenantId(tenantId: string): Promise<Launch[]>;
  findByTenantIdAndExpertId(
    tenantId: string,
    expertId: string,
  ): Promise<Launch[]>;
  softDeleteByTenantIdAndId(
    tenantId: string,
    id: string,
    deletedBy: string,
  ): Promise<boolean>;
}
