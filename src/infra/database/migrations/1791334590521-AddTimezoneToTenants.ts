import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimezoneToTenants1791334590521 implements MigrationInterface {
  name = 'AddTimezoneToTenants1791334590521';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN "timezone" varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo'
    `);

    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD CONSTRAINT "CHK_tenants_timezone_format"
      CHECK ("timezone" ~ '^(UTC|[A-Za-z]+(?:[._+-][A-Za-z0-9]+)*(?:/[A-Za-z0-9._+-]+)+)$')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP CONSTRAINT "CHK_tenants_timezone_format"
    `);

    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP COLUMN "timezone"
    `);
  }
}
