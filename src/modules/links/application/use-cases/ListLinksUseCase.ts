import { Inject, Injectable } from '@nestjs/common';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { requireTenant } from '../../../experts/application/ExpertAuthorization';
import { LINKS_REPOSITORY } from '../../domain/repositories/LinksRepository';
import type { LinksRepository } from '../../domain/repositories/LinksRepository';
import type { ListLinksQuery } from '../../presentation/schemas/LinkSchemas';
import { LinkShortUrlBuilder } from '../services/LinkShortUrlBuilder';
import { decodeLinkCursor, encodeLinkCursor } from '../services/LinkCursor';
import type { Link } from '../../domain/entities/Link';

export type ListLinksOutput = {
  items: Array<{ link: Link; shortUrl: string }>;
  nextCursor: string | null;
};

@Injectable()
export class ListLinksUseCase {
  constructor(
    @Inject(LINKS_REPOSITORY) private readonly links: LinksRepository,
    private readonly shortUrlBuilder: LinkShortUrlBuilder,
  ) {}

  async execute(
    query: ListLinksQuery,
    auth: AccessTokenClaims,
  ): Promise<ListLinksOutput> {
    const tenantId = requireTenant(auth);
    const limit = query.limit ?? 20;
    const rows = await this.links.findPage({
      tenantId,
      expertId: query.expertId,
      launchId: query.launchId,
      channel: query.channel,
      status: query.status,
      search: query.search,
      cursor: decodeLinkCursor(query.cursor),
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    const next = rows.length > limit ? page[page.length - 1] : undefined;
    return {
      items: page.map((link) => ({
        link,
        shortUrl: this.shortUrlBuilder.build(link.code),
      })),
      nextCursor: next
        ? encodeLinkCursor({ createdAt: next.createdAt, id: next.id })
        : null,
    };
  }
}
