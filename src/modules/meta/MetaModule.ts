import { Module } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../infra/database/tokens';
import { REDIS_CLIENT } from '../../shared/infra/redis/tokens';
import { ExpertsModule } from '../experts/ExpertsModule';
import { IntegrationsModule } from '../integrations/IntegrationsModule';
import { InstagramAccessTokens } from './application/services/InstagramAccessTokens';
import { CompleteInstagramConnectionUseCase } from './application/use-cases/CompleteInstagramConnectionUseCase';
import { ConnectWhatsAppUseCase } from './application/use-cases/ConnectWhatsAppUseCase';
import { DeleteCommentAutomationUseCase } from './application/use-cases/DeleteCommentAutomationUseCase';
import { DisconnectWhatsAppUseCase } from './application/use-cases/DisconnectWhatsAppUseCase';
import { GetWhatsAppConnectionUseCase } from './application/use-cases/GetWhatsAppConnectionUseCase';
import { HandleInstagramCommentUseCase } from './application/use-cases/HandleInstagramCommentUseCase';
import { HandleMetaWebhookUseCase } from './application/use-cases/HandleMetaWebhookUseCase';
import { ListCommentAutomationsUseCase } from './application/use-cases/ListCommentAutomationsUseCase';
import { ListInstagramConnectionsUseCase } from './application/use-cases/ListInstagramConnectionsUseCase';
import { ListInstagramReelsUseCase } from './application/use-cases/ListInstagramReelsUseCase';
import { RevokeInstagramConnectionUseCase } from './application/use-cases/RevokeInstagramConnectionUseCase';
import { SaveCommentAutomationUseCase } from './application/use-cases/SaveCommentAutomationUseCase';
import { StartInstagramConnectionUseCase } from './application/use-cases/StartInstagramConnectionUseCase';
import { INSTAGRAM_MEDIA_CACHE } from './domain/repositories/InstagramMediaCache';
import { COMMENT_AUTOMATIONS_REPOSITORY } from './domain/repositories/CommentAutomationsRepository';
import { COMMENT_REPLIES_REPOSITORY } from './domain/repositories/CommentRepliesRepository';
import { OAUTH_STATE_STORE } from './domain/repositories/OAuthStateStore';
import { INSTAGRAM_OAUTH_GATEWAY } from './domain/services/InstagramOAuthGateway';
import { RedisInstagramMediaCache } from './infra/cache/RedisInstagramMediaCache';
import { CommentAutomationOrmEntity } from './infra/entities/CommentAutomationOrmEntity';
import { CommentReplyOrmEntity } from './infra/entities/CommentReplyOrmEntity';
import { MetaConfigService } from './infra/config/MetaConfigService';
import { InstagramGraphClient } from './infra/http/InstagramGraphClient';
import { InstagramOAuthClient } from './infra/http/InstagramOAuthClient';
import { WhatsAppGraphClient } from './infra/http/WhatsAppGraphClient';
import { WhatsAppConnectionSecurity } from './infra/security/WhatsAppConnectionSecurity';
import { InstagramMediaUrls } from './infra/media/InstagramMediaUrls';
import { MetaGraphClient } from './infra/http/MetaGraphClient';
import { RedisOAuthStateStore } from './infra/oauth/RedisOAuthStateStore';
import { TypeOrmCommentAutomationsRepository } from './infra/repositories/TypeOrmCommentAutomationsRepository';
import { TypeOrmCommentRepliesRepository } from './infra/repositories/TypeOrmCommentRepliesRepository';
import { InstagramCommentAutomationsController } from './presentation/controllers/InstagramCommentAutomationsController';
import { MetaMediaProxyController } from './presentation/controllers/MetaMediaProxyController';
import { MetaInstagramAuthController } from './presentation/controllers/MetaInstagramAuthController';
import { MetaReelsController } from './presentation/controllers/MetaReelsController';
import { MetaWebhooksController } from './presentation/controllers/MetaWebhooksController';
import { WhatsAppConnectionController } from './presentation/controllers/WhatsAppConnectionController';

@Module({
  imports: [ExpertsModule, IntegrationsModule],
  controllers: [
    MetaWebhooksController,
    MetaReelsController,
    MetaInstagramAuthController,
    InstagramCommentAutomationsController,
    MetaMediaProxyController,
    WhatsAppConnectionController,
  ],
  providers: [
    MetaConfigService,
    MetaGraphClient,
    InstagramGraphClient,
    InstagramMediaUrls,
    HandleMetaWebhookUseCase,
    HandleInstagramCommentUseCase,
    InstagramAccessTokens,
    ListCommentAutomationsUseCase,
    SaveCommentAutomationUseCase,
    DeleteCommentAutomationUseCase,
    ListInstagramReelsUseCase,
    ListInstagramConnectionsUseCase,
    RevokeInstagramConnectionUseCase,
    StartInstagramConnectionUseCase,
    CompleteInstagramConnectionUseCase,
    WhatsAppGraphClient,
    ConnectWhatsAppUseCase,
    GetWhatsAppConnectionUseCase,
    DisconnectWhatsAppUseCase,
    WhatsAppConnectionSecurity,
    {
      provide: INSTAGRAM_OAUTH_GATEWAY,
      useClass: InstagramOAuthClient,
    },
    {
      provide: COMMENT_AUTOMATIONS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmCommentAutomationsRepository(
          dataSource.getRepository(CommentAutomationOrmEntity),
        ),
    },
    {
      provide: COMMENT_REPLIES_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmCommentRepliesRepository(
          dataSource.getRepository(CommentReplyOrmEntity),
        ),
    },
    {
      provide: INSTAGRAM_MEDIA_CACHE,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new RedisInstagramMediaCache(redis),
    },
    {
      provide: OAUTH_STATE_STORE,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new RedisOAuthStateStore(redis),
    },
  ],
  exports: [MetaConfigService, MetaGraphClient],
})
export class MetaModule {}
