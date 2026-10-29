import { Global, Module } from '@nestjs/common';
import { ID_GENERATOR } from './domain/IdGenerator';
import { PASSWORD_HASHER } from './domain/PasswordHasher';
import { EMAIL_SENDER } from './domain/EmailSender';
import { LogEmailSender } from './infra/email/LogEmailSender';
import { ResendEmailSender } from './infra/email/ResendEmailSender';
import { Environment } from '../config/Environment';
import { Argon2PasswordHasher } from './infra/hashing/Argon2PasswordHasher';
import { UuidV7IdGenerator } from './infra/ids/UuidV7IdGenerator';
import { RateLimiter } from './infra/redis/RateLimiter';

@Global()
@Module({
  providers: [
    {
      provide: ID_GENERATOR,
      useClass: UuidV7IdGenerator,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    LogEmailSender,
    ResendEmailSender,
    {
      provide: EMAIL_SENDER,
      inject: [LogEmailSender, ResendEmailSender],
      useFactory: (
        logEmailSender: LogEmailSender,
        resendEmailSender: ResendEmailSender,
      ) =>
        Environment.vars.RESEND_API_KEY ? resendEmailSender : logEmailSender,
    },
    RateLimiter,
  ],
  exports: [ID_GENERATOR, PASSWORD_HASHER, EMAIL_SENDER, RateLimiter],
})
export class SharedModule {}
