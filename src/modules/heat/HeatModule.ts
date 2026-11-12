import { Module } from '@nestjs/common';
import { ExpertsModule } from '../experts/ExpertsModule';
import { LeadsModule } from '../leads/LeadsModule';
import { LeadHeatCalculator } from './application/services/LeadHeatCalculator';
import { RecalculateLeadHeatService } from './application/services/RecalculateLeadHeatService';
import { GetLeadHeatUseCase } from './application/use-cases/GetLeadHeatUseCase';
import { HEAT_SIGNALS_REPOSITORY } from './domain/repositories/HeatSignalsRepository';
import { ClickHouseHeatSignalsRepository } from './infra/analytics/ClickHouseHeatSignalsRepository';
import { LeadHeatController } from './presentation/controllers/LeadHeatController';

@Module({
  imports: [ExpertsModule, LeadsModule],
  controllers: [LeadHeatController],
  providers: [
    LeadHeatCalculator,
    RecalculateLeadHeatService,
    GetLeadHeatUseCase,
    {
      provide: HEAT_SIGNALS_REPOSITORY,
      useClass: ClickHouseHeatSignalsRepository,
    },
  ],
  exports: [HEAT_SIGNALS_REPOSITORY, RecalculateLeadHeatService],
})
export class HeatModule {}
