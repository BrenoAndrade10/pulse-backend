import { TrackingPixel } from '../../domain/entities/TrackingPixel';
import { TrackingPixelOrmEntity } from '../entities/TrackingPixelOrmEntity';

export class TrackingPixelMapper {
  static toDomain(entity: TrackingPixelOrmEntity): TrackingPixel {
    return new TrackingPixel({
      id: entity.id,
      tenantId: entity.tenantId,
      expertId: entity.expertId,
      publicKey: entity.publicKey,
      allowedDomains: entity.allowedDomains,
      lastEventAt: entity.lastEventAt ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(pixel: TrackingPixel): TrackingPixelOrmEntity {
    const entity = new TrackingPixelOrmEntity();

    entity.id = pixel.id;
    entity.tenantId = pixel.tenantId;
    entity.expertId = pixel.expertId;
    entity.publicKey = pixel.publicKey;
    entity.allowedDomains = pixel.allowedDomains;
    entity.lastEventAt = pixel.lastEventAt ?? null;
    entity.createdAt = pixel.createdAt;
    entity.updatedAt = pixel.updatedAt;

    return entity;
  }
}
