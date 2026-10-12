import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/DatabaseModule';
import { AuthModule } from './modules/auth/AuthModule';
import { ExpertsModule } from './modules/experts/ExpertsModule';
import { MetaModule } from './modules/meta/MetaModule';
import { TenantsModule } from './modules/tenants/TenantsModule';
import { UsersModule } from './modules/users/UsersModule';
import { DomainErrorFilter } from './shared/filters/DomainErrorFilter';
import { RedisModule } from './shared/infra/redis/RedisModule';
import { SharedModule } from './shared/SharedModule';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    SharedModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ExpertsModule,
    MetaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: DomainErrorFilter,
    },
  ],
})
export class AppModule {}
