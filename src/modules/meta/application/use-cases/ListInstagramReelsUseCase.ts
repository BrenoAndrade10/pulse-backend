import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { MetaConfigService } from '../../infra/config/MetaConfigService';
import { MetaGraphClient } from '../../infra/http/MetaGraphClient';

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp?: string;
  comments_count?: number;
  like_count?: number;
};

type InstagramMediaResponse = {
  data?: InstagramMedia[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
};

export type ListInstagramReelsInput = {
  instagramUserId?: string;
  limit?: number;
};

export type ListInstagramReelsOutput = {
  instagramUserId: string;
  data: InstagramMedia[];
  paging?: InstagramMediaResponse['paging'];
};

@Injectable()
export class ListInstagramReelsUseCase {
  private readonly defaultLimit = 25;
  private readonly maxLimit = 100;

  constructor(
    private readonly metaGraphClient: MetaGraphClient,
    private readonly metaConfigService: MetaConfigService,
  ) {}

  async execute(
    input: ListInstagramReelsInput = {},
  ): Promise<ListInstagramReelsOutput> {
    const instagramUserId =
      input.instagramUserId ?? this.metaConfigService.instagramUserId;

    if (!instagramUserId) {
      throw new DomainError(400, 'INSTAGRAM_USER_ID_REQUIRED');
    }

    const response = await this.metaGraphClient.get<InstagramMediaResponse>(
      `/${instagramUserId}/media`,
      {
        fields:
          'id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,comments_count,like_count',
        limit: this.normalizeLimit(input.limit),
      },
    );

    return {
      instagramUserId,
      data: (response.data ?? []).filter((media) =>
        this.isInstagramReel(media),
      ),
      paging: response.paging,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit)) {
      return this.defaultLimit;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), this.maxLimit);
  }

  private isInstagramReel(media: InstagramMedia): boolean {
    return media.media_product_type === 'REELS' || media.media_type === 'REELS';
  }
}
