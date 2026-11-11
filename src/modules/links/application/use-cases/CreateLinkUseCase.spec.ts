import { UserRole } from '../../../users/domain/enums/UserRole';
import { DomainError } from '../../../../shared/errors/DomainError';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import { Link } from '../../domain/entities/Link';
import { CreateLinkUseCase } from './CreateLinkUseCase';

const tenantId = 'tenant-id';
const userId = 'user-id';
const expertId = 'expert-id';
const launchId = 'launch-id';

function input(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Link de oferta',
    destinationUrl: 'https://example.com/oferta',
    channel: LinkChannel.INSTAGRAM,
    purpose: LinkPurpose.OFFER,
    placement: 'bio',
    campaign: 'oferta',
    ...overrides,
  } as never;
}

function auth() {
  return {
    userId,
    sessionId: 'session-id',
    tenantId,
    role: UserRole.ADMIN,
  } as never;
}

function link(overrides: Partial<ConstructorParameters<typeof Link>[0]> = {}) {
  return new Link({
    id: 'link-id',
    tenantId,
    expertId: null,
    launchId: null,
    name: 'Link de oferta',
    destinationUrl: 'https://example.com/oferta',
    code: 'abcdefgh',
    channel: LinkChannel.INSTAGRAM,
    placement: 'bio',
    campaign: 'oferta',
    utmSource: 'instagram',
    utmMedium: 'bio',
    utmCampaign: 'oferta',
    utmContent: 'bio',
    utmTerm: null,
    purpose: LinkPurpose.OFFER,
    status: 'active' as never,
    destinationVersion: 1,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
}

function setup() {
  const links = { tryCreate: jest.fn() };
  const experts = { findByTenantIdAndId: jest.fn() };
  const launches = { findByTenantIdAndId: jest.fn() };
  const ids = { generate: jest.fn().mockReturnValue('link-id') };
  const codes = { generate: jest.fn().mockReturnValue('abcdefgh') };
  const normalizer = {
    normalize: jest.fn().mockReturnValue('https://example.com/oferta'),
  };
  const utmBuilder = {
    build: jest.fn().mockReturnValue({
      source: 'instagram',
      medium: 'social',
      campaign: 'oferta',
      content: 'link-de-oferta',
      term: null,
    }),
  };
  const shortUrlBuilder = {
    build: jest.fn().mockReturnValue('https://api.example.com/l/abcdefgh'),
  };
  const useCase = new CreateLinkUseCase(
    links as never,
    experts as never,
    launches as never,
    ids,
    codes,
    normalizer as never,
    utmBuilder as never,
    shortUrlBuilder as never,
  );

  links.tryCreate.mockResolvedValue(link());
  return {
    useCase,
    links,
    experts,
    launches,
    ids,
    codes,
    normalizer,
    utmBuilder,
    shortUrlBuilder,
  };
}

describe('CreateLinkUseCase', () => {
  it('creates without lookups when expert and launch are absent', async () => {
    const context = setup();

    const result = await context.useCase.execute(input(), auth());

    expect(result.shortUrl).toBe('https://api.example.com/l/abcdefgh');
    expect(context.experts.findByTenantIdAndId).not.toHaveBeenCalled();
    expect(context.launches.findByTenantIdAndId).not.toHaveBeenCalled();
    expect(context.links.tryCreate).toHaveBeenCalledTimes(1);
  });

  it('looks up expert and launch in parallel when both are provided', async () => {
    const context = setup();
    context.experts.findByTenantIdAndId.mockResolvedValue({ id: expertId });
    context.launches.findByTenantIdAndId.mockResolvedValue({
      id: launchId,
      expertId,
    });

    await context.useCase.execute(
      input({ expertId, launchId, campaign: undefined }),
      auth(),
    );

    expect(context.experts.findByTenantIdAndId).toHaveBeenCalledWith(
      tenantId,
      expertId,
    );
    expect(context.launches.findByTenantIdAndId).toHaveBeenCalledWith(
      tenantId,
      launchId,
    );
    expect(context.links.tryCreate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing expert', 'EXPERT_NOT_FOUND', { expertId }, null, null],
    ['missing launch', 'LAUNCH_NOT_FOUND', { expertId, launchId }, {}, null],
    [
      'launch from another expert',
      'LAUNCH_NOT_FOUND',
      { expertId, launchId },
      {},
      { expertId: 'other-expert' },
    ],
  ])('rejects %s', async (_, reason, values, expert, launch) => {
    const context = setup();
    context.experts.findByTenantIdAndId.mockResolvedValue(expert);
    context.launches.findByTenantIdAndId.mockResolvedValue(launch);

    await expect(
      context.useCase.execute(input(values), auth()),
    ).rejects.toMatchObject({ reason });
    expect(context.links.tryCreate).not.toHaveBeenCalled();
  });

  it('does not access persistence when normalization fails', async () => {
    const context = setup();
    const error = new DomainError(400, 'LINK_DESTINATION_BLOCKED');
    context.normalizer.normalize.mockImplementation(() => {
      throw error;
    });

    await expect(context.useCase.execute(input(), auth())).rejects.toBe(error);
    expect(context.experts.findByTenantIdAndId).not.toHaveBeenCalled();
    expect(context.launches.findByTenantIdAndId).not.toHaveBeenCalled();
    expect(context.ids.generate).not.toHaveBeenCalled();
    expect(context.codes.generate).not.toHaveBeenCalled();
    expect(context.links.tryCreate).not.toHaveBeenCalled();
  });

  it('retries collisions with a longer code after three attempts', async () => {
    const context = setup();
    context.links.tryCreate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(link({ code: 'abcdefghi' }));

    await context.useCase.execute(input(), auth());

    expect(context.codes.generate.mock.calls.map(([length]) => length)).toEqual(
      [8, 8, 8, 9],
    );
  });

  it('fails after ten code collisions', async () => {
    const context = setup();
    context.links.tryCreate.mockResolvedValue(null);

    await expect(
      context.useCase.execute(input(), auth()),
    ).rejects.toMatchObject(
      new DomainError(503, 'LINK_CODE_GENERATION_FAILED'),
    );
    expect(context.links.tryCreate).toHaveBeenCalledTimes(10);
  });

  it('uses tenant and creator from auth and passes UTM overrides', async () => {
    const context = setup();
    const values = input({
      tenantId: 'body-tenant',
      createdBy: 'body-user',
      utm: { source: 'custom-source', term: 'custom-term' },
    });

    await context.useCase.execute(values, auth());

    const created = context.links.tryCreate.mock.calls[0][0] as Link;
    expect(created.tenantId).toBe(tenantId);
    expect(created.createdBy).toBe(userId);
    expect(context.utmBuilder.build).toHaveBeenCalledWith({
      channel: LinkChannel.INSTAGRAM,
      placement: 'bio',
      campaign: 'oferta',
      linkName: 'Link de oferta',
      launchName: undefined,
      overrides: { source: 'custom-source', term: 'custom-term' },
    });
  });

  it('uses the launch name for campaign and the link name for content', async () => {
    const context = setup();
    context.experts.findByTenantIdAndId.mockResolvedValue({ id: expertId });
    context.launches.findByTenantIdAndId.mockResolvedValue({
      id: launchId,
      expertId,
      name: 'Lançamento de Outubro',
    });
    context.utmBuilder.build.mockReturnValue({
      source: 'instagram',
      medium: 'social',
      campaign: 'lancamento-de-outubro',
      content: 'link-de-oferta',
      term: null,
    });
    context.links.tryCreate.mockResolvedValue(
      link({
        campaign: 'lancamento-de-outubro',
        utmCampaign: 'lancamento-de-outubro',
        utmContent: 'link-de-oferta',
      }),
    );

    await context.useCase.execute(
      input({ expertId, launchId, campaign: undefined }),
      auth(),
    );

    expect(context.utmBuilder.build).toHaveBeenCalledWith({
      channel: LinkChannel.INSTAGRAM,
      placement: 'bio',
      campaign: undefined,
      linkName: 'Link de oferta',
      launchName: 'Lançamento de Outubro',
      overrides: undefined,
    });
    expect(context.links.tryCreate.mock.calls[0][0].campaign).toBe(
      'lancamento-de-outubro',
    );
  });
});
