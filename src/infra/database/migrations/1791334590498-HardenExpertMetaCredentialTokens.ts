import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Environment } from '../../../config/Environment';
import { parseAes256Key } from '../../../shared/infra/crypto/parseAes256Key';

type TokenRow = {
  id: string;
  tenantId: string;
  expertId: string;
  accessTokenEncrypted: string;
  accessTokenIv: string;
  accessTokenAuthTag: string;
};

type EncryptedToken = { encryptedValue: string; iv: string; authTag: string };

/**
 * - Credenciais inativas perdem o token (fica só o histórico).
 * - Tokens ativos passam a ser cifrados com AAD, presos ao próprio registro.
 * - Um CHECK impede credencial ativa sem token e inativa com token.
 *
 * A cifra é copiada aqui de propósito: a migration não pode mudar junto com o
 * MetaTokenEncryptionService.
 */
export class HardenExpertMetaCredentialTokens1791334590498 implements MigrationInterface {
  name = 'HardenExpertMetaCredentialTokens1791334590498';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials"
        ALTER COLUMN "accessTokenEncrypted" DROP NOT NULL,
        ALTER COLUMN "accessTokenIv" DROP NOT NULL,
        ALTER COLUMN "accessTokenAuthTag" DROP NOT NULL,
        ADD COLUMN "revokedAt" timestamp
    `);

    await queryRunner.query(`
      UPDATE "expert_meta_credentials"
      SET "accessTokenEncrypted" = NULL,
          "accessTokenIv" = NULL,
          "accessTokenAuthTag" = NULL,
          "refreshTokenEncrypted" = NULL,
          "refreshTokenIv" = NULL,
          "refreshTokenAuthTag" = NULL,
          "revokedAt" = COALESCE("revokedAt", "updatedAt")
      WHERE "isActive" = false
    `);

    await this.reencryptActiveTokens(queryRunner, 'up');

    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials"
      ADD CONSTRAINT "CHK_expert_meta_credentials_token_lifecycle" CHECK (
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
    `);
  }

  /** Os tokens apagados das credenciais inativas não voltam. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials"
      DROP CONSTRAINT "CHK_expert_meta_credentials_token_lifecycle"
    `);

    await this.reencryptActiveTokens(queryRunner, 'down');

    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials" DROP COLUMN "revokedAt"
    `);
  }

  private async reencryptActiveTokens(
    queryRunner: QueryRunner,
    direction: 'up' | 'down',
  ): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT "id", "tenantId", "expertId",
             "accessTokenEncrypted", "accessTokenIv", "accessTokenAuthTag"
      FROM "expert_meta_credentials"
      WHERE "isActive" = true AND "accessTokenEncrypted" IS NOT NULL
    `)) as TokenRow[];

    if (rows.length === 0) return;

    const key = this.key();

    for (const row of rows) {
      const aad = Buffer.from(
        `meta-token:v1:access_token:${row.tenantId}:${row.expertId}:${row.id}`,
        'utf8',
      );
      const current = {
        encryptedValue: row.accessTokenEncrypted,
        iv: row.accessTokenIv,
        authTag: row.accessTokenAuthTag,
      };
      const plain =
        direction === 'up'
          ? this.decrypt(key, current, null, row.id)
          : this.decrypt(key, current, aad, row.id);
      const next = this.encrypt(key, plain, direction === 'up' ? aad : null);

      await queryRunner.query(
        `
          UPDATE "expert_meta_credentials"
          SET "accessTokenEncrypted" = $1,
              "accessTokenIv" = $2,
              "accessTokenAuthTag" = $3
          WHERE "id" = $4
        `,
        [next.encryptedValue, next.iv, next.authTag, row.id],
      );
    }
  }

  private key(): Buffer {
    Environment.assertInitialized();

    const value = Environment.vars.META_TOKENS_ENCRYPTION_KEY;
    const key = value ? parseAes256Key(value) : null;

    if (!key) {
      throw new Error(
        'Configure META_TOKENS_ENCRYPTION_KEY (a mesma chave usada para cifrar os tokens atuais) antes de rodar esta migration.',
      );
    }

    return key;
  }

  private encrypt(
    key: Buffer,
    value: string,
    aad: Buffer | null,
  ): EncryptedToken {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    if (aad) cipher.setAAD(aad);
    const encryptedValue = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    return {
      encryptedValue: encryptedValue.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  private decrypt(
    key: Buffer,
    token: EncryptedToken,
    aad: Buffer | null,
    credentialId: string,
  ): string {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(token.iv, 'base64'),
      );
      if (aad) decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(token.authTag, 'base64'));

      return Buffer.concat([
        decipher.update(Buffer.from(token.encryptedValue, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error(
        `Não foi possível decifrar o token da credencial ${credentialId}. Confira se META_TOKENS_ENCRYPTION_KEY é a chave usada para gravá-lo.`,
      );
    }
  }
}
