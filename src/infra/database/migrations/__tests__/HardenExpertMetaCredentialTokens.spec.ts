import { createCipheriv, randomBytes } from 'node:crypto';
import type { QueryRunner } from 'typeorm';
import { Environment } from '../../../../config/Environment';
import {
  decryptToken,
  type EncryptedToken,
  metaTokenAad,
} from '../../migration-support/tokenCrypto';
import { HardenExpertMetaCredentialTokens1791334590498 } from '../1791334590498-HardenExpertMetaCredentialTokens';

type Row = {
  id: string;
  tenantId: string;
  expertId: string;
  accessTokenEncrypted: string;
  accessTokenIv: string;
  accessTokenAuthTag: string;
};

/** Cifra como o serviço fazia antes desta migration (sem AAD). */
function legacyEncrypt(key: Buffer, value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);

  return {
    accessTokenEncrypted: encrypted.toString('base64'),
    accessTokenIv: iv.toString('base64'),
    accessTokenAuthTag: cipher.getAuthTag().toString('base64'),
  };
}

/** QueryRunner falso: guarda o SQL e simula só a tabela de credenciais ativas. */
function fakeQueryRunner(rows: Row[]) {
  const statements: string[] = [];
  const query = jest.fn((sql: string, params?: string[]) => {
    statements.push(sql.replace(/\s+/g, ' ').trim());

    if (sql.includes('SELECT'))
      return Promise.resolve(rows.map((r) => ({ ...r })));

    if (sql.includes('SET "accessTokenEncrypted" = $1') && params) {
      const row = rows.find((r) => r.id === params[3])!;
      row.accessTokenEncrypted = params[0];
      row.accessTokenIv = params[1];
      row.accessTokenAuthTag = params[2];
    }

    return Promise.resolve([]);
  });

  return { queryRunner: { query } as unknown as QueryRunner, statements };
}

describe('HardenExpertMetaCredentialTokens1791334590498', () => {
  const key = randomBytes(32);
  const migration = new HardenExpertMetaCredentialTokens1791334590498();
  /** Decifra como o código fazia entre esta migration e as tabelas novas. */
  const cipher = {
    decrypt: (
      token: EncryptedToken,
      who: { tenantId: string; expertId: string; credentialId: string },
    ) => decryptToken(key, token, metaTokenAad(who), who.credentialId),
  };
  const owner = {
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    credentialId: 'credential-a',
  };

  beforeEach(() => {
    Environment.vars = {
      META_TOKENS_ENCRYPTION_KEY: key.toString('base64'),
    } as typeof Environment.vars;
  });

  function legacyRow(): Row {
    return {
      id: owner.credentialId,
      tenantId: owner.tenantId,
      expertId: owner.expertId,
      ...legacyEncrypt(key, 'long-lived-token'),
    };
  }

  it('re-encrypts active tokens bound to their own record', async () => {
    const rows = [legacyRow()];
    const { queryRunner } = fakeQueryRunner(rows);

    await migration.up(queryRunner);

    const token = {
      encryptedValue: rows[0].accessTokenEncrypted,
      iv: rows[0].accessTokenIv,
      authTag: rows[0].accessTokenAuthTag,
    };
    expect(cipher.decrypt(token, owner)).toBe('long-lived-token');
    expect(() =>
      cipher.decrypt(token, { ...owner, tenantId: 'tenant-b' }),
    ).toThrow();
  });

  it('wipes inactive tokens and adds the lifecycle constraint', async () => {
    const { queryRunner, statements } = fakeQueryRunner([]);

    await migration.up(queryRunner);

    expect(statements).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /UPDATE "expert_meta_credentials" SET "accessTokenEncrypted" = NULL.*WHERE "isActive" = false/,
        ),
        expect.stringContaining(
          'ADD CONSTRAINT "CHK_expert_meta_credentials_token_lifecycle"',
        ),
      ]),
    );
  });

  it('fails without the key used to encrypt the current tokens', async () => {
    Environment.vars.META_TOKENS_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');
    const { queryRunner } = fakeQueryRunner([legacyRow()]);

    await expect(migration.up(queryRunner)).rejects.toThrow(
      'Não foi possível decifrar o token da credencial credential-a',
    );
  });

  it('restores the previous format on down', async () => {
    const rows = [legacyRow()];
    const { queryRunner } = fakeQueryRunner(rows);
    await migration.up(queryRunner);

    await migration.down(queryRunner);

    const { queryRunner: again } = fakeQueryRunner(rows);
    await expect(migration.up(again)).resolves.toBeUndefined();
    expect(
      cipher.decrypt(
        {
          encryptedValue: rows[0].accessTokenEncrypted,
          iv: rows[0].accessTokenIv,
          authTag: rows[0].accessTokenAuthTag,
        },
        owner,
      ),
    ).toBe('long-lived-token');
  });
});
