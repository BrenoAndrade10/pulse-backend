import { LinkClickRecorder } from './LinkClickRecorder';
import { Environment } from '../../../../config/Environment';

describe('LinkClickRecorder', () => {
  it('flushes buffered rows on shutdown', async () => {
    const sink = { write: jest.fn().mockResolvedValue(undefined) };
    Environment.vars = { JWT_SECRET: 'secret' } as never;
    const recorder = new LinkClickRecorder(sink);
    recorder.record({
      clickId: 'click-id',
      linkId: 'link',
      tenantId: 'tenant',
      expertId: null,
      launchId: null,
      code: 'abcdefgh',
      destinationVersion: 1,
      destinationUtm: {
        source: null,
        medium: null,
        campaign: null,
        content: null,
        term: null,
      },
      ip: '127.0.0.1',
      userAgent: 'Mozilla',
      referrer: '',
      isBot: false,
      now: new Date(),
    });
    await recorder.onApplicationShutdown();
    expect(sink.write).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ click_id: 'click-id' }),
      ]),
    );
  });
});
