/* eslint-disable @typescript-eslint/unbound-method */
import { DomainError } from '../../../../../shared/errors/DomainError';
import { Expert } from '../../../../experts/domain/entities/Expert';
import { ExpertStatus } from '../../../../experts/domain/enums/ExpertStatus';
import type { ExpertsRepository } from '../../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationProvider } from '../../../../integrations/domain/enums/IntegrationProvider';
import type { IntegrationAccountsRepository } from '../../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { IntegrationCredentialsRepository } from '../../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { IntegrationTokenCipher } from '../../../../integrations/domain/services/IntegrationTokenCipher';
import {
  makeInstagramAccount,
  makeInstagramCredential,
} from '../../../../integrations/testing/integrationFixtures';
import type { InstagramMediaCache } from '../../../domain/repositories/InstagramMediaCache';
import { Environment } from '../../../../../config/Environment';
import { InstagramGraphClient } from '../../../infra/http/InstagramGraphClient';
import { InstagramMediaUrls } from '../../../infra/media/InstagramMediaUrls';
import { ListInstagramReelsUseCase } from '../ListInstagramReelsUseCase';

describe('ListInstagramReelsUseCase', () => {
  const tenantId = 'tenant-a';
  const expertId = 'expert-a';
  let experts: jest.Mocked<ExpertsRepository>;
  let credentials: jest.Mocked<IntegrationCredentialsRepository>;
  let accounts: jest.Mocked<IntegrationAccountsRepository>;
  let graph: jest.Mocked<Pick<InstagramGraphClient, 'get'>>;
  let cipher: jest.Mocked<IntegrationTokenCipher>;
  let cache: jest.Mocked<InstagramMediaCache>;
  let useCase: ListInstagramReelsUseCase;

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
      revokeActive: jest.fn(),
      findActiveWithAccessToken: jest
        .fn()
        .mockResolvedValue(makeInstagramCredential()),
      findActiveByTenantId: jest.fn(),
    };
    accounts = {
      findConnectedByExpert: jest
        .fn()
        .mockResolvedValue([makeInstagramAccount()]),
      findConnectedByExternalId: jest.fn(),
      findConnectedByTenant: jest.fn(),
    };
    graph = { get: jest.fn() };
    cipher = {
      assertConfigured: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn().mockReturnValue('plain-token'),
    };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    Environment.vars = {
      JWT_SECRET: 'test-secret-with-at-least-32-characters!',
    } as typeof Environment.vars;
    useCase = new ListInstagramReelsUseCase(
      graph as unknown as InstagramGraphClient,
      experts,
      credentials,
      accounts,
      cipher,
      cache,
      new InstagramMediaUrls(),
    );
  });

  it('uses only the active credential scoped to tenant and expert', async () => {
    graph.get.mockResolvedValue({
      data: [{ id: 'post-1', media_type: 'IMAGE', like_count: 4 }],
      paging: {
        cursors: { after: 'next-cursor' },
        next: 'https://graph.example/media?access_token=must-not-leak',
      },
    });

    const result = await useCase.execute({
      tenantId,
      expertId,
      limit: 10,
    });

    expect(experts.findByTenantIdAndId).toHaveBeenCalledWith(
      tenantId,
      expertId,
    );
    expect(credentials.findActiveWithAccessToken).toHaveBeenCalledWith(
      tenantId,
      expertId,
      IntegrationProvider.INSTAGRAM,
    );
    expect(cipher.decrypt).toHaveBeenCalledWith(
      { encryptedValue: 'value', iv: 'iv', authTag: 'tag' },
      {
        tenantId,
        expertId,
        credentialId: 'credential-a',
        provider: IntegrationProvider.INSTAGRAM,
        purpose: 'access_token',
      },
    );
    expect(graph.get).toHaveBeenCalledWith(
      '/ig-user/media',
      expect.objectContaining({ limit: 10 }),
      'plain-token',
    );
    expect(result.data).toEqual([
      expect.objectContaining({ id: 'post-1', mediaType: 'IMAGE' }),
    ]);
    expect(result.paging).toEqual({ after: 'next-cursor' });
    expect(JSON.stringify(result)).not.toContain('access_token');
  });

  it('hides experts from another tenant', async () => {
    experts.findByTenantIdAndId.mockResolvedValue(null);

    await expect(useCase.execute({ tenantId, expertId })).rejects.toMatchObject(
      { statusCode: 404, reason: 'EXPERT_NOT_FOUND' },
    );
    expect(graph.get).not.toHaveBeenCalled();
  });

  it('reports when Instagram is not connected', async () => {
    credentials.findActiveWithAccessToken.mockResolvedValue(null);

    await expect(useCase.execute({ tenantId, expertId })).rejects.toMatchObject(
      {
        statusCode: 409,
        reason: 'INSTAGRAM_NOT_CONNECTED',
      },
    );
  });

  it('ignores an account that belongs to another credential', async () => {
    accounts.findConnectedByExpert.mockResolvedValue([
      makeInstagramAccount({ credentialId: 'old-credential' }),
    ]);

    await expect(useCase.execute({ tenantId, expertId })).rejects.toMatchObject(
      { statusCode: 409, reason: 'INSTAGRAM_NOT_CONNECTED' },
    );
    expect(graph.get).not.toHaveBeenCalled();
  });

  it('does not call Meta with an expired token', async () => {
    credentials.findActiveWithAccessToken.mockResolvedValue(
      makeInstagramCredential({ tokenExpiresAt: new Date(Date.now() - 1_000) }),
    );

    await expect(
      useCase.execute({ tenantId, expertId }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(graph.get).not.toHaveBeenCalled();
  });

  it('serves a cached page without calling Meta or decrypting the token', async () => {
    cache.get.mockResolvedValue({
      data: [{ id: 'cached-post', mediaType: 'IMAGE' }],
      after: 'cursor',
    });

    const result = await useCase.execute({ tenantId, expertId });

    expect(result.data).toEqual([{ id: 'cached-post', mediaType: 'IMAGE' }]);
    expect(result.paging).toEqual({ after: 'cursor' });
    expect(graph.get).not.toHaveBeenCalled();
    expect(cipher.decrypt).not.toHaveBeenCalled();
  });

  it('caches the page per credential, without the token', async () => {
    graph.get.mockResolvedValue({
      data: [{ id: 'post-1', media_type: 'IMAGE' }],
      paging: { cursors: { after: 'next' } },
    });

    await useCase.execute({ tenantId, expertId, limit: 10 });

    const [key, page] = cache.set.mock.calls[0];
    expect(key).toMatch(/^credential-a:10:[0-9a-f]{32}$/);
    expect(page).toEqual({
      data: [expect.objectContaining({ id: 'post-1' })],
      after: 'next',
    });
    expect(JSON.stringify(page)).not.toContain('plain-token');
  });

  it('returns carousel items in camelCase, with video thumbnails', async () => {
    graph.get.mockResolvedValue({
      data: [
        {
          id: 'carousel-1',
          media_type: 'CAROUSEL_ALBUM',
          children: {
            data: [
              { id: 'c1', media_type: 'IMAGE', media_url: 'https://cdn/1.jpg' },
              {
                id: 'c2',
                media_type: 'VIDEO',
                media_url: 'https://cdn/2.mp4',
                thumbnail_url: 'https://cdn/2.jpg',
              },
            ],
          },
        },
      ],
    });

    const result = await useCase.execute({ tenantId, expertId });

    expect(graph.get).toHaveBeenCalledWith(
      '/ig-user/media',
      expect.objectContaining({
        fields: expect.stringContaining(
          'children{id,media_type,media_url,thumbnail_url}',
        ) as string,
      }),
      'plain-token',
    );
    expect(result.data[0].children).toEqual([
      { id: 'c1', mediaType: 'IMAGE', mediaUrl: 'https://cdn/1.jpg' },
      {
        id: 'c2',
        mediaType: 'VIDEO',
        mediaUrl: 'https://cdn/2.mp4',
        thumbnailUrl: 'https://cdn/2.jpg',
      },
    ]);
  });

  it('serves Meta CDN media through the signed proxy, caching the original URL', async () => {
    const cdn = 'https://scontent-gru1-1.cdninstagram.com/v/t51/photo.jpg?oe=1';
    graph.get.mockResolvedValue({
      data: [{ id: 'post-1', media_type: 'IMAGE', media_url: cdn }],
    });

    const result = await useCase.execute({ tenantId, expertId });

    expect(result.data[0].mediaUrl).toMatch(
      /^\/meta\/media\?u=[\w-]+&e=\d+&s=[\w-]+$/,
    );
    expect(result.data[0].mediaUrl).not.toContain('cdninstagram');
    const [, cachedPage] = cache.set.mock.calls[0];
    expect(cachedPage.data[0]).toMatchObject({ mediaUrl: cdn });
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
