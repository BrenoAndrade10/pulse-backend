import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../infra/database/tokens';
import { ExpertsModule } from '../experts/ExpertsModule';
import { CaptureLeadService } from './application/services/CaptureLeadService';
import { DeleteLeadUseCase } from './application/use-cases/DeleteLeadUseCase';
import { ExportLeadsUseCase } from './application/use-cases/ExportLeadsUseCase';
import { ListLeadsUseCase } from './application/use-cases/ListLeadsUseCase';
import { LEADS_REPOSITORY } from './domain/repositories/LeadsRepository';
import { LEAD_CIPHER } from './domain/services/LeadCipher';
import { LeadEncryptionService } from './infra/crypto/LeadEncryptionService';
import { LeadExportLinks } from './infra/export/LeadExportLinks';
import { PostgresLeadsRepository } from './infra/repositories/PostgresLeadsRepository';
import { LeadsController } from './presentation/controllers/LeadsController';
import { LeadsExportController } from './presentation/controllers/LeadsExportController';

/** Leads captados pelos formulários: dados cifrados, exportação e exclusão. */
@Module({
  imports: [ExpertsModule],
  controllers: [LeadsController, LeadsExportController],
  providers: [
    CaptureLeadService,
    ListLeadsUseCase,
    DeleteLeadUseCase,
    ExportLeadsUseCase,
    LeadExportLinks,
    LeadEncryptionService,
    { provide: LEAD_CIPHER, useExisting: LeadEncryptionService },
    {
      provide: LEADS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new PostgresLeadsRepository(dataSource),
    },
  ],
  exports: [CaptureLeadService],
})
export class LeadsModule {}
