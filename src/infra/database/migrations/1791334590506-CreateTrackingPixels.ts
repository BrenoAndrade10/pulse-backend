import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Pixel de rastreamento: um por expert, com os domínios que podem enviar eventos. */
export class CreateTrackingPixels1791334590506 implements MigrationInterface {
  name = 'CreateTrackingPixels1791334590506';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tracking_pixels" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "publicKey" varchar(32) NOT NULL,
        "allowedDomains" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "lastEventAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_tracking_pixels" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tracking_pixels_expert" UNIQUE ("tenantId", "expertId"),
        CONSTRAINT "UQ_tracking_pixels_public_key" UNIQUE ("publicKey"),
        CONSTRAINT "FK_tracking_pixels_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tracking_pixels_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_tracking_pixels_public_key"
          CHECK ("publicKey" ~ '^PX_[A-Za-z0-9]{20}$'),
        CONSTRAINT "CHK_tracking_pixels_allowed_domains"
          CHECK (
            jsonb_typeof("allowedDomains") = 'array'
            AND jsonb_array_length("allowedDomains") <= 20
          )
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tracking_pixels"');
  }
}
