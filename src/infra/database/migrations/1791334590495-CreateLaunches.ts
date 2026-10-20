import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLaunches1791334590495 implements MigrationInterface {
  name = 'CreateLaunches1791334590495';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_experts_tenant_id"
      ON "experts" ("tenantId", "id")
    `);

    await queryRunner.query(`
      CREATE TABLE "launches" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "name" varchar(180) NOT NULL,
        "description" text,
        "status" varchar(50) NOT NULL DEFAULT 'draft',
        "startsAt" timestamptz,
        "endsAt" timestamptz,
        "timezone" varchar(100) NOT NULL DEFAULT 'UTC',
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_launches" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_launches_status"
          CHECK ("status" IN ('draft', 'planned', 'in_progress', 'completed', 'canceled', 'archived')),
        CONSTRAINT "CHK_launches_date_range"
          CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" >= "startsAt"),
        CONSTRAINT "FK_launches_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_launches_expert_tenant"
          FOREIGN KEY ("tenantId", "expertId")
          REFERENCES "experts"("tenantId", "id")
          ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_launches_tenant_status"
      ON "launches" ("tenantId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_launches_tenant_expert"
      ON "launches" ("tenantId", "expertId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_launches_tenant_expert"');
    await queryRunner.query('DROP INDEX "IDX_launches_tenant_status"');
    await queryRunner.query('DROP TABLE "launches"');
    await queryRunner.query('DROP INDEX "IDX_experts_tenant_id"');
  }
}
