import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import type { TrackingPixel } from '../../domain/entities/TrackingPixel';
import { TRACKING_PAGES_REPOSITORY } from '../../domain/repositories/TrackingPagesRepository';
import type { TrackingPagesRepository } from '../../domain/repositories/TrackingPagesRepository';
import { TRACKING_RULES_REPOSITORY } from '../../domain/repositories/TrackingRulesRepository';
import type {
  TrackingPageSummary,
  TrackingRulesRepository,
} from '../../domain/repositories/TrackingRulesRepository';
import { TRACKING_PIXELS_REPOSITORY } from '../../domain/repositories/TrackingPixelsRepository';
import type { TrackingPixelsRepository } from '../../domain/repositories/TrackingPixelsRepository';
import { requireExpert } from '../requireExpert';

@Injectable()
export class GetTrackingPixelUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,

    @Inject(TRACKING_PIXELS_REPOSITORY)
    private readonly pixels: TrackingPixelsRepository,

    @Inject(TRACKING_RULES_REPOSITORY)
    private readonly rules: TrackingRulesRepository,

    @Inject(TRACKING_PAGES_REPOSITORY)
    private readonly pages: TrackingPagesRepository,
  ) {}

  async execute(
    expertId: string,
    auth: AccessTokenClaims,
  ): Promise<{ pixel: TrackingPixel; pages: TrackingPageSummary[] }> {
    const tenantId = await requireExpert(this.experts, expertId, auth);
    const pixel = await this.pixels.findByExpert(tenantId, expertId);
    if (!pixel) throw new DomainError(404, 'TRACKING_PIXEL_NOT_FOUND');
    const [summaries, launches] = await Promise.all([
      this.rules.pagesByPixel(pixel.id),
      this.pages.launchesByPage(pixel.id),
    ]);
    return {
      pixel,
      pages: summaries.map((page) => ({
        ...page,
        launchId: launches.get(page.url) ?? null,
      })),
    };
  }
}
