import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Configuração por página do pixel. Por enquanto: a qual lançamento os
 * cadastros da página pertencem.
 */
export class CreateTrackingPages1791334590509 implements MigrationInterface {
  name = 'CreateTrackingPages1791334590509';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tracking_pages" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "pixelId" uuid NOT NULL,
        "pageUrl" varchar(2048) NOT NULL,
        "launchId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_tracking_pages" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tracking_pages_page" UNIQUE ("pixelId", "pageUrl"),
        CONSTRAINT "FK_tracking_pages_pixel"
          FOREIGN KEY ("pixelId") REFERENCES "tracking_pixels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tracking_pages_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tracking_pages_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tracking_pages_launch"
          FOREIGN KEY ("launchId") REFERENCES "launches"("id") ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tracking_pages"');
  }
}
