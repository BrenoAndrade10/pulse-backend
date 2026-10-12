import * as argon2 from 'argon2';
import { DomainError } from '../../../../../shared/errors/DomainError';
import { UuidV7IdGenerator } from '../../../../../shared/infra/ids/UuidV7IdGenerator';
import { isUuidV7 } from '../../../../../shared/presentation/validators/isUuidV7';
import { Tenant } from '../../../../tenants/domain/entities/Tenant';
import { TenantUser } from '../../../../tenants/domain/entities/TenantUser';
import { TenantUsersRepository } from '../../../../tenants/domain/repositories/TenantUsersRepository';
import { TenantsRepository } from '../../../../tenants/domain/repositories/TenantsRepository';
import { InMemoryUsersRepository } from '../../../infra/repositories/InMemoryUsersRepository';
import { UserRole } from '../../../domain/enums/UserRole';
import type {
  RegisterTenantUserTransaction,
  RegisterTenantUserTransactionRepositories,
} from '../../transactions/RegisterTenantUserTransaction';
import { RegisterTenantUserUseCase } from '../RegisterTenantUserUseCase';

class InMemoryTenantsRepository implements TenantsRepository {
  readonly tenants: Tenant[] = [];

  create(tenant: Tenant): Promise<Tenant> {
    this.tenants.push(tenant);

    return Promise.resolve(tenant);
  }

  findById(id: string): Promise<Tenant | null> {
    const tenant = this.tenants.find(
      (currentTenant) => currentTenant.id === id,
    );

    return Promise.resolve(tenant ?? null);
  }

  findByName(name: string): Promise<Tenant | null> {
    const tenant = this.tenants.find(
      (currentTenant) => currentTenant.name === name,
    );

    return Promise.resolve(tenant ?? null);
  }
}

class InMemoryTenantUsersRepository implements TenantUsersRepository {
  readonly tenantUsers: TenantUser[] = [];

  create(tenantUser: TenantUser): Promise<TenantUser> {
    this.tenantUsers.push(tenantUser);

    return Promise.resolve(tenantUser);
  }

  findByTenantIdAndUserId(
    tenantId: string,
    userId: string,
  ): Promise<TenantUser | null> {
    const tenantUser = this.tenantUsers.find(
      (currentTenantUser) =>
        currentTenantUser.tenantId === tenantId &&
        currentTenantUser.userId === userId,
    );

    return Promise.resolve(tenantUser ?? null);
  }
}

class InMemoryRegisterTenantUserTransaction implements RegisterTenantUserTransaction {
  constructor(
    private readonly repositories: RegisterTenantUserTransactionRepositories,
  ) {}

  execute<TResult>(
    callback: (
      repositories: RegisterTenantUserTransactionRepositories,
    ) => Promise<TResult>,
  ): Promise<TResult> {
    return callback(this.repositories);
  }
}

describe('RegisterTenantUserUseCase', () => {
  let usersRepository: InMemoryUsersRepository;
  let tenantsRepository: InMemoryTenantsRepository;
  let tenantUsersRepository: InMemoryTenantUsersRepository;
  let useCase: RegisterTenantUserUseCase;

  beforeEach(() => {
    usersRepository = new InMemoryUsersRepository();
    tenantsRepository = new InMemoryTenantsRepository();
    tenantUsersRepository = new InMemoryTenantUsersRepository();
    const transaction = new InMemoryRegisterTenantUserTransaction({
      usersRepository,
      tenantsRepository,
      tenantUsersRepository,
    });

    useCase = new RegisterTenantUserUseCase(
      transaction,
      new UuidV7IdGenerator(),
    );
  });

  it('creates the tenant and admin membership when tenantName is provided', async () => {
    const user = await useCase.execute({
      firstName: 'Breno',
      email: 'breno@example.com',
      password: 'secret123',
      tenantName: 'Launch Company',
    });

    expect(user.email).toBe('breno@example.com');
    expect(tenantsRepository.tenants).toHaveLength(1);
    expect(tenantsRepository.tenants[0].name).toBe('Launch Company');
    expect(tenantUsersRepository.tenantUsers).toHaveLength(1);
    expect(tenantUsersRepository.tenantUsers[0].tenantId).toBe(
      tenantsRepository.tenants[0].id,
    );
    expect(tenantUsersRepository.tenantUsers[0].userId).toBe(user.id);
    expect(tenantUsersRepository.tenantUsers[0].role).toBe(UserRole.ADMIN);
  });

  it('generates UUID v7 ids for user, tenant and membership', async () => {
    const user = await useCase.execute({
      firstName: 'Breno',
      email: 'breno@example.com',
      password: 'secret123',
      tenantName: 'Launch Company',
    });

    expect(isUuidV7(user.id)).toBe(true);
    expect(isUuidV7(tenantsRepository.tenants[0].id)).toBe(true);
    expect(isUuidV7(tenantUsersRepository.tenantUsers[0].id)).toBe(true);
  });

  it('stores passwords using argon2 hash', async () => {
    const user = await useCase.execute({
      firstName: 'Breno',
      email: 'breno@example.com',
      password: 'secret123',
    });

    expect(user.passwordHash).not.toBe('secret123');
    await expect(argon2.verify(user.passwordHash, 'secret123')).resolves.toBe(
      true,
    );
  });

  it('rejects duplicate user emails', async () => {
    await useCase.execute({
      firstName: 'Breno',
      email: 'breno@example.com',
      password: 'secret123',
    });

    await expect(
      useCase.execute({
        firstName: 'Breno',
        email: 'breno@example.com',
        password: 'secret123',
      }),
    ).rejects.toMatchObject(new DomainError(409, 'USER_ALREADY_EXISTS'));
  });
});
