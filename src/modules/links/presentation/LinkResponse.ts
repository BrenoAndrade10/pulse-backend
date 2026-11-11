import type { CreateLinkOutput } from '../application/use-cases/CreateLinkUseCase';

export type LinkResponse = {
  id: string;
  expertId: string | null;
  launchId: string | null;
  name: string;
  destinationUrl: string;
  code: string;
  shortUrl: string;
  channel: string;
  placement: string | null;
  campaign: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
  purpose: string;
  status: string;
  destinationVersion: number;
  createdAt: string;
  updatedAt: string;
};

export class LinkResponseMapper {
  static from(output: CreateLinkOutput): LinkResponse {
    const { link } = output;

    return {
      id: link.id,
      expertId: link.expertId,
      launchId: link.launchId,
      name: link.name,
      destinationUrl: link.destinationUrl,
      code: link.code,
      shortUrl: output.shortUrl,
      channel: link.channel,
      placement: link.placement,
      campaign: link.campaign,
      utm: {
        source: link.utmSource,
        medium: link.utmMedium,
        campaign: link.utmCampaign,
        content: link.utmContent,
        term: link.utmTerm,
      },
      purpose: link.purpose,
      status: link.status,
      destinationVersion: link.destinationVersion,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    };
  }

  static fromLink(
    link: CreateLinkOutput['link'],
    shortUrl: string,
  ): LinkResponse {
    return this.from({ link, shortUrl });
  }
}
