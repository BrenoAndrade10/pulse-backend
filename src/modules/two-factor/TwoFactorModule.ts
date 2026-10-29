import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../infra/database/tokens';
import { UsersModule } from '../users/UsersModule';
import { RecoveryCodes } from './application/services/RecoveryCodes';
import { TotpService } from './application/services/TotpService';
import { TrustedDeviceTokens } from './application/services/TrustedDeviceTokens';
import { TrustedDevicesService } from './application/services/TrustedDevicesService';
import { ConfirmTwoFactorUseCase } from './application/use-cases/ConfirmTwoFactorUseCase';
import { GetTwoFactorStatusUseCase } from './application/use-cases/GetTwoFactorStatusUseCase';
import { RegenerateRecoveryCodesUseCase } from './application/use-cases/RegenerateRecoveryCodesUseCase';
import { SetupTwoFactorUseCase } from './application/use-cases/SetupTwoFactorUseCase';
import { VerifyTwoFactorUseCase } from './application/use-cases/VerifyTwoFactorUseCase';
import { RECOVERY_CODES_REPOSITORY } from './domain/repositories/RecoveryCodesRepository';
import { TRUSTED_DEVICES_REPOSITORY } from './domain/repositories/TrustedDevicesRepository';
import { TWO_FACTOR_REPOSITORY } from './domain/repositories/TwoFactorRepository';
import { AesTwoFactorCipher } from './infra/crypto/AesTwoFactorCipher';
import { TwoFactorKeys } from './infra/crypto/TwoFactorKeys';
import { TypeOrmRecoveryCodesRepository } from './infra/repositories/TypeOrmRecoveryCodesRepository';
import { TypeOrmTrustedDevicesRepository } from './infra/repositories/TypeOrmTrustedDevicesRepository';
import { TypeOrmTwoFactorRepository } from './infra/repositories/TypeOrmTwoFactorRepository';
import { AuthChallengeStore } from './infra/redis/AuthChallengeStore';
import { TwoFactorController } from './presentation/controllers/TwoFactorController';

@Module({
  imports: [UsersModule],
  controllers: [TwoFactorController],
  providers: [
    TwoFactorKeys,
    AesTwoFactorCipher,
    TotpService,
    RecoveryCodes,
    TrustedDeviceTokens,
    TrustedDevicesService,
    AuthChallengeStore,
    GetTwoFactorStatusUseCase,
    SetupTwoFactorUseCase,
    ConfirmTwoFactorUseCase,
    RegenerateRecoveryCodesUseCase,
    VerifyTwoFactorUseCase,
    {
      provide: TWO_FACTOR_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmTwoFactorRepository(dataSource),
    },
    {
      provide: RECOVERY_CODES_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmRecoveryCodesRepository(dataSource),
    },
    {
      provide: TRUSTED_DEVICES_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmTrustedDevicesRepository(dataSource),
    },
  ],
  exports: [
    AesTwoFactorCipher,
    TotpService,
    RecoveryCodes,
    TrustedDeviceTokens,
    TWO_FACTOR_REPOSITORY,
    RECOVERY_CODES_REPOSITORY,
    TRUSTED_DEVICES_REPOSITORY,
    TrustedDevicesService,
    AuthChallengeStore,
    SetupTwoFactorUseCase,
    ConfirmTwoFactorUseCase,
    VerifyTwoFactorUseCase,
  ],
})
export class TwoFactorModule {}
