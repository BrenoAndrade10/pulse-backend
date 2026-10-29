import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokens1791334590514 implements MigrationInterface {
  name = 'CreatePasswordResetTokens1791334590514';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "expiresAt" timestamp NOT NULL,
        "usedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_password_reset_tokens_hash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_password_reset_tokens_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_password_reset_tokens_user"
      ON "password_reset_tokens" ("userId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "password_reset_tokens"');
  }
}
