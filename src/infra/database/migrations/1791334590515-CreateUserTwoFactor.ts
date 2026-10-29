import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTwoFactor1791334590515 implements MigrationInterface {
  name = 'CreateUserTwoFactor1791334590515';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_two_factor" (
        "userId" uuid NOT NULL,
        "secretEncrypted" text NOT NULL,
        "secretIv" varchar(32) NOT NULL,
        "secretAuthTag" varchar(32) NOT NULL,
        "confirmedAt" timestamp,
        "lastUsedStep" bigint,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_user_two_factor" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_user_two_factor_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "user_two_factor"');
  }
}
