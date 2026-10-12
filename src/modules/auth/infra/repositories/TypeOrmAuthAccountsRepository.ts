import type { DataSource } from 'typeorm';
import type { User } from '../../../users/domain/entities/User';
import type { UserRole } from '../../../users/domain/enums/UserRole';
import { UserOrmEntity } from '../../../users/infra/entities/UserOrmEntity';
import { UserMapper } from '../../../users/infra/mappers/UserMapper';
import { TenantStatus } from '../../../tenants/domain/enums/TenantStatus';
import { TenantOrmEntity } from '../../../tenants/infra/entities/TenantOrmEntity';
import { TenantUserOrmEntity } from '../../../tenants/infra/entities/TenantUserOrmEntity';
import type { AuthAccountsRepository } from '../../domain/repositories/AuthAccountsRepository';
import type { AuthMembership } from '../../domain/types/AuthMembership';

type MembershipRow = {
  tenantId: string;
  tenantName: string;
  role: UserRole;
};

export class TypeOrmAuthAccountsRepository implements AuthAccountsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findUserByEmail(email: string): Promise<User | null> {
    const user = await this.dataSource
      .getRepository(UserOrmEntity)
      .findOne({ where: { email } });

    return user ? UserMapper.toDomain(user) : null;
  }

  async findUserById(userId: string): Promise<User | null> {
    const user = await this.dataSource
      .getRepository(UserOrmEntity)
      .findOne({ where: { id: userId } });

    return user ? UserMapper.toDomain(user) : null;
  }

  findMembershipsByUserId(userId: string): Promise<AuthMembership[]> {
    return this.dataSource
      .getRepository(TenantUserOrmEntity)
      .createQueryBuilder('tenantUser')
      .innerJoin(TenantOrmEntity, 'tenant', 'tenant.id = tenantUser.tenantId')
      .select('tenantUser.tenantId', 'tenantId')
      .addSelect('tenant.name', 'tenantName')
      .addSelect('tenantUser.role', 'role')
      .where('tenantUser.userId = :userId', { userId })
      .andWhere('tenant.status = :status', { status: TenantStatus.ACTIVE })
      .orderBy('tenantUser.createdAt', 'ASC')
      .getRawMany<MembershipRow>();
  }

  async updateLastLoginAt(userId: string, lastLoginAt: Date): Promise<void> {
    await this.dataSource
      .getRepository(UserOrmEntity)
      .update({ id: userId }, { lastLoginAt });
  }
}
