import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureUniqueConnectedWhatsAppNumber1791334590513 implements MigrationInterface {
  name = 'EnsureUniqueConnectedWhatsAppNumber1791334590513';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_integration_accounts_whatsapp_phone_connected"
      ON "integration_accounts" ("provider", "type", "externalId")
      WHERE "provider" = 'whatsapp'
        AND "type" = 'phone_number'
        AND "disconnectedAt" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "UQ_integration_accounts_whatsapp_phone_connected"',
    );
  }
}
