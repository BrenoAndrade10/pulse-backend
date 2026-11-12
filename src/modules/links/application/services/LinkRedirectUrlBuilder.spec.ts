import { LinkRedirectUrlBuilder } from './LinkRedirectUrlBuilder';

describe('LinkRedirectUrlBuilder', () => {
  const builder = new LinkRedirectUrlBuilder();
  const utm = {
    source: 'link',
    medium: 'bio',
    campaign: 'camp',
    content: 'content',
    term: 'term',
  };

  it('applies destination, incoming and configured precedence and forces pl', () => {
    const result = builder.build({
      destinationUrl: 'https://example.com/path?utm_source=destination#section',
      linkUtm: utm,
      incomingQuery: {
        utm_source: 'incoming',
        utm_medium: 'incoming',
        gclid: 'g-1',
        pl: 'old',
      },
      clickId: 'click-1',
    });
    expect(result).toContain('utm_source=destination');
    expect(result).toContain('utm_medium=incoming');
    expect(result).toContain('gclid=g-1');
    expect(result).toContain('pl=click-1');
    expect(result).toContain('#section');
  });

  it('falls back to original destination plus pl when too long', () => {
    const result = builder.build({
      destinationUrl: `https://example.com/?x=${'a'.repeat(7990)}`,
      linkUtm: utm,
      incomingQuery: {},
      clickId: 'click-1',
    });
    expect(result).toContain('pl=click-1');
  });

  it('rejects non-http destinations', () => {
    expect(() =>
      builder.build({
        destinationUrl: 'javascript:alert(1)',
        linkUtm: utm,
        incomingQuery: {},
        clickId: 'click',
      }),
    ).toThrow();
  });
});
