import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Inscrição de um lead num lançamento: uma por par, com quantos cadastros fez nele. */
export class CreateLeadLaunches1791334590511 implements MigrationInterface {
  name = 'CreateLeadLaunches1791334590511';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lead_launches" (
        "leadId" uuid NOT NULL,
        "launchId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "firstSubmittedAt" timestamp NOT NULL,
        "lastSubmittedAt" timestamp NOT NULL,
        "submissionsCount" integer NOT NULL DEFAULT 1,
        "firstUtm" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "PK_lead_launches" PRIMARY KEY ("leadId", "launchId"),
        CONSTRAINT "FK_lead_launches_lead"
          FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lead_launches_launch"
          FOREIGN KEY ("launchId") REFERENCES "launches"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_lead_launches_count" CHECK ("submissionsCount" >= 1)
      )
    `);

    // Leads de um lançamento, na ordem de chegada.
    await queryRunner.query(`
      CREATE INDEX "IDX_lead_launches_launch"
      ON "lead_launches" ("launchId", "lastSubmittedAt" DESC, "leadId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "lead_launches"');
  }
}
