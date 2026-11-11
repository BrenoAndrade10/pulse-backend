import { DomainError } from '../../../../shared/errors/DomainError';
import {
  DestinationUrlNormalizer,
  type LinkDestinationPolicy,
} from './DestinationUrlNormalizer';

function normalizer(
  policy: Partial<LinkDestinationPolicy> = {},
): DestinationUrlNormalizer {
  return new DestinationUrlNormalizer({
    allowLocal: false,
    blockedHosts: [],
    ...policy,
  });
}

describe('DestinationUrlNormalizer', () => {
  it('completes a URL without a scheme', () => {
    expect(normalizer().normalize('example.com/path')).toBe(
      'https://example.com/path',
    );
    expect(normalizer().normalize('example.com:8080/path')).toBe(
      'https://example.com:8080/path',
    );
  });

  it('rejects http in production and allows local http in development', () => {
    expect(() => normalizer().normalize('http://example.com')).toThrow(
      new DomainError(400, 'LINK_DESTINATION_INSECURE'),
    );
    expect(
      normalizer({ allowLocal: true }).normalize('http://localhost:3000/path'),
    ).toBe('http://localhost:3000/path');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/plain,hello',
    'ftp://example.com',
  ])('rejects %s', (value) => {
    expect(() => normalizer().normalize(value)).toThrow(
      new DomainError(400, 'LINK_DESTINATION_INVALID'),
    );
  });

  it('rejects empty, malformed and credential-bearing URLs', () => {
    expect(() => normalizer().normalize('   ')).toThrow(
      new DomainError(400, 'LINK_DESTINATION_INVALID'),
    );
    expect(() => normalizer().normalize('https://')).toThrow(
      new DomainError(400, 'LINK_DESTINATION_INVALID'),
    );
    expect(() =>
      normalizer().normalize('https://user:pass@example.com'),
    ).toThrow(new DomainError(400, 'LINK_DESTINATION_INVALID'));
  });

  it.each([
    'https://127.0.0.2',
    'https://10.0.0.1',
    'https://172.16.0.1',
    'https://192.168.1.1',
    'https://169.254.169.254',
    'https://[::1]',
    'https://[fc00::1]',
    'https://[fe80::1]',
    'https://service.local',
    'https://service.internal',
    'https://intranet',
  ])('blocks local or private host %s', (value) => {
    expect(() => normalizer().normalize(value)).toThrow(
      new DomainError(400, 'LINK_DESTINATION_BLOCKED'),
    );
  });

  it('blocks the configured API host and its subdomains', () => {
    const instance = normalizer({ blockedHosts: ['Short.Example.com'] });

    expect(() => instance.normalize('https://short.example.com')).toThrow(
      new DomainError(400, 'LINK_DESTINATION_BLOCKED'),
    );
    expect(() => instance.normalize('https://go.short.example.com')).toThrow(
      new DomainError(400, 'LINK_DESTINATION_BLOCKED'),
    );
  });

  it('normalizes host casing and removes the default port', () => {
    expect(normalizer().normalize('HTTPS://EXAMPLE.COM:443/path')).toBe(
      'https://example.com/path',
    );
  });

  it('preserves a valid URL query and hash', () => {
    expect(
      normalizer().normalize('https://example.com/path?utm_source=x#section'),
    ).toBe('https://example.com/path?utm_source=x#section');
  });

  it('rejects URLs longer than 2048 characters', () => {
    expect(() =>
      normalizer().normalize(`https://example.com/${'a'.repeat(2050)}`),
    ).toThrow(new DomainError(400, 'LINK_DESTINATION_TOO_LONG'));
  });
});
