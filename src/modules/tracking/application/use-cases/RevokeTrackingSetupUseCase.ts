import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { TRACKING_PIXELS_REPOSITORY } from '../../domain/repositories/TrackingPixelsRepository';
import type { TrackingPixelsRepository } from '../../domain/repositories/TrackingPixelsRepository';
import { TRACKING_SETUP_SESSION_STORE } from '../../domain/repositories/TrackingSetupSessionStore';
import type { TrackingSetupSessionStore } from '../../domain/repositories/TrackingSetupSessionStore';
import { requireExpert } from '../requireExpert';

/** Encerra todos os links de configuração abertos do pixel do expert. */
@Injectable()
export class RevokeTrackingSetupUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,

    @Inject(TRACKING_PIXELS_REPOSITORY)
    private readonly pixels: TrackingPixelsRepository,

    @Inject(TRACKING_SETUP_SESSION_STORE)
    private readonly sessions: TrackingSetupSessionStore,
  ) {}

  async execute(expertId: string, auth: AccessTokenClaims): Promise<void> {
    const tenantId = await requireExpert(this.experts, expertId, auth);
    const pixel = await this.pixels.findByExpert(tenantId, expertId);
    if (!pixel) throw new DomainError(404, 'TRACKING_PIXEL_NOT_FOUND');

    await this.sessions.revokeByPixel(pixel.id);
  }
}
