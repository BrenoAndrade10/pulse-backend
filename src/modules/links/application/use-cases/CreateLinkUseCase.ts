import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { LAUNCHES_REPOSITORY } from '../../../launches/domain/repositories/LaunchesRepository';
import type { LaunchesRepository } from '../../../launches/domain/repositories/LaunchesRepository';
import { requireTenant } from '../../../experts/application/ExpertAuthorization';
import { DestinationUrlNormalizer } from '../services/DestinationUrlNormalizer';
import { LinkShortUrlBuilder } from '../services/LinkShortUrlBuilder';
import { LinkUtmBuilder } from '../services/LinkUtmBuilder';
import { Link } from '../../domain/entities/Link';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkStatus } from '../../domain/enums/LinkStatus';
import { LINK_CODE_GENERATOR } from '../../domain/services/LinkCodeGenerator';
import type { LinkCodeGenerator } from '../../domain/services/LinkCodeGenerator';
import { LINKS_REPOSITORY } from '../../domain/repositories/LinksRepository';
import type { LinksRepository } from '../../domain/repositories/LinksRepository';
import type { CreateLinkInput } from '../../presentation/schemas/LinkSchemas';

export type CreateLinkOutput = {
  link: Link;
  shortUrl: string;
};

@Injectable()
export class CreateLinkUseCase {
  constructor(
    @Inject(LINKS_REPOSITORY) private readonly links: LinksRepository,
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
    @Inject(LAUNCHES_REPOSITORY) private readonly launches: LaunchesRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(LINK_CODE_GENERATOR) private readonly codes: LinkCodeGenerator,
    private readonly destinationNormalizer: DestinationUrlNormalizer,
    private readonly utmBuilder: LinkUtmBuilder,
    private readonly shortUrlBuilder: LinkShortUrlBuilder,
  ) {}

  async execute(
    input: CreateLinkInput,
    auth: AccessTokenClaims,
  ): Promise<CreateLinkOutput> {
    const tenantId = requireTenant(auth);
    const channel = input.channel ?? LinkChannel.OTHER;
    const destinationUrl = this.destinationNormalizer.normalize(
      input.destinationUrl,
    );

    const [expert, launch] = await Promise.all([
      input.expertId
        ? this.experts.findByTenantIdAndId(tenantId, input.expertId)
        : Promise.resolve(null),
      input.launchId
        ? this.launches.findByTenantIdAndId(tenantId, input.launchId)
        : Promise.resolve(null),
    ]);

    if (input.expertId && !expert) {
      throw DomainError.expertNotFound();
    }
    if (input.launchId && (!launch || launch.expertId !== input.expertId)) {
      throw DomainError.launchNotFound();
    }

    const utm = this.utmBuilder.build({
      channel,
      placement: input.placement,
      campaign: input.campaign,
      linkName: input.name,
      launchName: launch?.name,
      overrides: input.utm,
    });

    const id = this.ids.generate();
    const now = new Date();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const length = Math.min(16, 8 + Math.floor(attempt / 3));

      const link = new Link({
        id,
        tenantId,
        expertId: input.expertId ?? null,
        launchId: input.launchId ?? null,
        name: input.name,
        destinationUrl,
        code: this.codes.generate(length),
        channel,
        placement: input.placement ?? null,
        campaign: utm.campaign,
        utmSource: utm.source,
        utmMedium: utm.medium,
        utmCampaign: utm.campaign,
        utmContent: utm.content,
        utmTerm: utm.term,
        purpose: input.purpose ?? LinkPurpose.OTHER,
        status: LinkStatus.ACTIVE,
        destinationVersion: 1,
        createdBy: auth.userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      const created = await this.links.tryCreate(link);

      if (created) {
        return {
          link: created,
          shortUrl: this.shortUrlBuilder.build(created.code),
        };
      }
    }

    throw DomainError.linkCodeGenerationFailed();
  }
}
