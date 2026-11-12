import { UserRole } from '../../../users/domain/enums/UserRole';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Link } from '../../domain/entities/Link';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import { LinkStatus } from '../../domain/enums/LinkStatus';
import { UpdateLinkUseCase } from './UpdateLinkUseCase';

const tenantId = 'tenant-id';
const auth = {
  userId: 'user-id',
  sessionId: 'session-id',
  tenantId,
  role: UserRole.ADMIN,
} as never;
const expertId = '018f0f9f-6d25-7d9d-8cb8-3f2b1e9c4a6d';
const launchId = '018f0fa0-7f33-7c3a-9a44-2d8e5b6c1f20';

function link(overrides: Partial<ConstructorParameters<typeof Link>[0]> = {}) {
  return new Link({
    id: '018f0fb0-7f33-7c3a-9a44-2d8e5b6c1f20',
    tenantId,
    expertId: null,
    launchId: null,
    name: 'Link original',
    destinationUrl: 'https://example.com',
    code: 'abcdefgh',
    channel: LinkChannel.INSTAGRAM,
    placement: 'bio',
    campaign: 'campanha',
    utmSource: 'instagram',
    utmMedium: 'social',
    utmCampaign: 'campanha',
    utmContent: 'link-original',
    utmTerm: null,
    purpose: LinkPurpose.CONTENT,
    status: LinkStatus.ACTIVE,
    destinationVersion: 1,
    createdBy: 'creator',
    createdAt: new Date('2026-11-10T12:00:00.000Z'),
    updatedAt: new Date('2026-11-10T12:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  });
}

function setup(current = link()) {
  const links = {
    findByTenantIdAndId: jest.fn().mockResolvedValue(current),
    updateByTenant: jest.fn(),
  };
  const experts = { findByTenantIdAndId: jest.fn() };
  const launches = { findByTenantIdAndId: jest.fn() };
  const normalizer = { normalize: jest.fn((value: string) => value) };
  const utmBuilder = {
    normalize: jest.fn(
      (value: string | null | undefined) =>
        value?.toLowerCase().replaceAll(' ', '-') ?? null,
    ),
    build: jest.fn().mockReturnValue({
      source: 'instagram',
      medium: 'bio',
      campaign: 'nova',
      content: 'link-novo',
      term: null,
    }),
  };
  const shortUrlBuilder = {
    build: jest.fn().mockReturnValue('https://api.example.com/l/abcdefgh'),
  };
  const redirectCache = { invalidate: jest.fn() };
  links.updateByTenant.mockImplementation(
    (_tenant: string, _id: string, update: object) => current.with(update),
  );
  return {
    useCase: new UpdateLinkUseCase(
      links as never,
      experts as never,
      launches as never,
      normalizer as never,
      utmBuilder as never,
      shortUrlBuilder as never,
      redirectCache as never,
    ),
    links,
    experts,
    launches,
    normalizer,
    utmBuilder,
    redirectCache,
  };
}

describe('UpdateLinkUseCase', () => {
  it('scopes the lookup and update to the authenticated tenant', async () => {
    const context = setup();
    await context.useCase.execute(
      'link-id',
      { status: LinkStatus.INACTIVE } as never,
      auth,
    );
    expect(context.links.findByTenantIdAndId).toHaveBeenCalledWith(
      tenantId,
      'link-id',
    );
    expect(context.links.updateByTenant).toHaveBeenCalledWith(
      tenantId,
      'link-id',
      expect.objectContaining({ status: LinkStatus.INACTIVE }),
    );
  });

  it('increments destination version only when the normalized destination changes', async () => {
    const context = setup();
    context.normalizer.normalize
      .mockReturnValueOnce('https://example.com')
      .mockReturnValueOnce('https://other.example.com');
    await context.useCase.execute(
      'link-id',
      { destinationUrl: 'same' } as never,
      auth,
    );
    await context.useCase.execute(
      'link-id',
      { destinationUrl: 'other' } as never,
      auth,
    );
    expect(context.links.updateByTenant.mock.calls[0][2]).toEqual(
      expect.objectContaining({ destinationVersion: 1 }),
    );
    expect(context.links.updateByTenant.mock.calls[1][2]).toEqual(
      expect.objectContaining({ destinationVersion: 2 }),
    );
  });

  it('preserves existing utms unless regeneration is requested and applies overrides', async () => {
    const context = setup();
    await context.useCase.execute(
      'link-id',
      { status: LinkStatus.ACTIVE } as never,
      auth,
    );
    expect(context.utmBuilder.build).not.toHaveBeenCalled();
    await context.useCase.execute(
      'link-id',
      { regenerateUtm: true, utm: { term: 'VIP' } },
      auth,
    );
    expect(context.utmBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({ overrides: { term: 'VIP' } }),
    );
  });

  it('clears nullable utm fields and keeps campaign synchronized', async () => {
    const context = setup();
    await context.useCase.execute(
      'link-id',
      {
        campaign: 'Nova campanha',
        utm: { content: null },
        regenerateUtm: false,
      },
      auth,
    );
    expect(context.links.updateByTenant).toHaveBeenCalledWith(
      tenantId,
      'link-id',
      expect.objectContaining({
        campaign: 'nova-campanha',
        utmCampaign: 'nova-campanha',
        utmContent: null,
      }),
    );
  });

  it('validates changed relationships in parallel and rejects an invalid launch', async () => {
    const context = setup();
    context.experts.findByTenantIdAndId.mockResolvedValue({ id: expertId });
    context.launches.findByTenantIdAndId.mockResolvedValue({
      id: launchId,
      expertId: 'other-expert',
    });
    await expect(
      context.useCase.execute('link-id', { expertId, launchId } as never, auth),
    ).rejects.toMatchObject({ reason: 'LAUNCH_NOT_FOUND' });
    expect(context.experts.findByTenantIdAndId).toHaveBeenCalledWith(
      tenantId,
      expertId,
    );
    expect(context.launches.findByTenantIdAndId).toHaveBeenCalledWith(
      tenantId,
      launchId,
    );
  });

  it('returns link not found when the update affects no row', async () => {
    const context = setup();
    context.links.updateByTenant.mockResolvedValue(null);
    await expect(
      context.useCase.execute(
        'link-id',
        { status: LinkStatus.INACTIVE } as never,
        auth,
      ),
    ).rejects.toMatchObject({ reason: 'LINK_NOT_FOUND' });
  });

  it('propagates destination normalization errors', async () => {
    const context = setup();
    const error = new DomainError(400, 'LINK_DESTINATION_INSECURE');
    context.normalizer.normalize.mockImplementation(() => {
      throw error;
    });
    await expect(
      context.useCase.execute(
        'link-id',
        { destinationUrl: 'http://x' } as never,
        auth,
      ),
    ).rejects.toBe(error);
    expect(context.links.updateByTenant).not.toHaveBeenCalled();
  });
});
