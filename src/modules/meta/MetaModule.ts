import { Module } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/tokens';
import { REDIS_CLIENT } from '../../shared/infra/redis/tokens';
import { ExpertsModule } from '../experts/ExpertsModule';
import { CompleteInstagramConnectionUseCase } from './application/use-cases/CompleteInstagramConnectionUseCase';
import { HandleMetaWebhookUseCase } from './application/use-cases/HandleMetaWebhookUseCase';
import { ListInstagramReelsUseCase } from './application/use-cases/ListInstagramReelsUseCase';
import { StartInstagramConnectionUseCase } from './application/use-cases/StartInstagramConnectionUseCase';
import { EXPERT_META_CREDENTIALS_REPOSITORY } from './domain/repositories/ExpertMetaCredentialsRepository';
import { OAUTH_STATE_STORE } from './domain/repositories/OAuthStateStore';
import { INSTAGRAM_OAUTH_GATEWAY } from './domain/services/InstagramOAuthGateway';
import { META_TOKEN_CIPHER } from './domain/services/MetaTokenCipher';
import { MetaConfigService } from './infra/config/MetaConfigService';
import { MetaTokenEncryptionService } from './infra/crypto/MetaTokenEncryptionService';
import { ExpertMetaCredentialOrmEntity } from './infra/entities/ExpertMetaCredentialOrmEntity';
import { InstagramOAuthClient } from './infra/http/InstagramOAuthClient';
import { MetaGraphClient } from './infra/http/MetaGraphClient';
import { RedisOAuthStateStore } from './infra/oauth/RedisOAuthStateStore';
import { TypeOrmExpertMetaCredentialsRepository } from './infra/repositories/TypeOrmExpertMetaCredentialsRepository';
import { MetaInstagramAuthController } from './presentation/controllers/MetaInstagramAuthController';
import { MetaReelsController } from './presentation/controllers/MetaReelsController';
import { MetaWebhooksController } from './presentation/controllers/MetaWebhooksController';

@Module({
  imports: [ExpertsModule],
  controllers: [
    MetaWebhooksController,
    MetaReelsController,
    MetaInstagramAuthController,
  ],
  providers: [
    MetaConfigService,
    MetaGraphClient,
    MetaTokenEncryptionService,
    HandleMetaWebhookUseCase,
    ListInstagramReelsUseCase,
    StartInstagramConnectionUseCase,
    CompleteInstagramConnectionUseCase,
    {
      provide: INSTAGRAM_OAUTH_GATEWAY,
      useClass: InstagramOAuthClient,
    },
    {
      provide: META_TOKEN_CIPHER,
      useExisting: MetaTokenEncryptionService,
    },
    {
      provide: OAUTH_STATE_STORE,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new RedisOAuthStateStore(redis),
    },
    {
      provide: EXPERT_META_CREDENTIALS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmExpertMetaCredentialsRepository(
          dataSource.getRepository(ExpertMetaCredentialOrmEntity),
        ),
    },
  ],
  exports: [
    MetaConfigService,
    MetaGraphClient,
    MetaTokenEncryptionService,
    EXPERT_META_CREDENTIALS_REPOSITORY,
  ],
})
export class MetaModule {}
