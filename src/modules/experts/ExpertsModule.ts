import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/tokens';
import { EXPERTS_REPOSITORY } from './domain/repositories/ExpertsRepository';
import { ExpertOrmEntity } from './infra/entities/ExpertOrmEntity';
import { TypeOrmExpertsRepository } from './infra/repositories/TypeOrmExpertsRepository';

@Module({
  providers: [
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
