import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from '@upstash/redis';
import type { DataSource } from 'typeorm';
import { Environment } from '../../config/Environment';
import { DATA_SOURCE } from '../../infra/database/tokens';
import { REDIS_CLIENT } from '../../shared/infra/redis/tokens';
import { AUTH_SETTINGS } from './application/AuthSettings';
import type { AuthSettings } from './application/AuthSettings';
import { GetAuthProfileUseCase } from './application/use-cases/GetAuthProfileUseCase';
import { ForgotPasswordUseCase } from './application/use-cases/ForgotPasswordUseCase';
import { LoginUseCase } from './application/use-cases/LoginUseCase';
import { LogoutAllSessionsUseCase } from './application/use-cases/LogoutAllSessionsUseCase';
import { LogoutUseCase } from './application/use-cases/LogoutUseCase';
import { RefreshSessionUseCase } from './application/use-cases/RefreshSessionUseCase';
import { ResetPasswordUseCase } from './application/use-cases/ResetPasswordUseCase';
import { EmailTemplateRenderer } from './application/services/EmailTemplateRenderer';
import { AUTH_ACCOUNTS_REPOSITORY } from './domain/repositories/AuthAccountsRepository';
import { SESSIONS_REPOSITORY } from './domain/repositories/SessionsRepository';
import { PASSWORD_RESET_TOKENS_REPOSITORY } from './domain/repositories/PasswordResetTokensRepository';
import { ACCESS_TOKEN_SERVICE } from './domain/services/AccessTokenService';
import { RedisSessionsRepository } from './infra/repositories/RedisSessionsRepository';
import { TypeOrmAuthAccountsRepository } from './infra/repositories/TypeOrmAuthAccountsRepository';
import { TypeOrmPasswordResetTokensRepository } from './infra/repositories/TypeOrmPasswordResetTokensRepository';
import { JwtAccessTokenService } from './infra/tokens/JwtAccessTokenService';
import { AuthController } from './presentation/controllers/AuthController';
import { AccessTokenGuard } from './presentation/guards/AccessTokenGuard';
import { TwoFactorModule } from '../two-factor/TwoFactorModule';
import { SessionIssuer } from './application/services/SessionIssuer';
import { TwoFactorChallengeUseCase } from './application/use-cases/challenge/TwoFactorChallengeUseCase';
import { AdminResetTwoFactorUseCase } from './application/use-cases/AdminResetTwoFactorUseCase';
import { TwoFactorAdminController } from './presentation/controllers/TwoFactorAdminController';
import { EmailLoginCodes } from './application/services/EmailLoginCodes';
import { EmailChallengeUseCase } from './application/use-cases/challenge/EmailChallengeUseCase';

@Module({
  imports: [TwoFactorModule],
  controllers: [AuthController, TwoFactorAdminController],
  providers: [
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    LogoutAllSessionsUseCase,
    GetAuthProfileUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    EmailTemplateRenderer,
    SessionIssuer,
    EmailLoginCodes,
    TwoFactorChallengeUseCase,
    EmailChallengeUseCase,
    AdminResetTwoFactorUseCase,
    {
      provide: AUTH_SETTINGS,
      useFactory: (): AuthSettings => ({
        accessTokenTtlSeconds: Environment.vars.ACCESS_TOKEN_TTL_SECONDS,
        refreshTokenIdleTtlSeconds:
          Environment.vars.REFRESH_TOKEN_IDLE_TTL_SECONDS,
        sessionAbsoluteTtlSeconds:
          Environment.vars.SESSION_ABSOLUTE_TTL_SECONDS,
        refreshTokenGracePeriodSeconds:
          Environment.vars.REFRESH_TOKEN_GRACE_PERIOD_SECONDS,
      }),
    },
    {
      provide: ACCESS_TOKEN_SERVICE,
      useFactory: () =>
        new JwtAccessTokenService(
          new JwtService({
            secret: Environment.vars.JWT_SECRET,
            signOptions: {
              algorithm: 'HS256',
              expiresIn: Environment.vars.ACCESS_TOKEN_TTL_SECONDS,
              issuer: Environment.vars.JWT_ISSUER,
              audience: Environment.vars.JWT_AUDIENCE,
            },
            verifyOptions: {
              // Algoritmo fixo: impede ataques de troca de algoritmo ("none").
              algorithms: ['HS256'],
              issuer: Environment.vars.JWT_ISSUER,
              audience: Environment.vars.JWT_AUDIENCE,
            },
          }),
        ),
    },
    {
      provide: SESSIONS_REPOSITORY,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new RedisSessionsRepository(redis),
    },
    {
      provide: AUTH_ACCOUNTS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmAuthAccountsRepository(dataSource),
    },
    {
      provide: PASSWORD_RESET_TOKENS_REPOSITORY,
      inject: [DATA_SOURCE],
      useFactory: (dataSource: DataSource) =>
        new TypeOrmPasswordResetTokensRepository(dataSource),
    },
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
  ],
})
export class AuthModule {}
