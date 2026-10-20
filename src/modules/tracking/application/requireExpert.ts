import { DomainError } from '../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../auth/domain/types/AccessTokenClaims';
import type { ExpertsRepository } from '../../experts/domain/repositories/ExpertsRepository';
import { requireTenant } from '../../experts/application/ExpertAuthorization';

/** Empresa do usuário logado, garantindo que o expert é dela. */
export async function requireExpert(
  experts: ExpertsRepository,
  expertId: string,
  auth: AccessTokenClaims,
): Promise<string> {
  const tenantId = requireTenant(auth);
  const expert = await experts.findByTenantIdAndId(tenantId, expertId);
  if (!expert) throw DomainError.expertNotFound();
  return tenantId;
}
