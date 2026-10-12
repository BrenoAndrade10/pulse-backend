import type { UserRole } from '../../../users/domain/enums/UserRole';

export type AuthMembership = {
  tenantId: string;
  tenantName: string;
  role: UserRole;
};
