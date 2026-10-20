import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DomainError } from '../../../../shared/errors/DomainError';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationAccountType } from '../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
import { INTEGRATION_ACCOUNTS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { IntegrationAccountsRepository } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import { INTEGRATION_CREDENTIALS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { IntegrationCredentialsRepository } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import { INTEGRATION_TOKEN_CIPHER } from '../../../integrations/domain/services/IntegrationTokenCipher';
import type { IntegrationTokenCipher } from '../../../integrations/domain/services/IntegrationTokenCipher';
import type { IntegrationAccount } from '../../../integrations/domain/entities/IntegrationAccount';
import type { IntegrationCredential } from '../../../integrations/domain/entities/IntegrationCredential';
import { INSTAGRAM_MEDIA_CACHE } from '../../domain/repositories/InstagramMediaCache';
import type {
  CachedMediaPage,
  InstagramMediaCache,
} from '../../domain/repositories/InstagramMediaCache';
import { InstagramGraphClient } from '../../infra/http/InstagramGraphClient';
import { InstagramMediaUrls } from '../../infra/media/InstagramMediaUrls';

export type InstagramPost = {
  id: string;
  caption?: string;
  mediaType?: string;
  mediaProductType?: string;
  mediaUrl?: string;
  permalink?: string;
  thumbnailUrl?: string;
  timestamp?: string;
  commentsCount?: number;
  likeCount?: number;
  /** Itens do carrossel, na ordem em que aparecem no Instagram. */
  children?: InstagramMediaChild[];
};

export type InstagramMediaChild = {
  id: string;
  mediaType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
};

type MetaInstagramMediaChild = {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

type MetaInstagramMedia = {
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
  children?: { data?: MetaInstagramMediaChild[] };
};

type InstagramMediaResponse = {
  data?: MetaInstagramMedia[];
  paging?: { cursors?: { before?: string; after?: string } };
};

export type ListInstagramPostsInput = {
  tenantId: string | null;
  expertId: string;
  limit?: number;
  after?: string;
};

export type ListInstagramPostsOutput = {
  expertId: string;
  instagram: { userId: string; username: string | null };
  data: InstagramPost[];
  paging: { after?: string } | null;
};

const MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,comments_count,like_count,children{id,media_type,media_url,thumbnail_url}';
type Connection = {
  credential: IntegrationCredential;
  account: IntegrationAccount;
};

@Injectable()
export class ListInstagramReelsUseCase {
  private readonly defaultLimit = 25;
  private readonly maxLimit = 100;

  constructor(
    private readonly instagramGraphClient: InstagramGraphClient,
    @Inject(EXPERTS_REPOSITORY)
    private readonly expertsRepository: ExpertsRepository,

    @Inject(INTEGRATION_CREDENTIALS_REPOSITORY)
    private readonly credentialsRepository: IntegrationCredentialsRepository,

    @Inject(INTEGRATION_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: IntegrationAccountsRepository,

    @Inject(INTEGRATION_TOKEN_CIPHER)
    private readonly cipher: IntegrationTokenCipher,

    @Inject(INSTAGRAM_MEDIA_CACHE)
    private readonly cache: InstagramMediaCache,

    private readonly mediaUrls: InstagramMediaUrls,
  ) {}

  async execute(
    input: ListInstagramPostsInput,
  ): Promise<ListInstagramPostsOutput> {
    if (!input.tenantId) throw new DomainError(403, 'TENANT_REQUIRED');

    // As três consultas são independentes (todas presas à empresa): em
    // paralelo, a resposta sai mais rápido.
    const [expert, credential, accounts] = await Promise.all([
      this.expertsRepository.findByTenantIdAndId(
        input.tenantId,
        input.expertId,
      ),
      this.credentialsRepository.findActiveWithAccessToken(
        input.tenantId,
        input.expertId,
        IntegrationProvider.INSTAGRAM,
      ),
      this.accountsRepository.findConnectedByExpert(
        input.tenantId,
        input.expertId,
        IntegrationProvider.INSTAGRAM,
      ),
    ]);
    if (!expert) throw DomainError.expertNotFound();

    const account = accounts.find(
      (item) =>
        item.type === IntegrationAccountType.INSTAGRAM_ACCOUNT &&
        item.credentialId === credential?.id,
    );
    if (!credential?.accessToken || !account) {
      throw new DomainError(409, 'INSTAGRAM_NOT_CONNECTED');
    }
    if (credential.isExpired()) {
      throw new DomainError(409, 'INSTAGRAM_ACCESS_TOKEN_EXPIRED');
    }

    const connection = { credential, account };
    const limit = this.normalizeLimit(input.limit);
    const page = await this.fetchPage(connection, input.after, limit);

    return {
      expertId: expert.id,
      instagram: {
        userId: account.externalId,
        username: account.displayName ?? null,
      },
      data: page.data.map((post) => this.withProxiedMedia(post)),
      // Não retornamos as URLs next/previous da Meta: elas podem conter token.
      paging: page.after ? { after: page.after } : null,
    };
  }

  /** Uma página da Meta, com cache curto por credencial (reconectar descarta). */
  private async fetchPage(
    { credential, account }: Connection,
    after: string | undefined,
    limit: number,
  ): Promise<CachedMediaPage<InstagramPost>> {
    const cursorKey = createHash('sha256')
      .update(after ?? '')
      .digest('hex')
      .slice(0, 32);
    const key = `${credential.id}:${limit}:${cursorKey}`;
    const cached = await this.cache.get<InstagramPost>(key);
    if (cached) return cached;

    const params: Record<string, string | number> = {
      fields: MEDIA_FIELDS,
      limit,
    };
    if (after) params.after = after;

    // Só decifra o token quando vai mesmo chamar a Meta.
    const response =
      await this.instagramGraphClient.get<InstagramMediaResponse>(
        `/${encodeURIComponent(account.externalId)}/media`,
        params,
        this.cipher.decrypt(credential.accessToken!, {
          tenantId: credential.tenantId,
          expertId: credential.expertId,
          credentialId: credential.id,
          provider: credential.provider,
          purpose: 'access_token',
        }),
      );
    const page = {
      data: (response.data ?? []).map((post) => this.toPost(post)),
      after: response.paging?.cursors?.after,
    };

    await this.cache.set(key, page);

    return page;
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit)) return this.defaultLimit;
    return Math.min(Math.max(Math.trunc(limit), 1), this.maxLimit);
  }

  /**
   * Troca as URLs da CDN pelas do nosso proxy, assinadas a cada resposta (o
   * cache guarda as originais, então o link nunca sai expirado dele).
   */
  private withProxiedMedia(post: InstagramPost): InstagramPost {
    const proxied = (url?: string) => this.mediaUrls.sign(url) ?? url;

    return {
      ...post,
      mediaUrl: proxied(post.mediaUrl),
      thumbnailUrl: proxied(post.thumbnailUrl),
      children: post.children?.map((child) => ({
        ...child,
        mediaUrl: proxied(child.mediaUrl),
        thumbnailUrl: proxied(child.thumbnailUrl),
      })),
    };
  }

  private toPost(post: MetaInstagramMedia): InstagramPost {
    return {
      id: post.id,
      caption: post.caption,
      mediaType: post.media_type,
      mediaProductType: post.media_product_type,
      mediaUrl: post.media_url,
      permalink: post.permalink,
      thumbnailUrl: post.thumbnail_url,
      timestamp: post.timestamp,
      commentsCount: post.comments_count,
      likeCount: post.like_count,
      children: post.children?.data?.map((child) => ({
        id: child.id,
        mediaType: child.media_type,
        mediaUrl: child.media_url,
        thumbnailUrl: child.thumbnail_url,
      })),
    };
  }
}
