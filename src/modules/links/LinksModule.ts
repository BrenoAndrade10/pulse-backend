import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { Environment } from '../../config/Environment';
import { DATA_SOURCE } from '../../infra/database/tokens';
import { ExpertsModule } from '../experts/ExpertsModule';
import { LaunchesModule } from '../launches/LaunchesModule';
import { CreateLinkUseCase } from './application/use-cases/CreateLinkUseCase';
import { ListLinksUseCase } from './application/use-cases/ListLinksUseCase';
import { UpdateLinkUseCase } from './application/use-cases/UpdateLinkUseCase';
import {
  DestinationUrlNormalizer,
  LINK_DESTINATION_POLICY,
} from './application/services/DestinationUrlNormalizer';
import { LinkShortUrlBuilder } from './application/services/LinkShortUrlBuilder';
import { LinkUtmBuilder } from './application/services/LinkUtmBuilder';
import { LINKS_REPOSITORY } from './domain/repositories/LinksRepository';
import { LinkOrmEntity } from './infra/entities/LinkOrmEntity';
import { TypeOrmLinksRepository } from './infra/repositories/TypeOrmLinksRepository';
import { CryptoLinkCodeGenerator } from './infra/code/CryptoLinkCodeGenerator';
import { LINK_CODE_GENERATOR } from './domain/services/LinkCodeGenerator';
import { LinksController } from './presentation/controllers/LinksControllers';

@Module({
  imports: [ExpertsModule, LaunchesModule],
  controllers: [LinksController],
  providers: [
    CreateLinkUseCase,
    ListLinksUseCase,
    UpdateLinkUseCase,
    LinkShortUrlBuilder,
    DestinationUrlNormalizer,
    LinkUtmBuilder,
    {
      provide: LINKS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmLinksRepository(dataSource.getRepository(LinkOrmEntity)),
    },
    {
      provide: LINK_CODE_GENERATOR,
      useClass: CryptoLinkCodeGenerator,
    },
    {
      provide: LINK_DESTINATION_POLICY,
      useFactory: () => {
        const apiPublicUrl = Environment.vars?.API_PUBLIC_URL;
        const blockedHosts = apiPublicUrl
          ? [new URL(apiPublicUrl).hostname]
          : [];

        return {
          allowLocal: process.env.NODE_ENV !== 'production',
          blockedHosts,
        };
      },
    },
  ],
  exports: [
    LINKS_REPOSITORY,
    LINK_CODE_GENERATOR,
    DestinationUrlNormalizer,
    LinkUtmBuilder,
  ],
})
export class LinksModule {}
