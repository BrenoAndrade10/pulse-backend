import { Environment } from '../../../../config/Environment';
import { LinkShortUrlBuilder } from './LinkShortUrlBuilder';

describe('LinkShortUrlBuilder', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVars = Environment.vars;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    Environment.vars = originalVars;
  });

  it('builds an https short URL in production', () => {
    process.env.NODE_ENV = 'production';
    Environment.vars = {
      API_PUBLIC_URL: 'https://api.example.com/',
    } as typeof Environment.vars;

    expect(new LinkShortUrlBuilder().build('abcd')).toBe(
      'https://api.example.com/l/abcd',
    );
  });

  it('rejects an insecure configured URL in production', () => {
    process.env.NODE_ENV = 'production';
    Environment.vars = {
      API_PUBLIC_URL: 'http://api.example.com',
    } as typeof Environment.vars;

    expect(() => new LinkShortUrlBuilder()).toThrow(
      'API_PUBLIC_URL deve usar HTTPS em produção para links curtos.',
    );
  });

  it('uses localhost and the configured port in development', () => {
    process.env.NODE_ENV = 'development';
    Environment.vars = { PORT: 4010 } as typeof Environment.vars;

    expect(new LinkShortUrlBuilder().build('abcd')).toBe(
      'http://localhost:4010/l/abcd',
    );
  });
});
