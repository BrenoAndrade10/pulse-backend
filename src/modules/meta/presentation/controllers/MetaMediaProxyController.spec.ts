import type { Response } from 'express';
import { PassThrough } from 'node:stream';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { InstagramMediaUrls } from '../../infra/media/InstagramMediaUrls';
import { MetaMediaProxyController } from './MetaMediaProxyController';

describe('MetaMediaProxyController', () => {
  const cdn = 'https://scontent.cdninstagram.com/v/photo.jpg';
  const urls = new InstagramMediaUrls();
  const controller = new MetaMediaProxyController(urls);
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  const signed = (url = cdn) =>
    Object.fromEntries(
      new URL(urls.sign(url)!, 'https://api.test').searchParams,
    );

  /** Response do Express que guarda status, cabeçalhos e corpo. */
  const fakeResponse = () => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    const headers: Record<string, string> = {};
    const response = Object.assign(stream, {
      statusCode: 200,
      status(code: number) {
        response.statusCode = code;
        return response;
      },
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
    });
    const done = new Promise<void>((resolve) => stream.on('finish', resolve));
    return {
      response: response as unknown as Response,
      headers,
      body: async () => {
        await done;
        return Buffer.concat(chunks).toString();
      },
      status: () => response.statusCode,
    };
  };

  const callProxy = (
    query: Record<string, string | undefined>,
    response: Response,
    range?: string,
  ) => controller.proxy(query.u, query.e, query.s, range, response);

  const failure = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      if (error instanceof DomainError) return error;
      throw error;
    }
    throw new Error('Esperava um DomainError.');
  };

  beforeEach(() => {
    Environment.vars = {
      JWT_SECRET: 'test-secret-with-at-least-32-characters!',
    } as typeof Environment.vars;
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => fetchMock.mockRestore());

  it('streams the image with headers that let the frontend show it', async () => {
    fetchMock.mockResolvedValue(
      new Response('IMAGE', {
        status: 200,
        headers: { 'content-type': 'image/jpeg', 'content-length': '5' },
      }),
    );
    const fake = fakeResponse();

    await callProxy(signed(), fake.response);

    expect(await fake.body()).toBe('IMAGE');
    expect(fake.status()).toBe(200);
    expect(fake.headers).toMatchObject({
      'content-type': 'image/jpeg',
      'cross-origin-resource-policy': 'cross-origin',
      'x-content-type-options': 'nosniff',
    });
    expect(fetchMock.mock.calls[0][0]).toBe(cdn);
  });

  it('forwards byte ranges so videos can seek', async () => {
    fetchMock.mockResolvedValue(
      new Response('PART', {
        status: 206,
        headers: {
          'content-type': 'video/mp4',
          'content-range': 'bytes 0-3/100',
        },
      }),
    );
    const fake = fakeResponse();

    await callProxy(signed(), fake.response, 'bytes=0-3');

    expect(await fake.body()).toBe('PART');
    expect(fake.status()).toBe(206);
    expect(fake.headers['content-range']).toBe('bytes 0-3/100');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { range: 'bytes=0-3' },
      redirect: 'manual',
    });
  });

  it('refuses links that were not signed by us', async () => {
    const query = signed();
    const error = await failure(
      callProxy({ ...query, s: 'forged' }, fakeResponse().response),
    );

    expect(error).toMatchObject({
      statusCode: 403,
      reason: 'MEDIA_LINK_INVALID',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not follow redirects outside Meta CDNs', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      }),
    );

    const error = await failure(callProxy(signed(), fakeResponse().response));

    expect(error).toMatchObject({
      statusCode: 502,
      reason: 'MEDIA_UNAVAILABLE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses content that is not an image or a video', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const error = await failure(callProxy(signed(), fakeResponse().response));

    expect(error).toMatchObject({ reason: 'MEDIA_TYPE_NOT_ALLOWED' });
  });

  it('reports expired CDN links as unavailable media', async () => {
    fetchMock.mockResolvedValue(new Response('denied', { status: 403 }));

    const error = await failure(callProxy(signed(), fakeResponse().response));

    expect(error).toMatchObject({
      statusCode: 404,
      reason: 'MEDIA_UNAVAILABLE',
    });
  });
});
