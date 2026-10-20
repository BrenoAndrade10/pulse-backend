import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../infra/database/tokens';
import { ExpertsModule } from '../experts/ExpertsModule';
import { CreateLaunchUseCase } from './application/use-cases/CreateLaunchUseCase';
import { DeleteLaunchUseCase } from './application/use-cases/DeleteLaunchUseCase';
import { GetLaunchUseCase } from './application/use-cases/GetLaunchUseCase';
import { ListLaunchesUseCase } from './application/use-cases/ListLaunchesUseCase';
import { UpdateLaunchUseCase } from './application/use-cases/UpdateLaunchUseCase';
import { LAUNCHES_REPOSITORY } from './domain/repositories/LaunchesRepository';
import { LaunchOrmEntity } from './infra/entities/LaunchOrmEntity';
import { TypeOrmLaunchesRepository } from './infra/repositories/TypeOrmLaunchesRepository';
import { LaunchesController } from './presentation/controllers/LaunchesController';

@Module({
  imports: [ExpertsModule],
  controllers: [LaunchesController],
  providers: [
    CreateLaunchUseCase,
    ListLaunchesUseCase,
    GetLaunchUseCase,
    UpdateLaunchUseCase,
    DeleteLaunchUseCase,
    {
      provide: LAUNCHES_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmLaunchesRepository(
          dataSource.getRepository(LaunchOrmEntity),
        ),
    },
  ],
  exports: [LAUNCHES_REPOSITORY],
})
export class LaunchesModule {}
