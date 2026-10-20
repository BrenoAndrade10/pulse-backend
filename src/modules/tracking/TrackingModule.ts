import { Module } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../infra/database/tokens';
import { REDIS_CLIENT } from '../../shared/infra/redis/tokens';
import { ExpertsModule } from '../experts/ExpertsModule';
import { LeadsModule } from '../leads/LeadsModule';
import { CollectEventsUseCase } from './application/collector/CollectEventsUseCase';
import { GetPixelConfigUseCase } from './application/collector/GetPixelConfigUseCase';
import { PixelConfigProvider } from './application/collector/PixelConfigProvider';
import { SetTrackingPageLaunchUseCase } from './application/use-cases/SetTrackingPageLaunchUseCase';
import { TRACKING_PAGES_REPOSITORY } from './domain/repositories/TrackingPagesRepository';
import { TRACKING_EVENTS_SINK } from './domain/services/TrackingEventsSink';
import { ClickHouseEventsSink } from './infra/analytics/ClickHouseEventsSink';
import { PostgresTrackingPagesRepository } from './infra/repositories/PostgresTrackingPagesRepository';
import { CollectorController } from './presentation/controllers/CollectorController';
import { CreateTrackingRuleUseCase } from './application/use-cases/CreateTrackingRuleUseCase';
import { DeleteTrackingRuleUseCase } from './application/use-cases/DeleteTrackingRuleUseCase';
import { OpenTrackingSetupUseCase } from './application/use-cases/OpenTrackingSetupUseCase';
import { CreateTrackingPixelUseCase } from './application/use-cases/CreateTrackingPixelUseCase';
import { GetTrackingPixelUseCase } from './application/use-cases/GetTrackingPixelUseCase';
import { StartTrackingSetupUseCase } from './application/use-cases/StartTrackingSetupUseCase';
import { TRACKING_PIXELS_REPOSITORY } from './domain/repositories/TrackingPixelsRepository';
import { TRACKING_RULES_REPOSITORY } from './domain/repositories/TrackingRulesRepository';
import { TRACKING_SETUP_SESSION_STORE } from './domain/repositories/TrackingSetupSessionStore';
import { TrackingPixelOrmEntity } from './infra/entities/TrackingPixelOrmEntity';
import { TrackingRuleOrmEntity } from './infra/entities/TrackingRuleOrmEntity';
import { TypeOrmTrackingRulesRepository } from './infra/repositories/TypeOrmTrackingRulesRepository';
import { TypeOrmTrackingPixelsRepository } from './infra/repositories/TypeOrmTrackingPixelsRepository';
import { RedisTrackingSetupSessionStore } from './infra/sessions/RedisTrackingSetupSessionStore';
import { TrackerSetupController } from './presentation/controllers/TrackerSetupController';
import { TrackingController } from './presentation/controllers/TrackingController';

@Module({
  imports: [ExpertsModule, LeadsModule],
  controllers: [
    TrackingController,
    TrackerSetupController,
    CollectorController,
  ],
  providers: [
    GetTrackingPixelUseCase,
    CreateTrackingPixelUseCase,
    StartTrackingSetupUseCase,
    OpenTrackingSetupUseCase,
    CreateTrackingRuleUseCase,
    DeleteTrackingRuleUseCase,
    SetTrackingPageLaunchUseCase,
    PixelConfigProvider,
    GetPixelConfigUseCase,
    CollectEventsUseCase,
    ClickHouseEventsSink,
    { provide: TRACKING_EVENTS_SINK, useExisting: ClickHouseEventsSink },
    {
      provide: TRACKING_PAGES_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new PostgresTrackingPagesRepository(dataSource),
    },
    {
      provide: TRACKING_PIXELS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmTrackingPixelsRepository(
          dataSource.getRepository(TrackingPixelOrmEntity),
        ),
    },
    {
      provide: TRACKING_RULES_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmTrackingRulesRepository(
          dataSource.getRepository(TrackingRuleOrmEntity),
        ),
    },
    {
      provide: TRACKING_SETUP_SESSION_STORE,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new RedisTrackingSetupSessionStore(redis),
    },
  ],
})
export class TrackingModule {}
