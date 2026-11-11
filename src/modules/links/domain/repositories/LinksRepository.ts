import { Link } from '../entities/Link';
import { LinkStatus } from '../enums/LinkStatus';
import { LinkChannel } from '../enums/LinkChannel';
import { LinkPurpose } from '../enums/LinkPurpose';

export const LINKS_REPOSITORY = Symbol('LINKS_REPOSITORY');

export type LinkFilters = {
  expertId?: string;
  launchId?: string;
  status?: LinkStatus;
};

export type LinkPageQuery = {
  tenantId: string;
  expertId?: string;
  launchId?: string;
  channel?: LinkChannel;
  status?: LinkStatus;
  search?: string;
  cursor?: { createdAt: Date; id: string };
  limit: number;
};

export type LinkUpdate = {
  expertId: string | null;
  launchId: string | null;
  name: string;
  destinationUrl: string;
  channel: LinkChannel;
  placement: string | null;
  campaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  purpose: LinkPurpose;
  status: LinkStatus;
  destinationVersion: number;
  updatedAt: Date;
};

export interface LinksRepository {
  create(link: Link): Promise<Link>;
  tryCreate(link: Link): Promise<Link | null>;
  findByCode(code: string): Promise<Link | null>;
  findByTenantIdAndId(tenantId: string, id: string): Promise<Link | null>;
  findByTenantId(tenantId: string, filters?: LinkFilters): Promise<Link[]>;
  findPage(query: LinkPageQuery): Promise<Link[]>;
  updateByTenant(
    tenantId: string,
    id: string,
    update: LinkUpdate,
  ): Promise<Link | null>;
  save(link: Link): Promise<Link>;
  softDelete(tenantId: string, id: string): Promise<boolean>;
}
