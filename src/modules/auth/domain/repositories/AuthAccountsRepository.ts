import type { User } from '../../../users/domain/entities/User';
import type { AuthMembership } from '../types/AuthMembership';

export const AUTH_ACCOUNTS_REPOSITORY = Symbol('AUTH_ACCOUNTS_REPOSITORY');

export interface AuthAccountsRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(userId: string): Promise<User | null>;
  /** Vínculos do usuário com tenants ativos, do mais antigo para o mais novo. */
  findMembershipsByUserId(userId: string): Promise<AuthMembership[]>;
  updateLastLoginAt(userId: string, lastLoginAt: Date): Promise<void>;
}
