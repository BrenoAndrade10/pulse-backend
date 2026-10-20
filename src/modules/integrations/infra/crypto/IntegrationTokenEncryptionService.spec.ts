import { randomBytes } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { parseAes256Key } from '../../../../shared/infra/crypto/parseAes256Key';
import { IntegrationProvider } from '../../domain/enums/IntegrationProvider';
import type { IntegrationTokenContext } from '../../domain/services/IntegrationTokenCipher';
import { IntegrationTokenEncryptionService } from './IntegrationTokenEncryptionService';

/** Motivo do DomainError lançado por `fn`, ou null se não lançar. */
function reasonOf(fn: () => unknown): string | null {
  try {
    fn();
  } catch (error) {
    return error instanceof DomainError ? error.reason : 'NOT_A_DOMAIN_ERROR';
  }
  return null;
}

const owner: IntegrationTokenContext = {
  tenantId: 'tenant-a',
  expertId: 'expert-a',
  credentialId: 'credential-a',
  provider: IntegrationProvider.INSTAGRAM,
  purpose: 'access_token',
};

describe('IntegrationTokenEncryptionService', () => {
  let service: IntegrationTokenEncryptionService;

  beforeEach(() => {
    service = new IntegrationTokenEncryptionService();
    Environment.vars = {
      PORT: 3000,
      META_GRAPH_API_VERSION: 'v21.0',
    } as typeof Environment.vars;
  });

  it('encrypts and decrypts token values', () => {
    Environment.vars.META_TOKENS_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');

    const encryptedToken = service.encrypt('meta-access-token', owner);

    expect(encryptedToken.encryptedValue).not.toBe('meta-access-token');
    expect(service.decrypt(encryptedToken, owner)).toBe('meta-access-token');
  });

  it('uses a different initialization vector on each encryption', () => {
    Environment.vars.META_TOKENS_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');

    const firstEncryptedToken = service.encrypt('meta-access-token', owner);
    const secondEncryptedToken = service.encrypt('meta-access-token', owner);

    expect(firstEncryptedToken.iv).not.toBe(secondEncryptedToken.iv);
    expect(firstEncryptedToken.encryptedValue).not.toBe(
      secondEncryptedToken.encryptedValue,
    );
  });

  it('requires an encryption key', () => {
    expect(() => service.encrypt('meta-access-token', owner)).toThrow(
      DomainError,
    );
  });

  describe('with a key', () => {
    beforeEach(() => {
      Environment.vars.META_TOKENS_ENCRYPTION_KEY =
        randomBytes(32).toString('base64');
    });

    it.each([
      ['tenant', { tenantId: 'tenant-b' }],
      ['expert', { expertId: 'expert-b' }],
      ['credential', { credentialId: 'credential-b' }],
      ['provider', { provider: IntegrationProvider.WHATSAPP }],
      ['purpose', { purpose: 'refresh_token' }],
    ] as const)(
      'refuses a token moved to another %s',
      (_, change: Partial<IntegrationTokenContext>) => {
        const token = service.encrypt('secret-token', owner);

        expect(
          reasonOf(() => service.decrypt(token, { ...owner, ...change })),
        ).toBe('INTEGRATION_TOKEN_DECRYPTION_FAILED');
      },
    );

    it('refuses a tampered token', () => {
      const token = service.encrypt('secret-token', owner);
      const bytes = Buffer.from(token.encryptedValue, 'base64');
      bytes[0] ^= 0xff;

      expect(
        reasonOf(() =>
          service.decrypt(
            { ...token, encryptedValue: bytes.toString('base64') },
            owner,
          ),
        ),
      ).toBe('INTEGRATION_TOKEN_DECRYPTION_FAILED');
    });

    it('refuses a key that is not 32 bytes in base64 or hex', () => {
      Environment.vars.META_TOKENS_ENCRYPTION_KEY = 'minha-senha-forte';

      expect(reasonOf(() => service.assertConfigured())).toBe(
        'META_TOKENS_ENCRYPTION_KEY_INVALID',
      );
    });
  });
});

describe('parseAes256Key', () => {
  it('accepts 32 bytes in base64 or hex', () => {
    const key = randomBytes(32);

    expect(parseAes256Key(key.toString('base64'))).toEqual(key);
    expect(parseAes256Key(key.toString('hex'))).toEqual(key);
  });

  it.each([
    'minha-senha-forte',
    randomBytes(16).toString('base64'),
    randomBytes(31).toString('hex'),
    `${randomBytes(32).toString('base64').slice(0, -2)}!=`,
    '',
  ])('rejects %p', (value) => {
    expect(parseAes256Key(value)).toBeNull();
  });
});
