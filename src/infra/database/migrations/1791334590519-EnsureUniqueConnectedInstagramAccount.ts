import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureUniqueConnectedInstagramAccount1791334590519 implements MigrationInterface {
  name = 'EnsureUniqueConnectedInstagramAccount1791334590519';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_integration_accounts_instagram_connected"
      ON "integration_accounts" ("provider", "type", "externalId")
      WHERE "provider" = 'instagram'
        AND "type" = 'instagram_account'
        AND "disconnectedAt" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "UQ_integration_accounts_instagram_connected"',
    );
  }
}
