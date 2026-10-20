import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Cada envio de formulário: página, regra, lançamento e UTMs. Sem os dados pessoais. */
export class CreateLeadSubmissions1791334590512 implements MigrationInterface {
  name = 'CreateLeadSubmissions1791334590512';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lead_submissions" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "leadId" uuid NOT NULL,
        "launchId" uuid,
        "pixelId" uuid NOT NULL,
        "ruleId" uuid,
        "eventId" uuid NOT NULL,
        "pageUrl" varchar(2048) NOT NULL,
        "utm" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "submittedAt" timestamp NOT NULL,
        CONSTRAINT "PK_lead_submissions" PRIMARY KEY ("id"),
        -- O mesmo envio reenviado pelo navegador não vira dois cadastros.
        CONSTRAINT "UQ_lead_submissions_event" UNIQUE ("pixelId", "eventId"),
        CONSTRAINT "FK_lead_submissions_lead"
          FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lead_submissions_launch"
          FOREIGN KEY ("launchId") REFERENCES "launches"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_lead_submissions_pixel"
          FOREIGN KEY ("pixelId") REFERENCES "tracking_pixels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lead_submissions_rule"
          FOREIGN KEY ("ruleId") REFERENCES "tracking_rules"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lead_submissions_lead"
      ON "lead_submissions" ("leadId", "submittedAt" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "lead_submissions"');
  }
}
