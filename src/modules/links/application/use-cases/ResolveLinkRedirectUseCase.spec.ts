import { ResolveLinkRedirectUseCase } from './ResolveLinkRedirectUseCase';

const cached = {
  v: 1 as const,
  id: 'id',
  tenantId: 'tenant',
  expertId: null,
  launchId: null,
  destinationUrl: 'https://example.com',
  destinationVersion: 1,
  status: 'active' as const,
  utm: {
    source: null,
    medium: null,
    campaign: null,
    content: null,
    term: null,
  },
};
const input = {
  code: 'abcdefgh',
  query: {},
  ip: '127.0.0.1',
  userAgent: 'Mozilla',
  referrer: '',
  now: new Date('2026-11-11T00:00:00Z'),
};

describe('ResolveLinkRedirectUseCase', () => {
  function setup(value: unknown = cached) {
    const cache = { get: jest.fn().mockResolvedValue(value), set: jest.fn() };
    const links = { findByCode: jest.fn() };
    const ids = { generate: jest.fn().mockReturnValue('clickid') };
    const builder = {
      build: jest.fn().mockReturnValue('https://example.com/?pl=clickid'),
    };
    const bots = { isBot: jest.fn().mockReturnValue(false) };
    const recorder = { record: jest.fn() };
    return {
      useCase: new ResolveLinkRedirectUseCase(
        links as never,
        cache as never,
        ids,
        builder,
        bots,
        recorder,
      ),
      cache,
      links,
      builder,
      recorder,
    };
  }
  it('does not touch repository on cache hit and records without awaiting', async () => {
    const context = setup();
    await expect(context.useCase.execute(input)).resolves.toEqual({
      kind: 'redirect',
      url: 'https://example.com/?pl=clickid',
    });
    expect(context.links.findByCode).not.toHaveBeenCalled();
    expect(context.recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ clickId: 'clickid' }),
    );
    expect(context.builder.build).toHaveBeenCalledWith(
      expect.objectContaining({ clickId: 'clickid' }),
    );
  });
  it('caches a missing link and returns not found', async () => {
    const context = setup(null);
    context.links.findByCode.mockResolvedValue(null);
    await expect(context.useCase.execute(input)).resolves.toEqual({
      kind: 'not_found',
    });
    expect(context.links.findByCode).toHaveBeenCalledTimes(1);
    expect(context.cache.set).toHaveBeenCalledWith(
      'abcdefgh',
      expect.objectContaining({ missing: true }),
    );
  });
});
