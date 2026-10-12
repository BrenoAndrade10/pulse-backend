import { Global, Module } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { Environment } from '../../../config/Environment';
import { REDIS_CLIENT } from './tokens';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis({
          url: Environment.vars.UPSTASH_REDIS_REST_URL,
          token: Environment.vars.UPSTASH_REDIS_REST_TOKEN,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
