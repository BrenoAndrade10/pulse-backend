import { Environment } from '../../../../config/Environment';
import { EmailLoginCodes } from './EmailLoginCodes';

describe('EmailLoginCodes', () => {
  const service = new EmailLoginCodes();

  beforeEach(() => {
    Environment.vars = {
      JWT_SECRET: 'test-secret-with-at-least-32-characters',
    } as typeof Environment.vars;
  });

  it('generates six numeric digits', () => {
    expect(service.generate()).toMatch(/^\d{6}$/);
  });

  it('binds the HMAC to the user', () => {
    const hash = service.hash('user-id', '123456');

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(service.matches('user-id', '123456', hash)).toBe(true);
    expect(service.matches('another-user', '123456', hash)).toBe(false);
  });

  it('masks the email address', () => {
    expect(service.maskEmail('breno@gmail.com')).toBe('b****@g****.com');
  });
});
