import { Environment } from '../../../../config/Environment';
import { TrustedDeviceTokens } from './TrustedDeviceTokens';

describe('TrustedDeviceTokens', () => {
  const originalVars = Environment.vars;
  let service: TrustedDeviceTokens;

  beforeEach(() => {
    Environment.vars = {
      JWT_SECRET: 'test-secret-with-at-least-32-characters',
    } as typeof Environment.vars;
    service = new TrustedDeviceTokens();
  });

  afterAll(() => {
    Environment.vars = originalVars;
  });

  it('generates random base64url tokens and stores only a stable HMAC', () => {
    const first = service.generate();
    const second = service.generate();

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.tokenHash).toBe(service.hash(first.token));
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });
});
