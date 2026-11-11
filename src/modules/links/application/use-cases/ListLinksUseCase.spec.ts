import { UserRole } from '../../../users/domain/enums/UserRole';
import { Link } from '../../domain/entities/Link';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import { LinkStatus } from '../../domain/enums/LinkStatus';
import { encodeLinkCursor } from '../services/LinkCursor';
import { ListLinksUseCase } from './ListLinksUseCase';

const auth = {
  userId: 'user',
  sessionId: 'session',
  tenantId: 'tenant',
  role: UserRole.ADMIN,
} as never;

function link(id: string, createdAt: string) {
  return new Link({
    id,
    tenantId: 'tenant',
    expertId: null,
    launchId: null,
    name: 'Link',
    destinationUrl: 'https://example.com',
    code: 'abcdefgh',
    channel: LinkChannel.OTHER,
    placement: null,
    campaign: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    purpose: LinkPurpose.OTHER,
    status: LinkStatus.ACTIVE,
    destinationVersion: 1,
    createdBy: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    deletedAt: null,
  });
}

function setup() {
  const links = { findPage: jest.fn() };
  const shortUrlBuilder = {
    build: jest.fn((code: string) => `https://api.example.com/l/${code}`),
  };
  return {
    useCase: new ListLinksUseCase(links as never, shortUrlBuilder as never),
    links,
  };
}

describe('ListLinksUseCase', () => {
  it('uses tenant scope, requests one extra row and creates a cursor', async () => {
    const context = setup();
    const first = link(
      '018f0f9f-6d25-7d9d-8cb8-3f2b1e9c4a6d',
      '2026-11-10T12:00:00.000Z',
    );
    const second = link(
      '018f0f9f-6d25-7d9d-8cb8-3f2b1e9c4a6e',
      '2026-11-09T12:00:00.000Z',
    );
    context.links.findPage.mockResolvedValue([first, second]);

    const result = await context.useCase.execute({ limit: 1 }, auth);

    expect(context.links.findPage).toHaveBeenCalledWith({
      tenantId: 'tenant',
      limit: 2,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].shortUrl).toContain('/l/abcdefgh');
    expect(result.nextCursor).toBe(
      encodeLinkCursor({ createdAt: first.createdAt, id: first.id }),
    );
  });

  it('returns null cursor on the last page', async () => {
    const context = setup();
    context.links.findPage.mockResolvedValue([
      link('018f0f9f-6d25-7d9d-8cb8-3f2b1e9c4a6d', '2026-11-10T12:00:00.000Z'),
    ]);
    await expect(
      context.useCase.execute({ limit: 20 }, auth),
    ).resolves.toMatchObject({ nextCursor: null });
  });

  it('rejects malformed cursors before repository access', async () => {
    const context = setup();
    await expect(
      context.useCase.execute({ limit: 20, cursor: 'invalid' }, auth),
    ).rejects.toMatchObject({
      statusCode: 400,
      reason: 'VALIDATION_FAILED',
    });
    expect(context.links.findPage).not.toHaveBeenCalled();
  });
});
