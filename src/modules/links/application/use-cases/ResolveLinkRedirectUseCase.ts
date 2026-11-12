import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { LINKS_REPOSITORY } from '../../domain/repositories/LinksRepository';
import { LinkStatus } from '../../domain/enums/LinkStatus';
import type { LinksRepository } from '../../domain/repositories/LinksRepository';
import { LINK_REDIRECT_CACHE } from '../../domain/services/LinkRedirectCache';
import type {
  LinkRedirectCache,
  LinkRedirectEntry,
} from '../../domain/services/LinkRedirectCache';
import { LinkBotDetector } from '../services/LinkBotDetector';
import { LinkClickRecorder } from '../services/LinkClickRecorder';
import { LinkRedirectUrlBuilder } from '../services/LinkRedirectUrlBuilder';

export type ResolveLinkRedirectInput = {
  code: string;
  query: Record<string, string | string[] | undefined>;
  ip: string;
  userAgent: string;
  referrer: string;
  now: Date;
};

export type ResolveLinkRedirectOutput =
  | { kind: 'redirect'; url: string }
  | { kind: 'inactive' }
  | { kind: 'not_found' };

@Injectable()
export class ResolveLinkRedirectUseCase {
  private readonly logger = new Logger(ResolveLinkRedirectUseCase.name);
  private readonly flights = new Map<
    string,
    Promise<LinkRedirectEntry | null>
  >();

  constructor(
    @Inject(LINKS_REPOSITORY) private readonly links: LinksRepository,
    @Inject(LINK_REDIRECT_CACHE) private readonly cache: LinkRedirectCache,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly urlBuilder: LinkRedirectUrlBuilder,
    private readonly botDetector: LinkBotDetector,
    private readonly recorder: LinkClickRecorder,
  ) {}

  async execute(
    input: ResolveLinkRedirectInput,
  ): Promise<ResolveLinkRedirectOutput> {
    let entry = await this.cache.get(input.code);
    if (!entry) {
      let flight = this.flights.get(input.code);
      if (!flight) {
        flight = this.load(input.code);
        this.flights.set(input.code, flight);
        void flight.then(
          () => this.flights.delete(input.code),
          () => this.flights.delete(input.code),
        );
      }
      entry = await flight;
    }
    if (!entry || 'missing' in entry) return { kind: 'not_found' };
    if (entry.status === LinkStatus.INACTIVE) return { kind: 'inactive' };
    const clickId = this.ids.generate();
    const url = this.urlBuilder.build({
      destinationUrl: entry.destinationUrl,
      linkUtm: entry.utm,
      incomingQuery: input.query,
      clickId,
    });
    try {
      this.recorder.record({
        clickId,
        linkId: entry.id,
        tenantId: entry.tenantId,
        expertId: entry.expertId,
        launchId: entry.launchId,
        code: input.code,
        destinationVersion: entry.destinationVersion,
        destinationUtm: entry.utm,
        ip: input.ip,
        userAgent: input.userAgent,
        referrer: input.referrer,
        isBot: this.botDetector.isBot(input.userAgent),
        now: input.now,
      });
    } catch (error) {
      this.logger.error(`Link click recorder failed: ${String(error)}`);
    }
    return { kind: 'redirect', url };
  }

  private async load(code: string): Promise<LinkRedirectEntry | null> {
    const link = await this.links.findByCode(code);
    const entry: LinkRedirectEntry = link
      ? {
          v: 1,
          id: link.id,
          tenantId: link.tenantId,
          expertId: link.expertId,
          launchId: link.launchId,
          destinationUrl: link.destinationUrl,
          destinationVersion: link.destinationVersion,
          status: link.status,
          utm: {
            source: link.utmSource,
            medium: link.utmMedium,
            campaign: link.utmCampaign,
            content: link.utmContent,
            term: link.utmTerm,
          },
        }
      : { v: 1, missing: true };
    await this.cache.set(code, entry);
    return entry;
  }
}
