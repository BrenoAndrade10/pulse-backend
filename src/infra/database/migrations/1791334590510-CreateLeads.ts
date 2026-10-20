import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Um lead por pessoa e por expert. Nome, e-mail, telefone e campos
 * personalizados ficam cifrados (AES-256-GCM) num único blob; e-mail e
 * telefone também têm um HMAC, para reconhecer a mesma pessoa sem decifrar.
 */
export class CreateLeads1791334590510 implements MigrationInterface {
  name = 'CreateLeads1791334590510';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "leads" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "emailHash" varchar(64),
        "phoneHash" varchar(64),
        "profileEncrypted" text NOT NULL,
        "profileIv" varchar(64) NOT NULL,
        "profileAuthTag" varchar(64) NOT NULL,
        "consent" boolean,
        "firstSeenAt" timestamp NOT NULL,
        "lastSeenAt" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_leads" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leads_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_leads_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_leads_identity"
          CHECK ("emailHash" IS NOT NULL OR "phoneHash" IS NOT NULL)
      )
    `);

    // A mesma pessoa é um lead só: pelo e-mail, ou pelo telefone quando não há e-mail.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_leads_email"
      ON "leads" ("tenantId", "expertId", "emailHash")
      WHERE "emailHash" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_leads_phone_without_email"
      ON "leads" ("tenantId", "expertId", "phoneHash")
      WHERE "emailHash" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_leads_phone"
      ON "leads" ("tenantId", "expertId", "phoneHash")
      WHERE "phoneHash" IS NOT NULL
    `);
    // Listagem e exportação: mais recentes primeiro, paginando por cursor.
    await queryRunner.query(`
      CREATE INDEX "IDX_leads_recent"
      ON "leads" ("tenantId", "expertId", "lastSeenAt" DESC, "id" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "leads"');
  }
}
