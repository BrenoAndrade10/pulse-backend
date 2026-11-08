import { PublicAssetsController } from './PublicAssetsController';

describe('PublicAssetsController', () => {
  it('serves the Pulse logo as a cacheable PNG', () => {
    const response = {
      statusCode: 0,
      setHeader: jest.fn(),
    };

    const body = new PublicAssetsController().getPulseLogo(response as never);

    expect(response.statusCode).toBe(200);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'image/png',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=86400',
    );
    expect(body.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
