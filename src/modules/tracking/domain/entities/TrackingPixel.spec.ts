import { TrackingPixel } from './TrackingPixel';

describe('TrackingPixel', () => {
  const pixel = new TrackingPixel({
    id: 'pixel-a',
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    publicKey: 'PX_abcdefghijklmnopqrst',
    allowedDomains: ['meusite.com.br'],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it.each([
    ['the domain', 'meusite.com.br', true],
    ['a subdomain', 'lp.meusite.com.br', true],
    ['another domain', 'outrosite.com.br', false],
    ['a lookalike suffix', 'fakemeusite.com.br', false],
    ['a lookalike prefix', 'meusite.com.br.evil.com', false],
  ])('checks %s', (_, hostname, allowed) => {
    expect(pixel.allowsDomain(hostname)).toBe(allowed);
  });
});
