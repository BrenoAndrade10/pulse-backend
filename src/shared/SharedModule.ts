import { Global, Module } from '@nestjs/common';
import { ID_GENERATOR } from './domain/IdGenerator';
import { PASSWORD_HASHER } from './domain/PasswordHasher';
import { Argon2PasswordHasher } from './infra/hashing/Argon2PasswordHasher';
import { UuidV7IdGenerator } from './infra/ids/UuidV7IdGenerator';

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
  ],
  exports: [ID_GENERATOR, PASSWORD_HASHER],
})
export class SharedModule {}
