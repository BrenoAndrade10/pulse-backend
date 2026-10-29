import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTwoFactorRecoveryCodes1791334590516 implements MigrationInterface {
  name = 'CreateTwoFactorRecoveryCodes1791334590516';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "two_factor_recovery_codes" (
        "id" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "codeHash" varchar(64) NOT NULL,
        "usedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_two_factor_recovery_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_two_factor_recovery_codes_hash" UNIQUE ("codeHash"),
        CONSTRAINT "FK_two_factor_recovery_codes_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_two_factor_recovery_codes_user"
      ON "two_factor_recovery_codes" ("userId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "two_factor_recovery_codes"');
  }
}
