/* eslint-disable @typescript-eslint/unbound-method */
import type { IdGenerator } from '../../../../../shared/domain/IdGenerator';
import type { AccessTokenClaims } from '../../../../auth/domain/types/AccessTokenClaims';
import { Expert } from '../../../../experts/domain/entities/Expert';
import { ExpertStatus } from '../../../../experts/domain/enums/ExpertStatus';
import type { ExpertsRepository } from '../../../../experts/domain/repositories/ExpertsRepository';
import { UserRole } from '../../../../users/domain/enums/UserRole';
import { Launch } from '../../../domain/entities/Launch';
import { LaunchStatus } from '../../../domain/enums/LaunchStatus';
import { LaunchType } from '../../../domain/enums/LaunchType';
import type { LaunchesRepository } from '../../../domain/repositories/LaunchesRepository';
import { CreateLaunchUseCase } from '../CreateLaunchUseCase';
import { DeleteLaunchUseCase } from '../DeleteLaunchUseCase';
import { UpdateLaunchUseCase } from '../UpdateLaunchUseCase';

const admin: AccessTokenClaims = {
  userId: 'user-a',
  sessionId: 'session-a',
  tenantId: 'tenant-a',
  role: UserRole.ADMIN,
};

describe('Launch use cases', () => {
  let launches: jest.Mocked<LaunchesRepository>;
  let experts: jest.Mocked<ExpertsRepository>;
  let ids: IdGenerator;

  beforeEach(() => {
    launches = {
      create: jest.fn((launch) => Promise.resolve(launch)),
      save: jest.fn((launch) => Promise.resolve(launch)),
      findByTenantIdAndId: jest.fn(),
      findByTenantId: jest.fn(),
      findByTenantIdAndExpertId: jest.fn(),
      softDeleteByTenantIdAndId: jest.fn(),
    };
    experts = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByTenantIdAndId: jest.fn().mockResolvedValue(makeExpert()),
      findByTenantIdAndEmail: jest.fn(),
      findByTenantId: jest.fn(),
      deleteByTenantIdAndId: jest.fn(),
    };
    ids = { generate: () => 'launch-a' };
  });

  it('creates a launch linked to an expert in the authenticated tenant', async () => {
    const useCase = new CreateLaunchUseCase(launches, experts, ids);

    const launch = await useCase.execute(
      { expertId: 'expert-a', slug: 'launch', name: 'Launch' },
      admin,
    );

    expect(experts.findByTenantIdAndId).toHaveBeenCalledWith(
      'tenant-a',
      'expert-a',
    );
    expect(launch.tenantId).toBe('tenant-a');
    expect(launch.expertId).toBe('expert-a');
    expect(launch.status).toBe(LaunchStatus.DRAFT);
    expect(launch.createdBy).toBe('user-a');
    expect(launch.updatedBy).toBe('user-a');
    expect(launch.version).toBe(1);
  });

  it('rejects an expert from another tenant', async () => {
    experts.findByTenantIdAndId.mockResolvedValue(null);
    const useCase = new CreateLaunchUseCase(launches, experts, ids);

    await expect(
      useCase.execute(
        { expertId: 'expert-b', slug: 'launch', name: 'Launch' },
        admin,
      ),
    ).rejects.toMatchObject({ statusCode: 404, reason: 'EXPERT_NOT_FOUND' });
    expect(launches.create).not.toHaveBeenCalled();
  });

  it('validates the resulting date range when editing', async () => {
    launches.findByTenantIdAndId.mockResolvedValue(makeLaunch());
    const useCase = new UpdateLaunchUseCase(launches, experts);

    await expect(
      useCase.execute(
        'launch-a',
        { endsAt: new Date('2026-01-01T00:00:00Z') },
        admin,
      ),
    ).rejects.toMatchObject({ statusCode: 400, reason: 'VALIDATION_FAILED' });
    expect(launches.save).not.toHaveBeenCalled();
  });

  it('blocks deletion by a non-admin member', async () => {
    const useCase = new DeleteLaunchUseCase(launches);

    await expect(
      useCase.execute('launch-a', { ...admin, role: UserRole.MEMBER }),
    ).rejects.toMatchObject({ statusCode: 403, reason: 'FORBIDDEN' });
    expect(launches.softDeleteByTenantIdAndId).not.toHaveBeenCalled();
  });

  it('soft deletes with the authenticated user for auditing', async () => {
    launches.softDeleteByTenantIdAndId.mockResolvedValue(true);
    const useCase = new DeleteLaunchUseCase(launches);

    await useCase.execute('launch-a', admin);

    expect(launches.softDeleteByTenantIdAndId).toHaveBeenCalledWith(
      'tenant-a',
      'launch-a',
      'user-a',
    );
  });
});

function makeExpert(): Expert {
  const now = new Date();
  return new Expert({
    id: 'expert-a',
    tenantId: 'tenant-a',
    name: 'Expert',
    email: 'expert@test.com',
    status: ExpertStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });
}

function makeLaunch(): Launch {
  const now = new Date();
  return new Launch({
    id: 'launch-a',
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    slug: 'launch',
    type: LaunchType.OTHER,
    name: 'Launch',
    status: LaunchStatus.PLANNED,
    startsAt: new Date('2026-02-01T00:00:00Z'),
    endsAt: new Date('2026-03-01T00:00:00Z'),
    timezone: 'America/Sao_Paulo',
    deletedAt: null,
    createdBy: 'user-a',
    updatedBy: 'user-a',
    deletedBy: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}
