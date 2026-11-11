import { Link } from '../../domain/entities/Link';
import { LinkOrmEntity } from '../entities/LinkOrmEntity';

export class LinkMapper {
  static toDomain(entity: LinkOrmEntity): Link {
    return new Link({
      id: entity.id,
      tenantId: entity.tenantId,
      expertId: entity.expertId,
      launchId: entity.launchId,
      name: entity.name,
      destinationUrl: entity.destinationUrl,
      code: entity.code,
      channel: entity.channel,
      placement: entity.placement,
      campaign: entity.campaign,
      utmSource: entity.utmSource,
      utmMedium: entity.utmMedium,
      utmCampaign: entity.utmCampaign,
      utmContent: entity.utmContent,
      utmTerm: entity.utmTerm,
      purpose: entity.purpose,
      status: entity.status,
      destinationVersion: entity.destinationVersion,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    });
  }

  static toPersistence(link: Link): LinkOrmEntity {
    const entity = new LinkOrmEntity();
    entity.id = link.id;
    entity.tenantId = link.tenantId;
    entity.expertId = link.expertId;
    entity.launchId = link.launchId;
    entity.name = link.name;
    entity.destinationUrl = link.destinationUrl;
    entity.code = link.code;
    entity.channel = link.channel;
    entity.placement = link.placement;
    entity.campaign = link.campaign;
    entity.utmSource = link.utmSource;
    entity.utmMedium = link.utmMedium;
    entity.utmCampaign = link.utmCampaign;
    entity.utmContent = link.utmContent;
    entity.utmTerm = link.utmTerm;
    entity.purpose = link.purpose;
    entity.status = link.status;
    entity.destinationVersion = link.destinationVersion;
    entity.createdBy = link.createdBy;
    entity.createdAt = link.createdAt;
    entity.updatedAt = link.updatedAt;
    entity.deletedAt = link.deletedAt;
    return entity;
  }
}
