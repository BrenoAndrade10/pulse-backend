import { DomainError } from '../../../shared/errors/DomainError';
import type { LaunchesRepository } from '../../launches/domain/repositories/LaunchesRepository';

export async function requireExpertLaunch(
  launches: LaunchesRepository,
  tenantId: string,
  expertId: string,
  launchId: string | undefined,
): Promise<void> {
  if (!launchId) return;
  const launch = await launches.findByTenantIdAndId(tenantId, launchId);
  if (!launch || launch.expertId !== expertId) {
    throw DomainError.launchNotFound();
  }
}
