import { DomainError } from '../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../auth/domain/types/AccessTokenClaims';
import { UserRole } from '../../users/domain/enums/UserRole';

export function requireTenant(auth: AccessTokenClaims): string {
  if (!auth.tenantId || !auth.role) throw DomainError.forbidden();
  return auth.tenantId;
}

export function requireTenantAdmin(auth: AccessTokenClaims): string {
  const tenantId = requireTenant(auth);
  if (auth.role !== UserRole.ADMIN) throw DomainError.forbidden();
  return tenantId;
}
