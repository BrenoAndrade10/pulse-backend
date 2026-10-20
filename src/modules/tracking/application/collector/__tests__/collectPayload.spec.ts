import {
  browserOf,
  deviceOf,
  isBot,
  MAX_EVENTS_PER_BATCH,
  parseCollectPayload,
} from '../collectPayload';

const event = (overrides: Record<string, unknown> = {}) => ({
  id: '0193a7f0-1234-4abc-8def-0123456789ab',
  name: 'PageView',
  url: 'https://site.com/captura?utm_source=ig',
  aid: 'anon_1',
  sid: 'sess-1',
  utm: { source: 'ig', campaign: 'marco', extra: 'x' },
  ...overrides,
});

describe('parseCollectPayload', () => {
  it('reads the sendBeacon body (text/plain JSON)', () => {
    const [parsed] = parseCollectPayload(JSON.stringify({ events: [event()] }));

    expect(parsed).toMatchObject({
      id: '0193a7f0-1234-4abc-8def-0123456789ab',
      name: 'PageView',
      ruleId: null,
      anonymousId: 'anon_1',
      utm: { source: 'ig', campaign: 'marco' },
      lead: null,
    });
    expect(parsed.utm).not.toHaveProperty('extra');
  });

  it.each([
    ['broken JSON', '{events:'],
    ['no events', '{}'],
    [
      'a body too big',
      JSON.stringify({ events: [event({ referrer: 'x'.repeat(70_000) })] }),
    ],
  ])('ignores %s', (_, body) => {
    expect(parseCollectPayload(body)).toEqual([]);
  });

  it.each([
    ['an invalid id', { id: 'nope' }],
    ['a missing url', { url: undefined }],
    ['an invalid rule id', { ruleId: 'x' }],
  ])('drops events with %s', (_, overrides) => {
    expect(parseCollectPayload({ events: [event(overrides)] })).toEqual([]);
  });

  it('keeps at most 20 events per batch', () => {
    const events = Array.from({ length: 30 }, () => event());
    expect(parseCollectPayload({ events })).toHaveLength(MAX_EVENTS_PER_BATCH);
  });

  it('keeps only well-formed lead values', () => {
    const [parsed] = parseCollectPayload({
      events: [
        event({
          lead: {
            values: {
              email: 'a@b.com',
              consent: true,
              'Bad Slug': 'x',
              phone: 123,
            },
            consent: true,
          },
        }),
      ],
    });

    expect(parsed.lead).toEqual({
      values: { email: 'a@b.com', consent: true },
      consent: true,
    });
  });

  it('drops anonymous ids with unexpected characters', () => {
    const [parsed] = parseCollectPayload({
      events: [event({ aid: '<script>' })],
    });
    expect(parsed.anonymousId).toBe('');
  });
});

describe('user agent helpers', () => {
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  it('detects bots and empty agents', () => {
    expect(isBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot(iphone)).toBe(false);
  });

  it('classifies device and browser', () => {
    expect(deviceOf(iphone)).toBe('mobile');
    expect(browserOf(iphone)).toBe('safari');
    expect(
      deviceOf('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36'),
    ).toBe('desktop');
    expect(
      browserOf(
        'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0',
      ),
    ).toBe('edge');
  });
});
