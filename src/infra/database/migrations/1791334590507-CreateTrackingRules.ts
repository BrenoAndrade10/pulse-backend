import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Regras de evento do pixel: qual elemento da página dispara qual evento.
 * Criadas pelo editor visual que roda na página do cliente.
 */
export class CreateTrackingRules1791334590507 implements MigrationInterface {
  name = 'CreateTrackingRules1791334590507';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tracking_rules" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "pixelId" uuid NOT NULL,
        "pageUrl" varchar(2048) NOT NULL,
        "scope" varchar(8) NOT NULL,
        "trigger" varchar(16) NOT NULL,
        "eventName" varchar(40) NOT NULL,
        "element" jsonb NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_tracking_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tracking_rules_pixel"
          FOREIGN KEY ("pixelId") REFERENCES "tracking_pixels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tracking_rules_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tracking_rules_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_tracking_rules_scope" CHECK ("scope" IN ('page', 'site')),
        CONSTRAINT "CHK_tracking_rules_trigger" CHECK ("trigger" IN ('click', 'submit')),
        CONSTRAINT "CHK_tracking_rules_event_name"
          CHECK ("eventName" ~ '^[A-Za-z][A-Za-z0-9_]{0,39}$'),
        CONSTRAINT "CHK_tracking_rules_element"
          CHECK (jsonb_typeof("element") = 'object' AND "element" ? 'selector')
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tracking_rules_pixel_page"
      ON "tracking_rules" ("pixelId", "pageUrl")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tracking_rules"');
  }
}
