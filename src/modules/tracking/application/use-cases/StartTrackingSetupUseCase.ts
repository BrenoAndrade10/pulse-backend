import { Inject, Injectable } from '@nestjs/common';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { TRACKING_PIXELS_REPOSITORY } from '../../domain/repositories/TrackingPixelsRepository';
import type { TrackingPixelsRepository } from '../../domain/repositories/TrackingPixelsRepository';
import { TRACKING_SETUP_SESSION_STORE } from '../../domain/repositories/TrackingSetupSessionStore';
import type { TrackingSetupSessionStore } from '../../domain/repositories/TrackingSetupSessionStore';
import { normalizePageUrl } from '../../domain/services/pageUrl';
import { generateSetupToken } from '../../domain/services/pixelKeys';
import { requireExpert } from '../requireExpert';

export const MAX_ALLOWED_DOMAINS = 20;
/** O editor precisa abrir logo; depois disso, gera-se outro link. */
export const SETUP_SESSION_TTL_SECONDS = 10 * 60;

/**
 * Abre a página do cliente no modo de configuração. O token vai depois do
 * `#`: o navegador não o envia ao servidor do site nem no Referer.
 */
@Injectable()
export class StartTrackingSetupUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,

    @Inject(TRACKING_PIXELS_REPOSITORY)
    private readonly pixels: TrackingPixelsRepository,

    @Inject(TRACKING_SETUP_SESSION_STORE)
    private readonly sessions: TrackingSetupSessionStore,
  ) {}

  async execute(
    input: { expertId: string; url: string },
    auth: AccessTokenClaims,
  ): Promise<{ setupUrl: string }> {
    const tenantId = await requireExpert(this.experts, input.expertId, auth);
    let pixel = await this.pixels.findByExpert(tenantId, input.expertId);
    if (!pixel) throw new DomainError(404, 'TRACKING_PIXEL_NOT_FOUND');

    const page = normalizePageUrl(input.url, {
      allowLocal: Environment.vars.TRACKING_ALLOW_LOCAL_PAGES,
    });
    if (!page) {
      throw DomainError.validationFailed({
        errors: ['Use o endereço público de uma página com https://.'],
      });
    }

    if (!pixel.allowsDomain(page.domain)) {
      if (pixel.allowedDomains.length >= MAX_ALLOWED_DOMAINS) {
        throw DomainError.validationFailed({
          errors: [
            `Este pixel já tem ${MAX_ALLOWED_DOMAINS} domínios. Remova algum antes de adicionar outro.`,
          ],
        });
      }
      pixel = await this.pixels.addAllowedDomain(pixel.id, page.domain);
    }

    const token = generateSetupToken();
    await this.sessions.save(
      token,
      {
        tenantId,
        expertId: input.expertId,
        pixelId: pixel.id,
        userId: auth.userId,
        url: page.url,
      },
      SETUP_SESSION_TTL_SECONDS,
    );

    return { setupUrl: `${page.url}#pulse_setup=${token}` };
  }
}
