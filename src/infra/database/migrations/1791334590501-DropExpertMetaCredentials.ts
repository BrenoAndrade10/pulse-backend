import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  decryptToken,
  encryptToken,
  integrationTokenAad,
  metaTokenAad,
  migrationTokenKey,
} from '../migration-support/tokenCrypto';

type IntegrationRow = {
  id: string;
  tenantId: string;
  expertId: string;
  externalUserId: string | null;
  accessTokenEncrypted: string | null;
  accessTokenIv: string | null;
  accessTokenAuthTag: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
  status: 'active' | 'revoked';
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  instagramUserId: string | null;
  instagramUsername: string | null;
  pageId: string | null;
  pageName: string | null;
};

/**
 * Remove `expert_meta_credentials`: os dados já estão em
 * `integration_credentials` e `integration_accounts`.
 *
 * O `down` recria a tabela como ela estava depois da migration
 * 1791334590498 e devolve só as credenciais do Instagram (os outros
 * provedores não existiam nela).
 */
export class DropExpertMetaCredentials1791334590501 implements MigrationInterface {
  name = 'DropExpertMetaCredentials1791334590501';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "expert_meta_credentials"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "expert_meta_credentials" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "metaUserId" varchar(255),
        "instagramUserId" varchar(255),
        "instagramUsername" varchar(255),
        "pageId" varchar(255),
        "pageName" varchar(255),
        "accessTokenEncrypted" text,
        "accessTokenIv" varchar(64),
        "accessTokenAuthTag" varchar(64),
        "refreshTokenEncrypted" text,
        "refreshTokenIv" varchar(64),
        "refreshTokenAuthTag" varchar(64),
        "tokenExpiresAt" timestamp,
        "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "revokedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_expert_meta_credentials" PRIMARY KEY ("id"),
        CONSTRAINT "FK_expert_meta_credentials_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_expert_meta_credentials_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_expert_meta_credentials_token_lifecycle" CHECK (
          (
            "isActive"
            AND "accessTokenEncrypted" IS NOT NULL
            AND "accessTokenIv" IS NOT NULL
            AND "accessTokenAuthTag" IS NOT NULL
          )
          OR (
            NOT "isActive"
            AND "accessTokenEncrypted" IS NULL
            AND "refreshTokenEncrypted" IS NULL
          )
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expert_meta_credentials_tenant_expert_active"
      ON "expert_meta_credentials" ("tenantId", "expertId", "isActive")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expert_meta_credentials_tenant_instagram_user"
      ON "expert_meta_credentials" ("tenantId", "instagramUserId")
    `);

    await this.restoreInstagramCredentials(queryRunner);
  }

  private async restoreInstagramCredentials(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // Uma conta do Instagram por credencial; se houver mais, fica a mais recente.
    const rows = (await queryRunner.query(`
      SELECT credential."id", credential."tenantId", credential."expertId",
             credential."externalUserId",
             credential."accessTokenEncrypted", credential."accessTokenIv",
             credential."accessTokenAuthTag", credential."tokenExpiresAt",
             credential."scopes", credential."status", credential."revokedAt",
             credential."createdAt", credential."updatedAt",
             account."externalId" AS "instagramUserId",
             account."displayName" AS "instagramUsername",
             account."metadata"->>'pageId' AS "pageId",
             account."metadata"->>'pageName' AS "pageName"
      FROM "integration_credentials" credential
      LEFT JOIN LATERAL (
        SELECT "externalId", "displayName", "metadata"
        FROM "integration_accounts"
        WHERE "credentialId" = credential."id"
          AND "type" = 'instagram_account'
        ORDER BY "connectedAt" DESC
        LIMIT 1
      ) account ON true
      WHERE credential."provider" = 'instagram'
    `)) as IntegrationRow[];

    if (rows.length === 0) return;

    const key = rows.some((row) => row.status === 'active')
      ? migrationTokenKey()
      : null;

    for (const row of rows) {
      const isActive = row.status === 'active';
      let token: {
        encryptedValue: string;
        iv: string;
        authTag: string;
      } | null = null;

      if (isActive && key) {
        const owner = { ...row, credentialId: row.id };
        const plain = decryptToken(
          key,
          {
            encryptedValue: row.accessTokenEncrypted!,
            iv: row.accessTokenIv!,
            authTag: row.accessTokenAuthTag!,
          },
          integrationTokenAad({ ...owner, provider: 'instagram' }),
          row.id,
        );
        token = encryptToken(key, plain, metaTokenAad(owner));
      }

      await queryRunner.query(
        `
          INSERT INTO "expert_meta_credentials" (
            "id", "tenantId", "expertId", "metaUserId",
            "instagramUserId", "instagramUsername", "pageId", "pageName",
            "accessTokenEncrypted", "accessTokenIv", "accessTokenAuthTag",
            "tokenExpiresAt", "scopes", "isActive", "revokedAt",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb,
            $14, $15, $16, $17
          )
        `,
        [
          row.id,
          row.tenantId,
          row.expertId,
          row.externalUserId,
          row.instagramUserId,
          row.instagramUsername,
          row.pageId,
          row.pageName,
          token?.encryptedValue ?? null,
          token?.iv ?? null,
          token?.authTag ?? null,
          row.tokenExpiresAt,
          JSON.stringify(row.scopes ?? []),
          isActive,
          row.revokedAt,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }
  }
}
