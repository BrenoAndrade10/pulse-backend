import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1791334590492 implements MigrationInterface {
  name = 'CreateUsers1791334590492';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL,
        "firstName" varchar(120) NOT NULL,
        "lastName" varchar(120),
        "email" varchar(255) NOT NULL,
        "passwordHash" text NOT NULL,
        "role" varchar(50) NOT NULL DEFAULT 'member',
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "lastLoginAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_status"
      ON "users" ("status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_users_status"');
    await queryRunner.query('DROP TABLE "users"');
  }
}
