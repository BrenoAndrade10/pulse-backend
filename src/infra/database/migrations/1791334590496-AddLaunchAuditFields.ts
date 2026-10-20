import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLaunchAuditFields1791334590496 implements MigrationInterface {
  name = 'AddLaunchAuditFields1791334590496';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "launches"
        ADD COLUMN "slug" varchar(180),
        ADD COLUMN "type" varchar(50) NOT NULL DEFAULT 'other',
        ADD COLUMN "deletedAt" timestamptz,
        ADD COLUMN "createdBy" uuid,
        ADD COLUMN "updatedBy" uuid,
        ADD COLUMN "deletedBy" uuid,
        ADD COLUMN "version" integer NOT NULL DEFAULT 1
    `);

    // IDs são únicos e formam um slug seguro para registros pré-existentes.
    await queryRunner.query(`
      UPDATE "launches" SET "slug" = "id"::text WHERE "slug" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "launches" ALTER COLUMN "slug" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "launches"
        ADD CONSTRAINT "CHK_launches_type"
          CHECK ("type" IN ('seed', 'internal', 'perpetual', 'other')),
        ADD CONSTRAINT "FK_launches_created_by"
          FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_launches_updated_by"
          FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_launches_deleted_by"
          FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_launches_tenant_slug_active"
      ON "launches" ("tenantId", "slug")
      WHERE "deletedAt" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_launches_tenant_deleted"
      ON "launches" ("tenantId", "deletedAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_launches_tenant_deleted"');
    await queryRunner.query('DROP INDEX "IDX_launches_tenant_slug_active"');
    await queryRunner.query(`
      ALTER TABLE "launches"
        DROP CONSTRAINT "FK_launches_deleted_by",
        DROP CONSTRAINT "FK_launches_updated_by",
        DROP CONSTRAINT "FK_launches_created_by",
        DROP CONSTRAINT "CHK_launches_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "launches"
        DROP COLUMN "version",
        DROP COLUMN "deletedBy",
        DROP COLUMN "updatedBy",
        DROP COLUMN "createdBy",
        DROP COLUMN "deletedAt",
        DROP COLUMN "type",
        DROP COLUMN "slug"
    `);
  }
}
