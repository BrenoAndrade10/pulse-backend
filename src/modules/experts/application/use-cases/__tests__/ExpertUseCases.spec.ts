import type { IdGenerator } from '../../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../../auth/domain/types/AccessTokenClaims';
import { UserRole } from '../../../../users/domain/enums/UserRole';
import { Expert } from '../../../domain/entities/Expert';
import { ExpertStatus } from '../../../domain/enums/ExpertStatus';
import type { ExpertsRepository } from '../../../domain/repositories/ExpertsRepository';
import { CreateExpertUseCase } from '../CreateExpertUseCase';
import { DeleteExpertUseCase } from '../DeleteExpertUseCase';
import { ListExpertsUseCase } from '../ListExpertsUseCase';
import { UpdateExpertUseCase } from '../UpdateExpertUseCase';

class InMemoryExpertsRepository implements ExpertsRepository {
  items: Expert[] = [];

  create(expert: Expert): Promise<Expert> {
    this.items.push(expert);
    return Promise.resolve(expert);
  }
  save(expert: Expert): Promise<Expert> {
    return Promise.resolve(expert);
  }
  findById(id: string): Promise<Expert | null> {
    return Promise.resolve(this.items.find((item) => item.id === id) ?? null);
  }
  findByTenantIdAndId(tenantId: string, id: string): Promise<Expert | null> {
    return Promise.resolve(
      this.items.find((item) => item.tenantId === tenantId && item.id === id) ??
        null,
    );
  }
  findByTenantIdAndEmail(
    tenantId: string,
    email: string,
  ): Promise<Expert | null> {
    return Promise.resolve(
      this.items.find(
        (item) => item.tenantId === tenantId && item.email === email,
      ) ?? null,
    );
  }
  findByTenantId(tenantId: string): Promise<Expert[]> {
    return Promise.resolve(
      this.items.filter((item) => item.tenantId === tenantId),
    );
  }
  deleteByTenantIdAndId(tenantId: string, id: string): Promise<boolean> {
    const index = this.items.findIndex(
      (item) => item.tenantId === tenantId && item.id === id,
    );
    if (index < 0) return Promise.resolve(false);
    this.items.splice(index, 1);
    return Promise.resolve(true);
  }
}

const admin: AccessTokenClaims = {
  userId: 'user',
  sessionId: 'session',
  tenantId: 'tenant-a',
  role: UserRole.ADMIN,
};
const member = { ...admin, role: UserRole.MEMBER };

describe('Expert use cases', () => {
  let repository: InMemoryExpertsRepository;

  beforeEach(() => {
    repository = new InMemoryExpertsRepository();
  });

  it('creates and lists experts only inside the authenticated tenant', async () => {
    const ids: IdGenerator = { generate: () => 'expert-a' };
    const create = new CreateExpertUseCase(repository, ids);
    const list = new ListExpertsUseCase(repository);

    await create.execute({ name: 'Expert', email: 'expert@test.com' }, admin);
    repository.items.push(expert('expert-b', 'tenant-b'));

    await expect(list.execute(admin)).resolves.toHaveLength(1);
    expect(repository.items[0].tenantId).toBe('tenant-a');
  });

  it('blocks mutations made by non-admin members', async () => {
    const create = new CreateExpertUseCase(repository, {
      generate: () => 'expert-a',
    });

    await expect(
      create.execute({ name: 'Expert', email: 'expert@test.com' }, member),
    ).rejects.toMatchObject({ statusCode: 403, reason: 'FORBIDDEN' });
  });

  it('does not update an expert from another tenant', async () => {
    repository.items.push(expert('expert-b', 'tenant-b'));
    const update = new UpdateExpertUseCase(repository);

    await expect(
      update.execute('expert-b', { name: 'Changed' }, admin),
    ).rejects.toMatchObject({
      statusCode: 404,
      reason: 'EXPERT_NOT_FOUND',
    });
    expect(repository.items[0].name).toBe('Expert');
  });

  it('rejects duplicate e-mail and scopes deletion by tenant', async () => {
    repository.items.push(expert('expert-a', 'tenant-a'));
    const create = new CreateExpertUseCase(repository, {
      generate: () => 'expert-new',
    });
    const remove = new DeleteExpertUseCase(repository);

    await expect(
      create.execute({ name: 'Other', email: 'expert@test.com' }, admin),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(remove.execute('missing', admin)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(remove.execute('expert-a', admin)).resolves.toBeUndefined();
  });
});

function expert(id: string, tenantId: string): Expert {
  const now = new Date();
  return new Expert({
    id,
    tenantId,
    name: 'Expert',
    email: 'expert@test.com',
    status: ExpertStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });
}
