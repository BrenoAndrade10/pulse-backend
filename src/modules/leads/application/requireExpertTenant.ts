import { DomainError } from '../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../auth/domain/types/AccessTokenClaims';
import { requireTenant } from '../../experts/application/ExpertAuthorization';
import type { ExpertsRepository } from '../../experts/domain/repositories/ExpertsRepository';

/** Empresa do usuário logado, garantindo que o expert é dela. */
export async function requireExpertTenant(
  experts: ExpertsRepository,
  expertId: string,
  auth: AccessTokenClaims,
): Promise<string> {
  const tenantId = requireTenant(auth);
  if (!(await experts.findByTenantIdAndId(tenantId, expertId))) {
    throw DomainError.expertNotFound();
  }
  return tenantId;
}
