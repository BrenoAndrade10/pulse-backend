import type { MigrationInterface, QueryRunner } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

type LegacyAccountRow = {
  credentialId: string;
  tenantId: string;
  expertId: string;
  instagramUserId: string;
  instagramUsername: string | null;
  pageId: string | null;
  pageName: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'revoked';
  revokedAt: Date | null;
};

/**
 * Contas conectadas de qualquer integração, sem segredo: é o que as telas e
 * listagens leem.
 *
 * A FK composta com a credencial (id, tenant, expert e provedor) garante no
 * banco que a conta nunca aponta para a credencial de outra empresa, expert
 * ou provedor. Copia a conta do Instagram de cada credencial antiga.
 */
export class CreateIntegrationAccounts1791334590500 implements MigrationInterface {
  name = 'CreateIntegrationAccounts1791334590500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "integration_accounts" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "credentialId" uuid NOT NULL,
        "provider" varchar(32) NOT NULL,
        "type" varchar(48) NOT NULL,
        "externalId" varchar(255) NOT NULL,
        "displayName" varchar(255),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "connectedAt" timestamp NOT NULL,
        "disconnectedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_integration_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_integration_accounts_credential"
          FOREIGN KEY ("credentialId", "tenantId", "expertId", "provider")
          REFERENCES "integration_credentials" ("id", "tenantId", "expertId", "provider")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_integration_accounts_type"
          CHECK ("type" IN (
            'instagram_account',
            'ad_account',
            'pixel',
            'whatsapp_business_account',
            'phone_number'
          )),
        CONSTRAINT "CHK_integration_accounts_metadata"
          CHECK (jsonb_typeof("metadata") = 'object'),
        CONSTRAINT "CHK_integration_accounts_disconnected_after_connected"
          CHECK ("disconnectedAt" IS NULL OR "disconnectedAt" >= "connectedAt")
      )
    `);

    // A mesma conta não fica conectada duas vezes no mesmo expert.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_integration_accounts_connected"
      ON "integration_accounts" ("tenantId", "expertId", "provider", "type", "externalId")
      WHERE "disconnectedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_integration_accounts_tenant_provider"
      ON "integration_accounts" ("tenantId", "provider")
      WHERE "disconnectedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_integration_accounts_credential"
      ON "integration_accounts" ("credentialId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_integration_accounts_provider_external"
      ON "integration_accounts" ("provider", "externalId")
    `);

    await this.copyLegacyAccounts(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "integration_accounts"');
  }

  private async copyLegacyAccounts(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT legacy."id" AS "credentialId", legacy."tenantId", legacy."expertId",
             legacy."instagramUserId", legacy."instagramUsername",
             legacy."pageId", legacy."pageName",
             legacy."createdAt", legacy."updatedAt",
             credential."status", credential."revokedAt"
      FROM "expert_meta_credentials" legacy
      JOIN "integration_credentials" credential ON credential."id" = legacy."id"
      WHERE legacy."instagramUserId" IS NOT NULL
    `)) as LegacyAccountRow[];

    for (const row of rows) {
      const metadata = Object.fromEntries(
        Object.entries({ pageId: row.pageId, pageName: row.pageName }).filter(
          ([, value]) => value !== null && value !== undefined,
        ),
      );
      const disconnectedAt =
        row.status === 'active'
          ? null
          : row.revokedAt && row.revokedAt >= row.createdAt
            ? row.revokedAt
            : row.createdAt;

      await queryRunner.query(
        `
          INSERT INTO "integration_accounts" (
            "id", "tenantId", "expertId", "credentialId", "provider", "type",
            "externalId", "displayName", "metadata", "connectedAt",
            "disconnectedAt", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, 'instagram', 'instagram_account', $5, $6,
            $7::jsonb, $8, $9, $10, $11
          )
        `,
        [
          uuidv7(),
          row.tenantId,
          row.expertId,
          row.credentialId,
          row.instagramUserId,
          row.instagramUsername,
          JSON.stringify(metadata),
          row.createdAt,
          disconnectedAt,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }
  }
}
