import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { TrackingRule } from '../../domain/entities/TrackingRule';
import { TRACKING_PIXELS_REPOSITORY } from '../../domain/repositories/TrackingPixelsRepository';
import type { TrackingPixelsRepository } from '../../domain/repositories/TrackingPixelsRepository';
import { TRACKING_RULES_REPOSITORY } from '../../domain/repositories/TrackingRulesRepository';
import type { TrackingRulesRepository } from '../../domain/repositories/TrackingRulesRepository';
import { TRACKING_SETUP_SESSION_STORE } from '../../domain/repositories/TrackingSetupSessionStore';
import type { TrackingSetupSessionStore } from '../../domain/repositories/TrackingSetupSessionStore';
import { pageOf } from '../pageOf';
import { resolveSetupSession } from '../resolveSetupSession';

/** O que o editor precisa ao abrir: o pixel e as regras que valem na página. */
@Injectable()
export class OpenTrackingSetupUseCase {
  constructor(
    @Inject(TRACKING_SETUP_SESSION_STORE)
    private readonly sessions: TrackingSetupSessionStore,

    @Inject(TRACKING_PIXELS_REPOSITORY)
    private readonly pixels: TrackingPixelsRepository,

    @Inject(TRACKING_RULES_REPOSITORY)
    private readonly rules: TrackingRulesRepository,
  ) {}

  async execute(input: {
    token?: string;
    origin?: string;
  }): Promise<{ publicKey: string; pageUrl: string; rules: TrackingRule[] }> {
    const session = await resolveSetupSession(
      this.sessions,
      input.token,
      input.origin,
    );
    const pixel = await this.pixels.findByExpert(
      session.tenantId,
      session.expertId,
    );
    if (!pixel || pixel.id !== session.pixelId) {
      throw new DomainError(401, 'TRACKING_SETUP_SESSION_INVALID');
    }

    const pageUrl = pageOf(session.url);
    return {
      publicKey: pixel.publicKey,
      pageUrl,
      rules: await this.rules.findForPage(pixel.id, pageUrl),
    };
  }
}
