import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTrustedDevices1791334590517 implements MigrationInterface {
  name = 'CreateTrustedDevices1791334590517';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trusted_devices" (
        "id" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "label" varchar(120) NOT NULL,
        "expiresAt" timestamp NOT NULL,
        "lastUsedAt" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_trusted_devices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trusted_devices_hash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_trusted_devices_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_trusted_devices_user_expiration"
      ON "trusted_devices" ("userId", "expiresAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "trusted_devices"');
  }
}
