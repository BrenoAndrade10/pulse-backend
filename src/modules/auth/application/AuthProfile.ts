import type { User } from '../../users/domain/entities/User';
import type { AuthMembership } from '../domain/types/AuthMembership';

export type AuthProfile = {
  user: {
    id: string;
    firstName: string;
    lastName?: string;
    email: string;
  };
  activeTenant: AuthMembership | null;
  tenants: AuthMembership[];
};

export type AuthResult = {
  accessToken: string;
  accessTokenExpiresIn: number;
  /** null quando o refresh caiu na janela de tolerância e não houve rotação. */
  refreshToken: string | null;
  refreshTokenExpiresAt: Date;
  rememberMe: boolean;
  profile: AuthProfile;
};

export function buildAuthProfile(
  user: User,
  memberships: AuthMembership[],
  activeTenantId: string | null,
): AuthProfile {
  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    activeTenant:
      memberships.find(
        (membership) => membership.tenantId === activeTenantId,
      ) ?? null,
    tenants: memberships,
  };
}
