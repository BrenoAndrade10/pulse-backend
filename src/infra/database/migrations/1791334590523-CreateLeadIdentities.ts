import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeadIdentities1791334590523 implements MigrationInterface {
  name = 'CreateLeadIdentities1791334590523';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lead_identities" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "leadId" uuid NOT NULL,
        "anonymousId" varchar(64) NOT NULL,
        "clickId" varchar(64),
        "source" varchar(32) NOT NULL DEFAULT 'form_submit',
        "confidence" varchar(16) NOT NULL DEFAULT 'high',
        "firstSeenAt" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_lead_identities" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lead_identities_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_lead_identities_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_lead_identities_lead"
          FOREIGN KEY ("leadId") REFERENCES "leads"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_lead_identities_source"
          CHECK ("source" IN ('form_submit')),
        CONSTRAINT "CHK_lead_identities_confidence"
          CHECK ("confidence" IN ('high', 'medium', 'low')),
        CONSTRAINT "UQ_lead_identities_tenant_lead_anonymous"
          UNIQUE ("tenantId", "leadId", "anonymousId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lead_identities_tenant_anonymous"
      ON "lead_identities" ("tenantId", "anonymousId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lead_identities_tenant_click"
      ON "lead_identities" ("tenantId", "clickId")
      WHERE "clickId" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_lead_identities_tenant_click"');
    await queryRunner.query(
      'DROP INDEX "IDX_lead_identities_tenant_anonymous"',
    );
    await queryRunner.query('DROP TABLE "lead_identities"');
  }
}
