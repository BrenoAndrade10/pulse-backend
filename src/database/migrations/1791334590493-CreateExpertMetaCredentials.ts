import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpertMetaCredentials1791334590493 implements MigrationInterface {
  name = 'CreateExpertMetaCredentials1791334590493';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "expert_meta_credentials" (
        "id" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "metaUserId" varchar(255),
        "instagramUserId" varchar(255),
        "instagramUsername" varchar(255),
        "pageId" varchar(255),
        "pageName" varchar(255),
        "accessTokenEncrypted" text NOT NULL,
        "accessTokenIv" varchar(64) NOT NULL,
        "accessTokenAuthTag" varchar(64) NOT NULL,
        "refreshTokenEncrypted" text,
        "refreshTokenIv" varchar(64),
        "refreshTokenAuthTag" varchar(64),
        "tokenExpiresAt" timestamp,
        "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_expert_meta_credentials" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expert_meta_credentials_expert_active"
      ON "expert_meta_credentials" ("expertId", "isActive")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expert_meta_credentials_instagram_user"
      ON "expert_meta_credentials" ("instagramUserId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_expert_meta_credentials_instagram_user"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_expert_meta_credentials_expert_active"',
    );
    await queryRunner.query('DROP TABLE "expert_meta_credentials"');
  }
}
