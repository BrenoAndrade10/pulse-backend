import { PublicAssetsController } from './PublicAssetsController';
import { StreamableFile } from '@nestjs/common';

describe('PublicAssetsController', () => {
  it('serves the real PNG bytes as a cacheable PNG', async () => {
    const response = {
      statusCode: 0,
      setHeader: jest.fn(),
    };

    const file = new PublicAssetsController().getPulseLogo(response as never);
    const chunks: Uint8Array[] = [];

    for await (const chunk of file.getStream()) {
      chunks.push(chunk as Uint8Array);
    }

    const body = Buffer.concat(chunks);

    expect(file).toBeInstanceOf(StreamableFile);
    expect(response.statusCode).toBe(200);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'image/png',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=86400',
    );
    expect(body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(body.toString('utf8')).not.toContain('{"type":"Buffer"');
  });
});
