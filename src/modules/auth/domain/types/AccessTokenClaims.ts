import type { UserRole } from '../../../users/domain/enums/UserRole';

export type AccessTokenClaims = {
  userId: string;
  sessionId: string;
  tenantId: string | null;
  role: UserRole | null;
};
