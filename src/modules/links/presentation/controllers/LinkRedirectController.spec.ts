import { LinkRedirectController } from './LinkRedirectController';

describe('LinkRedirectController', () => {
  function response() {
    const value = {
      status: jest.fn(),
      set: jest.fn(),
      end: jest.fn(),
      type: jest.fn(),
      send: jest.fn(),
    };
    value.status.mockReturnValue(value);
    value.set.mockReturnValue(value);
    value.type.mockReturnValue(value);
    return value;
  }
  it('returns 302 with redirect headers', async () => {
    const resolve = jest.fn().mockResolvedValue({
      kind: 'redirect',
      url: 'https://example.com/?pl=id',
    });
    const controller = new LinkRedirectController({
      execute: resolve,
    } as never);
    const res = response();
    await controller.redirect(
      'abcdefgh',
      {},
      { ip: '1.1.1.1', get: () => '' } as never,
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(302);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        Location: 'https://example.com/?pl=id',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      }),
    );
    expect(res.end).toHaveBeenCalled();
  });
  it('rejects malformed codes before the use case and sends safe HTML', async () => {
    const resolve = jest.fn();
    const controller = new LinkRedirectController({
      execute: resolve,
    } as never);
    const res = response();
    await controller.redirect('INVALID', {}, {} as never, res as never);
    expect(resolve).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith(
      expect.not.stringContaining('INVALID'),
    );
  });
  it('returns 410 for inactive links', async () => {
    const controller = new LinkRedirectController({
      execute: jest.fn().mockResolvedValue({ kind: 'inactive' }),
    } as never);
    const res = response();
    await controller.redirect(
      'abcdefgh',
      {},
      { get: () => '' } as never,
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(410);
  });
});
