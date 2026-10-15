import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/tokens';
import { EXPERTS_REPOSITORY } from './domain/repositories/ExpertsRepository';
import { ExpertOrmEntity } from './infra/entities/ExpertOrmEntity';
import { TypeOrmExpertsRepository } from './infra/repositories/TypeOrmExpertsRepository';
import { CreateExpertUseCase } from './application/use-cases/CreateExpertUseCase';
import { DeleteExpertUseCase } from './application/use-cases/DeleteExpertUseCase';
import { ListExpertsUseCase } from './application/use-cases/ListExpertsUseCase';
import { UpdateExpertUseCase } from './application/use-cases/UpdateExpertUseCase';
import { ExpertsController } from './presentation/controllers/ExpertsController';

@Module({
  controllers: [ExpertsController],
  providers: [
    CreateExpertUseCase,
    ListExpertsUseCase,
    UpdateExpertUseCase,
    DeleteExpertUseCase,
    {
      provide: EXPERTS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmExpertsRepository(dataSource.getRepository(ExpertOrmEntity)),
    },
  ],
  exports: [EXPERTS_REPOSITORY],
})
export class ExpertsModule {}
