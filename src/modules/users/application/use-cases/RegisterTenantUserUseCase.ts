import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Tenant } from '../../../tenants/domain/entities/Tenant';
import { TenantUser } from '../../../tenants/domain/entities/TenantUser';
import { TenantStatus } from '../../../tenants/domain/enums/TenantStatus';
import type { TenantUsersRepository } from '../../../tenants/domain/repositories/TenantUsersRepository';
import type { TenantsRepository } from '../../../tenants/domain/repositories/TenantsRepository';
import { User } from '../../domain/entities/User';
import { UserRole } from '../../domain/enums/UserRole';
import { UserStatus } from '../../domain/enums/UserStatus';
import { REGISTER_TENANT_USER_TRANSACTION } from '../transactions/RegisterTenantUserTransaction';
import type { RegisterTenantUserTransaction } from '../transactions/RegisterTenantUserTransaction';

export type RegisterTenantUserUseCaseInput = {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  tenantId?: string;
  tenantName?: string;
  role?: UserRole;
};

@Injectable()
export class RegisterTenantUserUseCase {
  constructor(
    @Inject(REGISTER_TENANT_USER_TRANSACTION)
    private readonly transaction: RegisterTenantUserTransaction,

    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: RegisterTenantUserUseCaseInput): Promise<User> {
    if (input.tenantId && input.tenantName) {
      throw new DomainError(
        400,
        'TENANT_ID_AND_TENANT_NAME_MUTUALLY_EXCLUSIVE',
      );
    }

    return this.transaction.execute(
      async ({ usersRepository, tenantsRepository, tenantUsersRepository }) => {
        const userAlreadyExists = await usersRepository.findByEmail(
          input.email,
        );

        if (userAlreadyExists) {
          throw new DomainError(409, 'USER_ALREADY_EXISTS');
        }

        const now = new Date();
        const tenant = await this.resolveTenantForRegistration(
          input,
          now,
          tenantsRepository,
        );
        const user = new User({
          id: this.idGenerator.generate(),
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: await this.hashPassword(input.password),
          status: UserStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        });

        const registeredUser = await usersRepository.create(user);

        if (tenant) {
          await this.createTenantUserMembership({
            user: registeredUser,
            tenant,
            registrationInput: input,
            now,
            tenantUsersRepository,
          });
        }

        return registeredUser;
      },
    );
  }

  private async resolveTenantForRegistration(
    input: RegisterTenantUserUseCaseInput,
    now: Date,
    tenantsRepository: TenantsRepository,
  ): Promise<Tenant | null> {
    if (input.tenantId) {
      const tenant = await tenantsRepository.findById(input.tenantId);

      if (!tenant) {
        throw DomainError.tenantNotFound();
      }

      return tenant;
    }

    if (!input.tenantName) {
      return null;
    }

    const existingTenant = await tenantsRepository.findByName(input.tenantName);

    if (existingTenant) {
      throw new DomainError(409, 'TENANT_ALREADY_EXISTS');
    }

    const tenant = new Tenant({
      id: this.idGenerator.generate(),
      name: input.tenantName,
      status: TenantStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });

    return tenantsRepository.create(tenant);
  }

  private async createTenantUserMembership(params: {
    user: User;
    tenant: Tenant;
    registrationInput: RegisterTenantUserUseCaseInput;
    now: Date;
    tenantUsersRepository: TenantUsersRepository;
  }): Promise<void> {
    const existingMembership =
      await params.tenantUsersRepository.findByTenantIdAndUserId(
        params.tenant.id,
        params.user.id,
      );

    if (existingMembership) {
      return;
    }

    const tenantUser = new TenantUser({
      id: this.idGenerator.generate(),
      tenantId: params.tenant.id,
      userId: params.user.id,
      role:
        params.registrationInput.role ??
        (params.registrationInput.tenantName
          ? UserRole.ADMIN
          : UserRole.MEMBER),
      createdAt: params.now,
      updatedAt: params.now,
    });

    await params.tenantUsersRepository.create(tenantUser);
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }
}
