import { Link } from '../../domain/entities/Link';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import { LinkStatus } from '../../domain/enums/LinkStatus';
import { LinkOrmEntity } from '../entities/LinkOrmEntity';
import { LinkMapper } from './LinkMapper';

describe('LinkMapper', () => {
  const dates = {
    createdAt: new Date('2026-11-09T12:00:00.000Z'),
    updatedAt: new Date('2026-11-09T12:01:00.000Z'),
  };

  function link(): Link {
    return new Link({
      id: 'link-id',
      tenantId: 'tenant-id',
      expertId: 'expert-id',
      launchId: 'launch-id',
      name: 'Oferta',
      destinationUrl: 'https://example.com/oferta',
      code: 'oferta1',
      channel: LinkChannel.INSTAGRAM,
      placement: 'bio',
      campaign: 'black-friday',
      utmSource: 'instagram',
      utmMedium: 'social',
      utmCampaign: 'black-friday',
      utmContent: 'bio',
      utmTerm: 'oferta',
      purpose: LinkPurpose.OFFER,
      status: LinkStatus.ACTIVE,
      destinationVersion: 1,
      createdBy: 'user-id',
      ...dates,
      deletedAt: null,
    });
  }

  it('maps all fields to persistence and back to the domain', () => {
    const entity = LinkMapper.toPersistence(link());
    const restored = LinkMapper.toDomain(entity);

    expect(entity).toBeInstanceOf(LinkOrmEntity);
    expect(restored).toMatchObject({
      id: 'link-id',
      tenantId: 'tenant-id',
      expertId: 'expert-id',
      launchId: 'launch-id',
      code: 'oferta1',
      channel: LinkChannel.INSTAGRAM,
      purpose: LinkPurpose.OFFER,
      status: LinkStatus.ACTIVE,
      destinationVersion: 1,
      createdBy: 'user-id',
      deletedAt: null,
    });
    expect(restored.createdAt).toEqual(dates.createdAt);
    expect(restored.updatedAt).toEqual(dates.updatedAt);
  });
});
