import type { DataSourceOptions } from 'typeorm';
import { Environment } from '../config/Environment';
import { ExpertOrmEntity } from '../modules/experts/infra/entities/ExpertOrmEntity';
import { ExpertMetaCredentialOrmEntity } from '../modules/meta/infra/entities/ExpertMetaCredentialOrmEntity';
import { TenantOrmEntity } from '../modules/tenants/infra/entities/TenantOrmEntity';
import { TenantUserOrmEntity } from '../modules/tenants/infra/entities/TenantUserOrmEntity';
import { UserOrmEntity } from '../modules/users/infra/entities/UserOrmEntity';
import { CreateUsers1791334590492 } from './migrations/1791334590492-CreateUsers';
import { CreateExpertMetaCredentials1791334590493 } from './migrations/1791334590493-CreateExpertMetaCredentials';
import { CreateTenantsTenantUsersExperts1791334590494 } from './migrations/1791334590494-CreateTenantsTenantUsersExperts';

export function buildDataSourceOptions(): DataSourceOptions {
  Environment.assertInitialized();

  const databaseUrl =
    Environment.vars.DATABASE_URL ??
    Environment.vars.NEON_DATABASE_URL ??
    Environment.vars.POSTGRES_URL;

  if (!databaseUrl) {
    throw new Error(
      'Configure DATABASE_URL com a connection string do Postgres/Neon.',
    );
  }

  return {
    type: 'postgres',
    url: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
    entities: [
      UserOrmEntity,
      TenantOrmEntity,
      TenantUserOrmEntity,
      ExpertOrmEntity,
      ExpertMetaCredentialOrmEntity,
    ],
    migrations: [
      CreateUsers1791334590492,
      CreateExpertMetaCredentials1791334590493,
      CreateTenantsTenantUsersExperts1791334590494,
    ],
    synchronize: false,
    migrationsRun: false,
  };
}
