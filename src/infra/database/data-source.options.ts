import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { Environment } from '../../config/Environment';

const entitiesPath = join(
  __dirname,
  '..',
  '..',
  'modules',
  '**',
  'infra',
  'entities',
  '*OrmEntity.{ts,js}',
);

const migrationsPath = join(__dirname, 'migrations', '*.{ts,js}');

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
    entities: [entitiesPath],
    migrations: [migrationsPath],
    synchronize: false,
    migrationsRun: false,
  };
}
