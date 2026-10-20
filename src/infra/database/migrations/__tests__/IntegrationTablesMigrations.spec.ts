import { randomBytes } from 'node:crypto';
import type { QueryRunner } from 'typeorm';
import { Environment } from '../../../../config/Environment';
import { IntegrationProvider } from '../../../../modules/integrations/domain/enums/IntegrationProvider';
import { IntegrationTokenEncryptionService } from '../../../../modules/integrations/infra/crypto/IntegrationTokenEncryptionService';
import {
  decryptToken,
  encryptToken,
  metaTokenAad,
} from '../../migration-support/tokenCrypto';
import { CreateIntegrationCredentials1791334590499 } from '../1791334590499-CreateIntegrationCredentials';
import { CreateIntegrationAccounts1791334590500 } from '../1791334590500-CreateIntegrationAccounts';
import { DropExpertMetaCredentials1791334590501 } from '../1791334590501-DropExpertMetaCredentials';

type Row = Record<string, unknown>;

const LEGACY_COLUMNS = [
  'id',
  'tenantId',
  'expertId',
  'metaUserId',
  'instagramUserId',
  'instagramUsername',
  'pageId',
  'pageName',
  'accessTokenEncrypted',
  'accessTokenIv',
  'accessTokenAuthTag',
  'tokenExpiresAt',
  'scopes',
  'isActive',
  'revokedAt',
  'createdAt',
  'updatedAt',
];
const CREDENTIAL_COLUMNS = [
  'id',
  'tenantId',
  'expertId',
  'externalUserId',
  'accessTokenEncrypted',
  'accessTokenIv',
  'accessTokenAuthTag',
  'tokenExpiresAt',
  'scopes',
  'status',
  'revokedAt',
  'createdAt',
  'updatedAt',
];
const ACCOUNT_COLUMNS = [
  'id',
  'tenantId',
  'expertId',
  'credentialId',
  'externalId',
  'displayName',
  'metadata',
  'connectedAt',
  'disconnectedAt',
  'createdAt',
  'updatedAt',
];

const indexBy = (rows: Row[], column: string): Record<string, Row> =>
  Object.fromEntries(rows.map((row) => [row[column] as string, row]));

const zip = (columns: string[], values: unknown[]): Row =>
  Object.fromEntries(columns.map((column, i) => [column, values[i]]));

/**
 * Banco em memória que entende só o SQL destas migrations: as três tabelas,
 * os SELECTs de cópia e os INSERTs.
 */
function fakeDatabase(legacy: Row[]) {
  const db = { legacy, credentials: [] as Row[], accounts: [] as Row[] };
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    const text = sql.replace(/\s+/g, ' ').trim();

    if (text.startsWith('DROP TABLE "expert_meta_credentials"')) db.legacy = [];
    if (text.startsWith('CREATE TABLE "expert_meta_credentials"'))
      db.legacy = [];
    if (text.startsWith('DROP TABLE "integration_accounts"')) db.accounts = [];
    if (text.startsWith('DROP TABLE "integration_credentials"'))
      db.credentials = [];

    if (text.startsWith('INSERT INTO "integration_credentials"')) {
      db.credentials.push({
        ...zip(CREDENTIAL_COLUMNS, [
          params[0],
          params[1],
          params[2],
          params[3],
          params[4],
          params[5],
          params[6],
          params[7],
          JSON.parse(params[8] as string),
          params[9],
          params[10],
          params[11],
          params[12],
        ]),
        provider: 'instagram',
      });
    }

    if (text.startsWith('INSERT INTO "integration_accounts"')) {
      db.accounts.push({
        ...zip(ACCOUNT_COLUMNS, [
          ...params.slice(0, 6),
          JSON.parse(params[6] as string),
          ...params.slice(7),
        ]),
        provider: 'instagram',
        type: 'instagram_account',
      });
    }

    if (text.startsWith('INSERT INTO "expert_meta_credentials"')) {
      const values = [...params];
      values[12] = JSON.parse(values[12] as string);
      db.legacy.push(zip(LEGACY_COLUMNS, values));
    }

    // 499: credenciais antigas, mais recentes primeiro.
    if (
      text.startsWith('SELECT') &&
      text.includes('FROM "expert_meta_credentials" ORDER BY')
    ) {
      return Promise.resolve(
        [...db.legacy].sort(
          (a, b) =>
            (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
        ),
      );
    }

    // 500: contas do Instagram das credenciais copiadas.
    if (
      text.startsWith('SELECT') &&
      text.includes('JOIN "integration_credentials"')
    ) {
      return Promise.resolve(
        db.legacy
          .filter((row) => row.instagramUserId)
          .flatMap((row) => {
            const credential = db.credentials.find((c) => c.id === row.id);
            return credential
              ? [
                  {
                    ...row,
                    credentialId: row.id,
                    status: credential.status,
                    revokedAt: credential.revokedAt,
                  },
                ]
              : [];
          }),
      );
    }

    // 501 down: credenciais do Instagram com a conta mais recente.
    if (text.startsWith('SELECT') && text.includes('LEFT JOIN LATERAL')) {
      return Promise.resolve(
        db.credentials
          .filter((c) => c.provider === 'instagram')
          .map((c) => {
            const account = db.accounts
              .filter((a) => a.credentialId === c.id)
              .sort(
                (a, b) =>
                  (b.connectedAt as Date).getTime() -
                  (a.connectedAt as Date).getTime(),
              )[0];
            const metadata = (account?.metadata ?? {}) as Row;
            return {
              ...c,
              instagramUserId: account?.externalId ?? null,
              instagramUsername: account?.displayName ?? null,
              pageId: metadata.pageId ?? null,
              pageName: metadata.pageName ?? null,
            };
          }),
      );
    }

    return Promise.resolve([]);
  });

  return { db, queryRunner: { query } as unknown as QueryRunner };
}

describe('integration tables migrations', () => {
  const key = randomBytes(32);
  const credentialsMigration = new CreateIntegrationCredentials1791334590499();
  const accountsMigration = new CreateIntegrationAccounts1791334590500();
  const dropMigration = new DropExpertMetaCredentials1791334590501();
  const cipher = new IntegrationTokenEncryptionService();
  const tenantId = 'tenant-a';
  const expertId = 'expert-a';

  beforeEach(() => {
    Environment.vars = {
      META_TOKENS_ENCRYPTION_KEY: key.toString('base64'),
    } as typeof Environment.vars;
  });

  /** Linha de `expert_meta_credentials` no formato da migration 498. */
  function legacyRow(overrides: Row & { id: string }): Row {
    const isActive = overrides.isActive ?? true;
    const token = isActive
      ? encryptToken(
          key,
          `token-${overrides.id}`,
          metaTokenAad({ tenantId, expertId, credentialId: overrides.id }),
        )
      : null;

    return {
      tenantId,
      expertId,
      metaUserId: '111',
      instagramUserId: '178414',
      instagramUsername: 'carlaexpert',
      pageId: null,
      pageName: null,
      accessTokenEncrypted: token?.encryptedValue ?? null,
      accessTokenIv: token?.iv ?? null,
      accessTokenAuthTag: token?.authTag ?? null,
      tokenExpiresAt: new Date('2026-12-01T00:00:00.000Z'),
      scopes: ['instagram_business_basic'],
      isActive,
      revokedAt: isActive ? null : new Date('2026-10-02T00:00:00.000Z'),
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  const decryptCredential = (credential: Row) =>
    cipher.decrypt(
      {
        encryptedValue: credential.accessTokenEncrypted as string,
        iv: credential.accessTokenIv as string,
        authTag: credential.accessTokenAuthTag as string,
      },
      {
        tenantId,
        expertId,
        credentialId: credential.id as string,
        provider: IntegrationProvider.INSTAGRAM,
        purpose: 'access_token',
      },
    );

  describe('CreateIntegrationCredentials', () => {
    it('copies the active credential re-encrypted with the new AAD', async () => {
      const { db, queryRunner } = fakeDatabase([legacyRow({ id: 'cred-1' })]);

      await credentialsMigration.up(queryRunner);

      expect(db.credentials).toHaveLength(1);
      expect(db.credentials[0]).toMatchObject({
        id: 'cred-1',
        provider: 'instagram',
        externalUserId: '111',
        status: 'active',
        revokedAt: null,
        scopes: ['instagram_business_basic'],
      });
      expect(decryptCredential(db.credentials[0])).toBe('token-cred-1');
    });

    it('copies revoked credentials without any token', async () => {
      const { db, queryRunner } = fakeDatabase([
        legacyRow({ id: 'cred-old', isActive: false }),
      ]);

      await credentialsMigration.up(queryRunner);

      expect(db.credentials[0]).toMatchObject({
        status: 'revoked',
        accessTokenEncrypted: null,
        accessTokenIv: null,
        accessTokenAuthTag: null,
        revokedAt: new Date('2026-10-02T00:00:00.000Z'),
      });
    });

    it('keeps only the newest active credential per expert', async () => {
      const { db, queryRunner } = fakeDatabase([
        legacyRow({ id: 'older', createdAt: new Date('2026-09-01') }),
        legacyRow({ id: 'newer', createdAt: new Date('2026-10-01') }),
      ]);

      await credentialsMigration.up(queryRunner);

      const byId = indexBy(db.credentials, 'id');
      expect(byId.newer.status).toBe('active');
      expect(byId.older).toMatchObject({
        status: 'revoked',
        accessTokenEncrypted: null,
      });
      expect(byId.older.revokedAt).toBeInstanceOf(Date);
    });

    it('fails without the key that encrypted the current tokens', async () => {
      const { queryRunner } = fakeDatabase([legacyRow({ id: 'cred-1' })]);
      Environment.vars.META_TOKENS_ENCRYPTION_KEY =
        randomBytes(32).toString('base64');

      await expect(credentialsMigration.up(queryRunner)).rejects.toThrow(
        'Não foi possível decifrar o token da credencial cred-1',
      );
    });

    it('creates the table with the lifecycle checks and the active index', async () => {
      const { queryRunner } = fakeDatabase([]);

      await credentialsMigration.up(queryRunner);

      const sql = (queryRunner.query as jest.Mock).mock.calls
        .map(([statement]) => statement as string)
        .join('\n');
      expect(sql).toContain('CHK_integration_credentials_token_lifecycle');
      expect(sql).toContain('UQ_integration_credentials_owner');
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX "UQ_integration_credentials_active"[\s\S]*WHERE "status" = 'active'/,
      );
    });
  });

  describe('CreateIntegrationAccounts', () => {
    it('copies the Instagram account of each credential', async () => {
      const { db, queryRunner } = fakeDatabase([
        legacyRow({ id: 'cred-1', pageId: 'page-1', pageName: 'Página' }),
        legacyRow({ id: 'cred-old', isActive: false }),
      ]);
      await credentialsMigration.up(queryRunner);

      await accountsMigration.up(queryRunner);

      const byCredential = indexBy(db.accounts, 'credentialId');
      expect(byCredential['cred-1']).toMatchObject({
        tenantId,
        expertId,
        provider: 'instagram',
        type: 'instagram_account',
        externalId: '178414',
        displayName: 'carlaexpert',
        metadata: { pageId: 'page-1', pageName: 'Página' },
        disconnectedAt: null,
      });
      expect(byCredential['cred-old'].disconnectedAt).toEqual(
        new Date('2026-10-02T00:00:00.000Z'),
      );
      expect(byCredential['cred-1'].id).not.toBe('cred-1');
    });

    it('skips credentials without an Instagram account', async () => {
      const { db, queryRunner } = fakeDatabase([
        legacyRow({ id: 'cred-1', instagramUserId: null }),
      ]);
      await credentialsMigration.up(queryRunner);

      await accountsMigration.up(queryRunner);

      expect(db.accounts).toEqual([]);
    });
  });

  describe('DropExpertMetaCredentials', () => {
    it('restores the legacy table on down, in the legacy token format', async () => {
      const original = [
        legacyRow({ id: 'cred-1' }),
        legacyRow({ id: 'cred-old', isActive: false }),
      ];
      const { db, queryRunner } = fakeDatabase(original.map((r) => ({ ...r })));
      await credentialsMigration.up(queryRunner);
      await accountsMigration.up(queryRunner);
      await dropMigration.up(queryRunner);
      expect(db.legacy).toEqual([]);

      await dropMigration.down(queryRunner);

      const byId = indexBy(db.legacy, 'id');
      expect(byId['cred-1']).toMatchObject({
        tenantId,
        expertId,
        metaUserId: '111',
        instagramUserId: '178414',
        instagramUsername: 'carlaexpert',
        isActive: true,
      });
      expect(
        decryptToken(
          key,
          {
            encryptedValue: byId['cred-1'].accessTokenEncrypted as string,
            iv: byId['cred-1'].accessTokenIv as string,
            authTag: byId['cred-1'].accessTokenAuthTag as string,
          },
          metaTokenAad({ tenantId, expertId, credentialId: 'cred-1' }),
          'cred-1',
        ),
      ).toBe('token-cred-1');
      expect(byId['cred-old']).toMatchObject({
        isActive: false,
        accessTokenEncrypted: null,
      });
    });
  });
});
