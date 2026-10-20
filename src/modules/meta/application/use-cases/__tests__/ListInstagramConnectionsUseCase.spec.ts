/* eslint-disable @typescript-eslint/unbound-method */
import { IntegrationAccountType } from '../../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationProvider } from '../../../../integrations/domain/enums/IntegrationProvider';
import type { IntegrationAccountsRepository } from '../../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { IntegrationCredentialsRepository } from '../../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import {
  makeInstagramAccount,
  makeInstagramCredential,
} from '../../../../integrations/testing/integrationFixtures';
import { ListInstagramConnectionsUseCase } from '../ListInstagramConnectionsUseCase';

describe('ListInstagramConnectionsUseCase', () => {
  const tenantId = 'tenant-a';
  let credentials: jest.Mocked<IntegrationCredentialsRepository>;
  let accounts: jest.Mocked<IntegrationAccountsRepository>;
  let useCase: ListInstagramConnectionsUseCase;

  beforeEach(() => {
    credentials = {
      replaceActive: jest.fn(),
      revokeActive: jest.fn(),
      findActiveWithAccessToken: jest.fn(),
      findActiveByTenantId: jest
        .fn()
        .mockResolvedValue([makeInstagramCredential()]),
    };
    accounts = {
      findConnectedByExpert: jest.fn(),
      findConnectedByExternalId: jest.fn(),
      findConnectedByTenant: jest
        .fn()
        .mockResolvedValue([makeInstagramAccount()]),
    };
    useCase = new ListInstagramConnectionsUseCase(credentials, accounts);
  });

  it('returns the connected accounts of the tenant without tokens', async () => {
    const connectedAt = new Date('2026-10-01T12:00:00.000Z');
    const tokenExpiresAt = new Date(Date.now() + 86_400_000);
    credentials.findActiveByTenantId.mockResolvedValue([
      makeInstagramCredential({ tokenExpiresAt }),
    ]);
    accounts.findConnectedByTenant.mockResolvedValue([
      makeInstagramAccount({ connectedAt, displayName: 'expert.a' }),
    ]);

    const result = await useCase.execute({ tenantId });

    expect(credentials.findActiveByTenantId).toHaveBeenCalledWith(
      tenantId,
      IntegrationProvider.INSTAGRAM,
    );
    expect(accounts.findConnectedByTenant).toHaveBeenCalledWith(
      tenantId,
      IntegrationProvider.INSTAGRAM,
    );
    expect(result).toEqual([
      {
        expertId: 'expert-a',
        status: 'connected',
        username: 'expert.a',
        connectedAt,
        expiresAt: tokenExpiresAt,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('value');
  });

  it('marks accounts whose credential token expired as expired', async () => {
    credentials.findActiveByTenantId.mockResolvedValue([
      makeInstagramCredential({ tokenExpiresAt: new Date(Date.now() - 1_000) }),
    ]);

    const [connection] = await useCase.execute({ tenantId });

    expect(connection.status).toBe('expired');
  });

  it('treats a credential without expiration as connected', async () => {
    credentials.findActiveByTenantId.mockResolvedValue([
      makeInstagramCredential({ tokenExpiresAt: undefined }),
    ]);
    accounts.findConnectedByTenant.mockResolvedValue([
      makeInstagramAccount({ displayName: undefined }),
    ]);

    const [connection] = await useCase.execute({ tenantId });

    expect(connection).toMatchObject({
      status: 'connected',
      username: null,
      expiresAt: null,
    });
  });

  it('ignores accounts without an active credential', async () => {
    accounts.findConnectedByTenant.mockResolvedValue([
      makeInstagramAccount({ credentialId: 'revoked-credential' }),
    ]);

    await expect(useCase.execute({ tenantId })).resolves.toEqual([]);
  });

  it('ignores accounts that are not Instagram accounts', async () => {
    accounts.findConnectedByTenant.mockResolvedValue([
      makeInstagramAccount({ type: IntegrationAccountType.PIXEL }),
    ]);

    await expect(useCase.execute({ tenantId })).resolves.toEqual([]);
  });

  it('requires a tenant', async () => {
    await expect(useCase.execute({ tenantId: null })).rejects.toMatchObject({
      statusCode: 403,
      reason: 'TENANT_REQUIRED',
    });
    expect(credentials.findActiveByTenantId).not.toHaveBeenCalled();
  });
});
