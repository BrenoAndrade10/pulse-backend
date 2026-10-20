import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  decryptToken,
  encryptToken,
  integrationTokenAad,
  metaTokenAad,
  migrationTokenKey,
} from '../migration-support/tokenCrypto';

type LegacyRow = {
  id: string;
  tenantId: string;
  expertId: string;
  metaUserId: string | null;
  accessTokenEncrypted: string | null;
  accessTokenIv: string | null;
  accessTokenAuthTag: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
  isActive: boolean;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Segredo de qualquer integração (Instagram, Meta Ads, WhatsApp...).
 *
 * Copia as credenciais de `expert_meta_credentials` como provider
 * `instagram`, mantendo os ids. Os tokens ativos são decifrados no formato da
 * tabela antiga e cifrados de novo com a AAD nova, que inclui o provedor.
 * Refresh tokens não são copiados: o Login do Instagram não os emite e o
 * código nunca os gravou.
 */
export class CreateIntegrationCredentials1791334590499 implements MigrationInterface {
  name = 'CreateIntegrationCredentials1791334590499';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "integration_credentials" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "provider" varchar(32) NOT NULL,
        "externalUserId" varchar(255),
        "accessTokenEncrypted" text,
        "accessTokenIv" varchar(64),
        "accessTokenAuthTag" varchar(64),
        "refreshTokenEncrypted" text,
        "refreshTokenIv" varchar(64),
        "refreshTokenAuthTag" varchar(64),
        "tokenExpiresAt" timestamp,
        "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" varchar(16) NOT NULL,
        "revokedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_integration_credentials" PRIMARY KEY ("id"),
        -- Alvo da FK composta de integration_accounts.
        CONSTRAINT "UQ_integration_credentials_owner"
          UNIQUE ("id", "tenantId", "expertId", "provider"),
        CONSTRAINT "FK_integration_credentials_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_integration_credentials_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_integration_credentials_provider"
          CHECK ("provider" IN ('instagram', 'meta_ads', 'whatsapp')),
        CONSTRAINT "CHK_integration_credentials_status"
          CHECK ("status" IN ('active', 'revoked')),
        CONSTRAINT "CHK_integration_credentials_scopes"
          CHECK (jsonb_typeof("scopes") = 'array'),
        CONSTRAINT "CHK_integration_credentials_refresh_token"
          CHECK (
            ("refreshTokenEncrypted" IS NULL) = ("refreshTokenIv" IS NULL)
            AND ("refreshTokenEncrypted" IS NULL) = ("refreshTokenAuthTag" IS NULL)
          ),
        CONSTRAINT "CHK_integration_credentials_token_lifecycle"
          CHECK (
            (
              "status" = 'active'
              AND "accessTokenEncrypted" IS NOT NULL
              AND "accessTokenIv" IS NOT NULL
              AND "accessTokenAuthTag" IS NOT NULL
              AND "revokedAt" IS NULL
            )
            OR (
              "status" = 'revoked'
              AND "accessTokenEncrypted" IS NULL
              AND "accessTokenIv" IS NULL
              AND "accessTokenAuthTag" IS NULL
              AND "refreshTokenEncrypted" IS NULL
              AND "revokedAt" IS NOT NULL
            )
          )
      )
    `);

    // No máximo uma credencial ativa por expert e provedor.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_integration_credentials_active"
      ON "integration_credentials" ("tenantId", "expertId", "provider")
      WHERE "status" = 'active'
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_integration_credentials_tenant_provider"
      ON "integration_credentials" ("tenantId", "provider")
      WHERE "status" = 'active'
    `);

    await this.copyLegacyCredentials(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "integration_credentials"');
  }

  private async copyLegacyCredentials(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT "id", "tenantId", "expertId", "metaUserId",
             "accessTokenEncrypted", "accessTokenIv", "accessTokenAuthTag",
             "tokenExpiresAt", "scopes", "isActive", "revokedAt",
             "createdAt", "updatedAt"
      FROM "expert_meta_credentials"
      ORDER BY "createdAt" DESC
    `)) as LegacyRow[];

    if (rows.length === 0) return;

    const key = rows.some((row) => row.isActive) ? migrationTokenKey() : null;
    // Garante o índice único: se houver mais de uma ativa por expert (não
    // deveria), só a mais recente continua ativa.
    const activeExperts = new Set<string>();

    for (const row of rows) {
      const owner = `${row.tenantId}:${row.expertId}`;
      const staysActive =
        row.isActive &&
        row.accessTokenEncrypted !== null &&
        !activeExperts.has(owner);
      let token: {
        encryptedValue: string;
        iv: string;
        authTag: string;
      } | null = null;

      if (staysActive && key) {
        activeExperts.add(owner);
        const plain = decryptToken(
          key,
          {
            encryptedValue: row.accessTokenEncrypted!,
            iv: row.accessTokenIv!,
            authTag: row.accessTokenAuthTag!,
          },
          metaTokenAad({ ...row, credentialId: row.id }),
          row.id,
        );
        token = encryptToken(
          key,
          plain,
          integrationTokenAad({
            ...row,
            credentialId: row.id,
            provider: 'instagram',
          }),
        );
      }

      await queryRunner.query(
        `
          INSERT INTO "integration_credentials" (
            "id", "tenantId", "expertId", "provider", "externalUserId",
            "accessTokenEncrypted", "accessTokenIv", "accessTokenAuthTag",
            "tokenExpiresAt", "scopes", "status", "revokedAt",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, 'instagram', $4, $5, $6, $7, $8, $9::jsonb, $10, $11,
            $12, $13
          )
        `,
        [
          row.id,
          row.tenantId,
          row.expertId,
          row.metaUserId,
          token?.encryptedValue ?? null,
          token?.iv ?? null,
          token?.authTag ?? null,
          row.tokenExpiresAt,
          JSON.stringify(row.scopes ?? []),
          token ? 'active' : 'revoked',
          token ? null : (row.revokedAt ?? row.updatedAt),
          row.createdAt,
          row.updatedAt,
        ],
      );
    }
  }
}
