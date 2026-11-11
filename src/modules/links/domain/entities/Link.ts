import { LinkChannel } from '../enums/LinkChannel';
import { LinkPurpose } from '../enums/LinkPurpose';
import { LinkStatus } from '../enums/LinkStatus';

export type LinkProps = {
  id: string;
  tenantId: string;
  expertId: string | null;
  launchId: string | null;
  name: string;
  destinationUrl: string;
  code: string;
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
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export class Link {
  constructor(private readonly props: LinkProps) {}

  with(changes: Partial<LinkProps>): Link {
    return new Link({ ...this.props, ...changes });
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get expertId(): string | null {
    return this.props.expertId;
  }

  get launchId(): string | null {
    return this.props.launchId;
  }

  get name(): string {
    return this.props.name;
  }

  get destinationUrl(): string {
    return this.props.destinationUrl;
  }

  get code(): string {
    return this.props.code;
  }

  get channel(): LinkChannel {
    return this.props.channel;
  }

  get placement(): string | null {
    return this.props.placement;
  }

  get campaign(): string | null {
    return this.props.campaign;
  }

  get utmSource(): string | null {
    return this.props.utmSource;
  }

  get utmMedium(): string | null {
    return this.props.utmMedium;
  }

  get utmCampaign(): string | null {
    return this.props.utmCampaign;
  }

  get utmContent(): string | null {
    return this.props.utmContent;
  }

  get utmTerm(): string | null {
    return this.props.utmTerm;
  }

  get purpose(): LinkPurpose {
    return this.props.purpose;
  }

  get status(): LinkStatus {
    return this.props.status;
  }

  get destinationVersion(): number {
    return this.props.destinationVersion;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
}
