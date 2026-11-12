import { buildLinkBlockedHosts } from './LinkDestinationPolicy';

describe('buildLinkBlockedHosts', () => {
  it('inclui os hosts de links e api quando ambos estão definidos', () => {
    expect(
      buildLinkBlockedHosts(
        'https://links.usepulselead.com',
        'https://api.usepulselead.com',
      ),
    ).toEqual(['links.usepulselead.com', 'api.usepulselead.com']);
  });

  it('remove hosts duplicados', () => {
    expect(
      buildLinkBlockedHosts(
        'https://api.usepulselead.com',
        'https://api.usepulselead.com/v1',
      ),
    ).toEqual(['api.usepulselead.com']);
  });

  it('ignora URLs ausentes', () => {
    expect(buildLinkBlockedHosts(undefined, undefined)).toEqual([]);
  });
});
