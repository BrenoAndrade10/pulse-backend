import type { User } from '../../../users/domain/entities/User';
import type { AuthAccountsRepository } from '../../domain/repositories/AuthAccountsRepository';
import type { AuthMembership } from '../../domain/types/AuthMembership';

export class InMemoryAuthAccountsRepository implements AuthAccountsRepository {
  readonly users: User[] = [];
  readonly memberships = new Map<string, AuthMembership[]>();
  readonly lastLogins = new Map<string, Date>();

  findUserByEmail(email: string): Promise<User | null> {
    return Promise.resolve(
      this.users.find((user) => user.email === email) ?? null,
    );
  }

  findUserById(userId: string): Promise<User | null> {
    return Promise.resolve(
      this.users.find((user) => user.id === userId) ?? null,
    );
  }

  findMembershipsByUserId(userId: string): Promise<AuthMembership[]> {
    return Promise.resolve(this.memberships.get(userId) ?? []);
  }

  updateLastLoginAt(userId: string, lastLoginAt: Date): Promise<void> {
    this.lastLogins.set(userId, lastLoginAt);

    return Promise.resolve();
  }
}
