import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLinks1791334590520 implements MigrationInterface {
  name = 'CreateLinks1791334590520';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "links" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid,
        "launchId" uuid,
        "name" varchar(120) NOT NULL,
        "destinationUrl" text NOT NULL,
        "code" varchar(16) NOT NULL,
        "channel" varchar(32) NOT NULL,
        "placement" varchar(64),
        "campaign" varchar(120),
        "utmSource" varchar(120),
        "utmMedium" varchar(120),
        "utmCampaign" varchar(120),
        "utmContent" varchar(120),
        "utmTerm" varchar(120),
        "purpose" varchar(32) NOT NULL DEFAULT 'other',
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "destinationVersion" integer NOT NULL DEFAULT 1,
        "createdBy" uuid,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "deletedAt" timestamp,
        CONSTRAINT "PK_links" PRIMARY KEY ("id"),
        CONSTRAINT "FK_links_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_links_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_links_launch"
          FOREIGN KEY ("launchId") REFERENCES "launches"("id"),
        CONSTRAINT "CHK_links_destination_url_length"
          CHECK (char_length("destinationUrl") <= 2048),
        CONSTRAINT "CHK_links_code_format"
          CHECK ("code" ~ '^[a-z0-9]{4,16}$'),
        CONSTRAINT "CHK_links_channel"
          CHECK ("channel" IN (
            'instagram_bio',
            'instagram_story',
            'whatsapp_group',
            'whatsapp_private',
            'email',
            'telegram',
            'ads',
            'other'
          )),
        CONSTRAINT "CHK_links_purpose"
          CHECK ("purpose" IN ('offer', 'signup', 'content', 'community', 'other')),
        CONSTRAINT "CHK_links_status"
          CHECK ("status" IN ('active', 'inactive'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_links_code"
      ON "links" ("code")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_links_tenant_status"
      ON "links" ("tenantId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_links_tenant_expert"
      ON "links" ("tenantId", "expertId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_links_tenant_launch"
      ON "links" ("tenantId", "launchId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_links_tenant_launch"');
    await queryRunner.query('DROP INDEX "IDX_links_tenant_expert"');
    await queryRunner.query('DROP INDEX "IDX_links_tenant_status"');
    await queryRunner.query('DROP INDEX "UQ_links_code"');
    await queryRunner.query('DROP TABLE "links"');
  }
}
