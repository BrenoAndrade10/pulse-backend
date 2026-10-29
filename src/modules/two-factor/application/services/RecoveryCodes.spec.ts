import { randomBytes } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { TwoFactorKeys } from '../../infra/crypto/TwoFactorKeys';
import { RecoveryCodes } from './RecoveryCodes';

describe('RecoveryCodes', () => {
  const originalVars = Environment.vars;
  let service: RecoveryCodes;

  beforeEach(() => {
    Environment.vars = {
      TWO_FACTOR_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    } as typeof Environment.vars;
    service = new RecoveryCodes(new TwoFactorKeys());
  });

  afterAll(() => {
    Environment.vars = originalVars;
  });

  it('generates ten unique unambiguous codes', () => {
    const codes = service.generate();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^[2-9A-HJ-KM-NP-Z]{5}-[2-9A-HJ-KM-NP-Z]{5}$/),
      ]),
    );
    expect(codes.join('')).not.toMatch(/[01OIL]/);
  });

  it('normalizes spacing, casing and hyphens', () => {
    expect(service.normalize(' abcd2 - efgh3 ')).toBe('ABCD2EFGH3');
  });

  it('produces a stable HMAC for equivalent inputs', () => {
    const hash = service.hash('user-id', 'ABCDE-FGHJ2');

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(service.hash('user-id', 'abcde fghj2')).toBe(hash);
    expect(service.hash('user-id', 'ABCDE-FGHJ3')).not.toBe(hash);
    expect(service.hash('another-user', 'ABCDE-FGHJ2')).not.toBe(hash);
  });
});
