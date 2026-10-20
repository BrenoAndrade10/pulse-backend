import { Injectable } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import type { TrackingPixel } from '../../domain/entities/TrackingPixel';
import type { TrackingPixelsRepository } from '../../domain/repositories/TrackingPixelsRepository';
import { TrackingPixelOrmEntity } from '../entities/TrackingPixelOrmEntity';
import { TrackingPixelMapper } from '../mappers/TrackingPixelMapper';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmTrackingPixelsRepository implements TrackingPixelsRepository {
  constructor(
    private readonly repository: Repository<TrackingPixelOrmEntity>,
  ) {}

  async findByExpert(
    tenantId: string,
    expertId: string,
  ): Promise<TrackingPixel | null> {
    const entity = await this.repository.findOne({
      where: { tenantId, expertId },
    });

    return entity ? TrackingPixelMapper.toDomain(entity) : null;
  }

  async findByPublicKey(publicKey: string): Promise<TrackingPixel | null> {
    const entity = await this.repository.findOne({ where: { publicKey } });
    return entity ? TrackingPixelMapper.toDomain(entity) : null;
  }

  async touchLastEvent(pixelId: string): Promise<void> {
    await this.repository.query(
      `
        UPDATE "tracking_pixels"
        SET "lastEventAt" = timezone('utc', now())
        WHERE "id" = $1
          AND ("lastEventAt" IS NULL OR "lastEventAt" < timezone('utc', now()) - interval '1 minute')
      `,
      [pixelId],
    );
  }

  async createForExpert(pixel: TrackingPixel): Promise<TrackingPixel> {
    try {
      await this.repository.insert(TrackingPixelMapper.toPersistence(pixel));
      return pixel;
    } catch (error) {
      // Outro pedido criou o pixel deste expert no mesmo instante.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        const existing = await this.findByExpert(
          pixel.tenantId,
          pixel.expertId,
        );
        if (existing) return existing;
      }

      throw error;
    }
  }

  async addAllowedDomain(
    pixelId: string,
    domain: string,
  ): Promise<TrackingPixel> {
    // Uma instrução só: dois pedidos simultâneos não apagam o domínio um do outro.
    await this.repository.query(
      `
        UPDATE "tracking_pixels"
        SET "allowedDomains" = CASE
              WHEN "allowedDomains" ? $2 THEN "allowedDomains"
              ELSE "allowedDomains" || to_jsonb($2::text)
            END,
            "updatedAt" = timezone('utc', now())
        WHERE "id" = $1
      `,
      [pixelId, domain],
    );

    const entity = await this.repository.findOneOrFail({
      where: { id: pixelId },
    });

    return TrackingPixelMapper.toDomain(entity);
  }
}
