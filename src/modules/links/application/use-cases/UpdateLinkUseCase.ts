import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { LAUNCHES_REPOSITORY } from '../../../launches/domain/repositories/LaunchesRepository';
import type { LaunchesRepository } from '../../../launches/domain/repositories/LaunchesRepository';
import { requireTenant } from '../../../experts/application/ExpertAuthorization';
import { LinkStatus } from '../../domain/enums/LinkStatus';
import { LINKS_REPOSITORY } from '../../domain/repositories/LinksRepository';
import type { LinksRepository } from '../../domain/repositories/LinksRepository';
import { DestinationUrlNormalizer } from '../services/DestinationUrlNormalizer';
import { LinkShortUrlBuilder } from '../services/LinkShortUrlBuilder';
import { LinkUtmBuilder } from '../services/LinkUtmBuilder';
import type { UpdateLinkInput } from '../../presentation/schemas/LinkSchemas';
import type { CreateLinkOutput } from './CreateLinkUseCase';

@Injectable()
export class UpdateLinkUseCase {
  constructor(
    @Inject(LINKS_REPOSITORY) private readonly links: LinksRepository,
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
    @Inject(LAUNCHES_REPOSITORY) private readonly launches: LaunchesRepository,
    private readonly destinationNormalizer: DestinationUrlNormalizer,
    private readonly utmBuilder: LinkUtmBuilder,
    private readonly shortUrlBuilder: LinkShortUrlBuilder,
  ) {}

  async execute(
    id: string,
    input: UpdateLinkInput,
    auth: AccessTokenClaims,
  ): Promise<CreateLinkOutput> {
    const tenantId = requireTenant(auth);
    const link = await this.links.findByTenantIdAndId(tenantId, id);
    if (!link) throw DomainError.linkNotFound();

    const finalExpertId =
      input.expertId !== undefined ? input.expertId : link.expertId;
    const finalLaunchId =
      input.launchId !== undefined ? input.launchId : link.launchId;
    if (finalLaunchId && !finalExpertId) {
      throw DomainError.validationFailed({
        errors: ['Informe o expert quando informar o lançamento.'],
      });
    }

    const expertChanged =
      input.expertId !== undefined && input.expertId !== link.expertId;
    const launchChanged =
      input.launchId !== undefined && input.launchId !== link.launchId;
    const shouldLoadLaunch =
      finalLaunchId !== null &&
      (launchChanged || expertChanged || input.regenerateUtm === true);

    const [expert, launch] = await Promise.all([
      expertChanged && finalExpertId
        ? this.experts.findByTenantIdAndId(tenantId, finalExpertId)
        : Promise.resolve(null),
      shouldLoadLaunch
        ? this.launches.findByTenantIdAndId(tenantId, finalLaunchId)
        : Promise.resolve(null),
    ]);
    if (expertChanged && finalExpertId && !expert)
      throw DomainError.expertNotFound();
    if (shouldLoadLaunch && (!launch || launch.expertId !== finalExpertId)) {
      throw DomainError.launchNotFound();
    }

    const finalName = input.name ?? link.name;
    const finalChannel = input.channel ?? link.channel;
    const finalPlacement =
      input.placement !== undefined ? input.placement : link.placement;
    const finalCampaignInput =
      input.campaign !== undefined ? input.campaign : link.campaign;
    const normalizedDestination =
      input.destinationUrl !== undefined
        ? this.destinationNormalizer.normalize(input.destinationUrl)
        : link.destinationUrl;
    const destinationVersion =
      normalizedDestination === link.destinationUrl
        ? link.destinationVersion
        : link.destinationVersion + 1;

    let utmSource = link.utmSource;
    let utmMedium = link.utmMedium;
    let utmCampaign = link.utmCampaign;
    let utmContent = link.utmContent;
    let utmTerm = link.utmTerm;

    if (input.regenerateUtm) {
      const generated = this.utmBuilder.build({
        channel: finalChannel,
        placement: finalPlacement,
        campaign: finalCampaignInput,
        linkName: finalName,
        launchName: launch?.name,
        overrides: input.utm,
      });
      ({
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        content: utmContent,
        term: utmTerm,
      } = generated);
      if (input.utm) {
        if (input.utm.source !== undefined)
          utmSource = this.utmBuilder.normalize(input.utm.source);
        if (input.utm.medium !== undefined)
          utmMedium = this.utmBuilder.normalize(input.utm.medium);
        if (input.utm.campaign !== undefined)
          utmCampaign = this.utmBuilder.normalize(input.utm.campaign);
        if (input.utm.content !== undefined)
          utmContent = this.utmBuilder.normalize(input.utm.content);
        if (input.utm.term !== undefined)
          utmTerm = this.utmBuilder.normalize(input.utm.term);
      }
    } else {
      if (input.campaign !== undefined && input.utm?.campaign === undefined) {
        utmCampaign = this.utmBuilder.normalize(input.campaign);
      }
      if (input.utm) {
        if (input.utm.source !== undefined)
          utmSource = this.utmBuilder.normalize(input.utm.source);
        if (input.utm.medium !== undefined)
          utmMedium = this.utmBuilder.normalize(input.utm.medium);
        if (input.utm.campaign !== undefined)
          utmCampaign = this.utmBuilder.normalize(input.utm.campaign);
        if (input.utm.content !== undefined)
          utmContent = this.utmBuilder.normalize(input.utm.content);
        if (input.utm.term !== undefined)
          utmTerm = this.utmBuilder.normalize(input.utm.term);
      }
    }

    const updatedLink = link.with({
      expertId: finalExpertId ?? null,
      launchId: finalLaunchId ?? null,
      name: finalName,
      destinationUrl: normalizedDestination,
      channel: finalChannel,
      placement: finalPlacement ?? null,
      campaign: utmCampaign,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      purpose: input.purpose ?? link.purpose,
      status: input.status ?? link.status ?? LinkStatus.ACTIVE,
      destinationVersion,
      updatedAt: new Date(),
    });
    const saved = await this.links.updateByTenant(tenantId, id, {
      expertId: updatedLink.expertId,
      launchId: updatedLink.launchId,
      name: updatedLink.name,
      destinationUrl: updatedLink.destinationUrl,
      channel: updatedLink.channel,
      placement: updatedLink.placement,
      campaign: updatedLink.campaign,
      utmSource: updatedLink.utmSource,
      utmMedium: updatedLink.utmMedium,
      utmCampaign: updatedLink.utmCampaign,
      utmContent: updatedLink.utmContent,
      utmTerm: updatedLink.utmTerm,
      purpose: updatedLink.purpose,
      status: updatedLink.status,
      destinationVersion: updatedLink.destinationVersion,
      updatedAt: updatedLink.updatedAt,
    });
    if (!saved) throw DomainError.linkNotFound();
    return { link: saved, shortUrl: this.shortUrlBuilder.build(saved.code) };
  }
}
