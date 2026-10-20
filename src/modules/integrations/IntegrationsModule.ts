import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../infra/database/tokens';
import { INTEGRATION_ACCOUNTS_REPOSITORY } from './domain/repositories/IntegrationAccountsRepository';
import { INTEGRATION_CREDENTIALS_REPOSITORY } from './domain/repositories/IntegrationCredentialsRepository';
import { INTEGRATION_TOKEN_CIPHER } from './domain/services/IntegrationTokenCipher';
import { IntegrationTokenEncryptionService } from './infra/crypto/IntegrationTokenEncryptionService';
import { IntegrationAccountOrmEntity } from './infra/entities/IntegrationAccountOrmEntity';
import { IntegrationCredentialOrmEntity } from './infra/entities/IntegrationCredentialOrmEntity';
import { TypeOrmIntegrationAccountsRepository } from './infra/repositories/TypeOrmIntegrationAccountsRepository';
import { TypeOrmIntegrationCredentialsRepository } from './infra/repositories/TypeOrmIntegrationCredentialsRepository';

/**
 * Credenciais (segredo) e contas conectadas (sem segredo) de qualquer
 * provedor. Cada provedor (Meta, Hotmart...) usa este módulo no próprio fluxo.
 */
@Module({
  providers: [
    IntegrationTokenEncryptionService,
    {
      provide: INTEGRATION_TOKEN_CIPHER,
      useExisting: IntegrationTokenEncryptionService,
    },
    {
      provide: INTEGRATION_CREDENTIALS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmIntegrationCredentialsRepository(
          dataSource.getRepository(IntegrationCredentialOrmEntity),
        ),
    },
    {
      provide: INTEGRATION_ACCOUNTS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmIntegrationAccountsRepository(
          dataSource.getRepository(IntegrationAccountOrmEntity),
        ),
    },
  ],
  exports: [
    INTEGRATION_TOKEN_CIPHER,
    INTEGRATION_CREDENTIALS_REPOSITORY,
    INTEGRATION_ACCOUNTS_REPOSITORY,
  ],
})
export class IntegrationsModule {}
