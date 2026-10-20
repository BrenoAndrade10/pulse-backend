import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { TRACKING_PAGES_REPOSITORY } from '../../domain/repositories/TrackingPagesRepository';
import type { TrackingPagesRepository } from '../../domain/repositories/TrackingPagesRepository';
import { TRACKING_PIXELS_REPOSITORY } from '../../domain/repositories/TrackingPixelsRepository';
import type { TrackingPixelsRepository } from '../../domain/repositories/TrackingPixelsRepository';
import { pageOf } from '../pageOf';
import { requireExpert } from '../requireExpert';

/** A qual lançamento os cadastros de uma página pertencem (`null` tira). */
@Injectable()
export class SetTrackingPageLaunchUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,

    @Inject(TRACKING_PIXELS_REPOSITORY)
    private readonly pixels: TrackingPixelsRepository,

    @Inject(TRACKING_PAGES_REPOSITORY)
    private readonly pages: TrackingPagesRepository,

    @Inject(ID_GENERATOR)
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: { expertId: string; url: string; launchId: string | null },
    auth: AccessTokenClaims,
  ): Promise<void> {
    const tenantId = await requireExpert(this.experts, input.expertId, auth);
    const pixel = await this.pixels.findByExpert(tenantId, input.expertId);
    if (!pixel) throw new DomainError(404, 'TRACKING_PIXEL_NOT_FOUND');

    let pageUrl: string;
    try {
      pageUrl = pageOf(input.url);
    } catch {
      throw DomainError.validationFailed({ errors: ['Página inválida.'] });
    }

    if (
      input.launchId &&
      !(await this.pages.launchBelongsToExpert(
        tenantId,
        input.expertId,
        input.launchId,
      ))
    ) {
      throw new DomainError(404, 'LAUNCH_NOT_FOUND');
    }

    await this.pages.setLaunch({
      id: this.ids.generate(),
      tenantId,
      expertId: input.expertId,
      pixelId: pixel.id,
      pageUrl,
      launchId: input.launchId,
    });
  }
}
