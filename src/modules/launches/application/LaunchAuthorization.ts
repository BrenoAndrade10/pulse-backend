import { DomainError } from '../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../auth/domain/types/AccessTokenClaims';
import { UserRole } from '../../users/domain/enums/UserRole';

export function requireLaunchAdmin(auth: AccessTokenClaims): string {
  if (!auth.tenantId || auth.role !== UserRole.ADMIN) {
    throw DomainError.forbidden();
  }
  return auth.tenantId;
}
