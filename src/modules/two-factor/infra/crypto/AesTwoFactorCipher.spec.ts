import { randomBytes } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { AesTwoFactorCipher } from './AesTwoFactorCipher';
import { TwoFactorKeys } from './TwoFactorKeys';

describe('AesTwoFactorCipher', () => {
  const originalVars = Environment.vars;

  beforeEach(() => {
    Environment.vars = {
      TWO_FACTOR_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    } as typeof Environment.vars;
  });

  afterAll(() => {
    Environment.vars = originalVars;
  });

  it('encrypts and decrypts the secret for its user', () => {
    const cipher = new AesTwoFactorCipher(new TwoFactorKeys());
    const encrypted = cipher.encrypt('BASE32SECRET', 'user-1');

    expect(cipher.decrypt(encrypted, 'user-1')).toBe('BASE32SECRET');
    expect(encrypted.encryptedValue).not.toContain('BASE32SECRET');
    expect(Buffer.from(encrypted.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(encrypted.authTag, 'base64')).toHaveLength(16);
  });

  it('rejects the AAD of another user', () => {
    const cipher = new AesTwoFactorCipher(new TwoFactorKeys());
    const encrypted = cipher.encrypt('BASE32SECRET', 'user-1');

    expect(capture(() => cipher.decrypt(encrypted, 'user-2'))).toMatchObject({
      reason: 'TWO_FACTOR_DECRYPTION_FAILED',
    });
  });

  it('fails with 503 when the key is absent', () => {
    Environment.vars.TWO_FACTOR_ENCRYPTION_KEY = undefined;

    expect(
      capture(() =>
        new AesTwoFactorCipher(new TwoFactorKeys()).encrypt('secret', 'user-1'),
      ),
    ).toMatchObject({
      statusCode: 503,
      reason: 'TWO_FACTOR_NOT_CONFIGURED',
    });
  });

  function capture(run: () => unknown): unknown {
    try {
      run();
    } catch (error) {
      return error;
    }
    throw new Error('Era esperado que a operação falhasse');
  }
});
