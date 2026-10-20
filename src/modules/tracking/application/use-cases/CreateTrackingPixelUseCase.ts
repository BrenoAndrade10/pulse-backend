import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { TrackingPixel } from '../../domain/entities/TrackingPixel';
import { TRACKING_PIXELS_REPOSITORY } from '../../domain/repositories/TrackingPixelsRepository';
import type { TrackingPixelsRepository } from '../../domain/repositories/TrackingPixelsRepository';
import { generatePixelKey } from '../../domain/services/pixelKeys';
import { requireExpert } from '../requireExpert';

@Injectable()
export class CreateTrackingPixelUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,

    @Inject(TRACKING_PIXELS_REPOSITORY)
    private readonly pixels: TrackingPixelsRepository,

    @Inject(ID_GENERATOR)
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    expertId: string,
    auth: AccessTokenClaims,
  ): Promise<TrackingPixel> {
    const tenantId = await requireExpert(this.experts, expertId, auth);
    const existing = await this.pixels.findByExpert(tenantId, expertId);
    if (existing) return existing;

    const now = new Date();
    return this.pixels.createForExpert(
      new TrackingPixel({
        id: this.ids.generate(),
        tenantId,
        expertId,
        publicKey: generatePixelKey(),
        allowedDomains: [],
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
}
