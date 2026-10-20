/* eslint-disable @typescript-eslint/unbound-method */
import { Expert } from '../../../../experts/domain/entities/Expert';
import { ExpertStatus } from '../../../../experts/domain/enums/ExpertStatus';
import type { ExpertsRepository } from '../../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationProvider } from '../../../../integrations/domain/enums/IntegrationProvider';
import type { IntegrationCredentialsRepository } from '../../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import { RevokeInstagramConnectionUseCase } from '../RevokeInstagramConnectionUseCase';

describe('RevokeInstagramConnectionUseCase', () => {
  const tenantId = 'tenant-a';
  const expertId = 'expert-a';
  let experts: jest.Mocked<ExpertsRepository>;
  let credentials: jest.Mocked<IntegrationCredentialsRepository>;
  let useCase: RevokeInstagramConnectionUseCase;

  beforeEach(() => {
    experts = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByTenantIdAndId: jest.fn().mockResolvedValue(makeExpert()),
      findByTenantIdAndEmail: jest.fn(),
      findByTenantId: jest.fn(),
      deleteByTenantIdAndId: jest.fn(),
    };
    credentials = {
      replaceActive: jest.fn(),
      revokeActive: jest.fn().mockResolvedValue(true),
      findActiveWithAccessToken: jest.fn(),
      findActiveByTenantId: jest.fn(),
    };
    useCase = new RevokeInstagramConnectionUseCase(experts, credentials);
  });

  it('revokes the active credential of the expert in the tenant', async () => {
    await useCase.execute({ tenantId, expertId });

    expect(experts.findByTenantIdAndId).toHaveBeenCalledWith(
      tenantId,
      expertId,
    );
    expect(credentials.revokeActive).toHaveBeenCalledWith(
      tenantId,
      expertId,
      IntegrationProvider.INSTAGRAM,
      expect.any(Date),
    );
  });

  it('is idempotent when nothing is connected', async () => {
    credentials.revokeActive.mockResolvedValue(false);

    await expect(
      useCase.execute({ tenantId, expertId }),
    ).resolves.toBeUndefined();
  });

  it('hides experts from another tenant', async () => {
    experts.findByTenantIdAndId.mockResolvedValue(null);

    await expect(useCase.execute({ tenantId, expertId })).rejects.toMatchObject(
      { statusCode: 404, reason: 'EXPERT_NOT_FOUND' },
    );
    expect(credentials.revokeActive).not.toHaveBeenCalled();
  });

  it('requires a tenant', async () => {
    await expect(
      useCase.execute({ tenantId: null, expertId }),
    ).rejects.toMatchObject({ statusCode: 403, reason: 'TENANT_REQUIRED' });
    expect(experts.findByTenantIdAndId).not.toHaveBeenCalled();
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
