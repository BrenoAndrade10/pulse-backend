import { randomBytes } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { MetaTokenEncryptionService } from './MetaTokenEncryptionService';

describe('MetaTokenEncryptionService', () => {
  let service: MetaTokenEncryptionService;

  beforeEach(() => {
    service = new MetaTokenEncryptionService();
    Environment.vars = {
      PORT: 3000,
      META_GRAPH_API_VERSION: 'v21.0',
    } as typeof Environment.vars;
  });

  it('encrypts and decrypts token values', () => {
    Environment.vars.META_TOKENS_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');

    const encryptedToken = service.encrypt('meta-access-token');

    expect(encryptedToken.encryptedValue).not.toBe('meta-access-token');
    expect(service.decrypt(encryptedToken)).toBe('meta-access-token');
  });

  it('uses a different initialization vector on each encryption', () => {
    Environment.vars.META_TOKENS_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');

    const firstEncryptedToken = service.encrypt('meta-access-token');
    const secondEncryptedToken = service.encrypt('meta-access-token');

    expect(firstEncryptedToken.iv).not.toBe(secondEncryptedToken.iv);
    expect(firstEncryptedToken.encryptedValue).not.toBe(
      secondEncryptedToken.encryptedValue,
    );
  });

  it('requires an encryption key', () => {
    expect(() => service.encrypt('meta-access-token')).toThrow(DomainError);
  });
});
