import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadHeat1791334590526 implements MigrationInterface {
  name = 'AddLeadHeat1791334590526';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leads"
        ADD COLUMN "heatScore" integer NOT NULL DEFAULT 0,
        ADD COLUMN "heatBand" varchar(8) NOT NULL DEFAULT 'cold',
        ADD COLUMN "heatCalculatedAt" timestamp NULL,
        ADD CONSTRAINT "CHK_leads_heat_band"
          CHECK ("heatBand" IN ('cold', 'warm', 'hot'))
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_leads_tenant_expert_heat_band"
      ON "leads" ("tenantId", "expertId", "heatBand")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_leads_tenant_expert_heat_band"');
    await queryRunner.query(`
      ALTER TABLE "leads"
        DROP CONSTRAINT "CHK_leads_heat_band",
        DROP COLUMN "heatCalculatedAt",
        DROP COLUMN "heatBand",
        DROP COLUMN "heatScore"
    `);
  }
}
