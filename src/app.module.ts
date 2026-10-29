import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infra/database/DatabaseModule';
import { AuthModule } from './modules/auth/AuthModule';
import { ExpertsModule } from './modules/experts/ExpertsModule';
import { LaunchesModule } from './modules/launches/LaunchesModule';
import { LeadsModule } from './modules/leads/LeadsModule';
import { MetaModule } from './modules/meta/MetaModule';
import { TenantsModule } from './modules/tenants/TenantsModule';
import { TrackingModule } from './modules/tracking/TrackingModule';
import { TwoFactorModule } from './modules/two-factor/TwoFactorModule';
import { UsersModule } from './modules/users/UsersModule';
import { DomainErrorFilter } from './shared/filters/DomainErrorFilter';
import { RedisModule } from './shared/infra/redis/RedisModule';
import { SharedModule } from './shared/SharedModule';
import { RateLimitInterceptor } from './shared/presentation/interceptors/RateLimitInterceptor';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    SharedModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ExpertsModule,
    LaunchesModule,
    MetaModule,
    TrackingModule,
    LeadsModule,
    TwoFactorModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: DomainErrorFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
})
export class AppModule {}
