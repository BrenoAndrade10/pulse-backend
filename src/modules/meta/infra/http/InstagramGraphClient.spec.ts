import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { InstagramGraphClient } from './InstagramGraphClient';

describe('InstagramGraphClient', () => {
  const client = new InstagramGraphClient();
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

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
      INSTAGRAM_GRAPH_API_VERSION: 'v25.0',
    } as typeof Environment.vars;
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('calls graph.instagram.com, where Instagram Login tokens are valid', async () => {
    respond(200, { data: [] });

    await expect(
      client.get('/ig-user/media', { limit: 10 }, 'ig-token'),
    ).resolves.toEqual({ data: [] });

    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin).toBe('https://graph.instagram.com');
    expect(url.pathname).toBe('/v25.0/ig-user/media');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('access_token')).toBe('ig-token');
  });

  it('asks for a new connection when Meta rejects the token', async () => {
    respond(400, {
      error: { code: 190, message: 'Error validating access token' },
    });

    const error = await failure(client.get('/me/media', {}, 'ig-token'));

    expect(error).toMatchObject({
      statusCode: 409,
      reason: 'INSTAGRAM_ACCESS_TOKEN_INVALID',
    });
  });

  it('reports other Meta errors without leaking the token', async () => {
    respond(500, { error: { code: 2, message: 'Service temporarily down' } });

    const error = await failure(client.get('/me/media', {}, 'ig-token'));

    expect(error).toMatchObject({
      statusCode: 502,
      reason: 'INSTAGRAM_GRAPH_API_ERROR',
    });
    expect(JSON.stringify(error.data)).toContain('Service temporarily down');
    expect(JSON.stringify(error.data)).not.toContain('ig-token');
  });

  it('reports network failures as unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const error = await failure(client.get('/me/media', {}, 'ig-token'));

    expect(error).toMatchObject({
      statusCode: 502,
      reason: 'INSTAGRAM_GRAPH_API_UNAVAILABLE',
    });
  });

  it('sends the private reply with the token in the Authorization header', async () => {
    respond(200, { recipient_id: '526', message_id: 'aWdf' });

    await expect(
      client.sendPrivateReply({
        instagramUserId: 'ig-user',
        commentId: 'comment-1',
        text: 'Aqui está o link!',
        accessToken: 'ig-token',
      }),
    ).resolves.toEqual({ messageId: 'aWdf' });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://graph.instagram.com/v25.0/ig-user/messages',
    );
    expect(url.searchParams.has('access_token')).toBe(false);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer ig-token' });
    expect(JSON.parse(init.body as string)).toEqual({
      recipient: { comment_id: 'comment-1' },
      message: { text: 'Aqui está o link!' },
    });
  });

  it('subscribes the account to the comments webhook', async () => {
    respond(200, { success: true });

    await client.subscribeToComments('ig-token');

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v25.0/me/subscribed_apps');
    expect(url.searchParams.get('subscribed_fields')).toBe('comments');
    expect(url.searchParams.get('access_token')).toBe('ig-token');
    expect(init.method).toBe('POST');
  });

  it('sends the private reply as a button template when there is a button', async () => {
    respond(200, { message_id: 'm-1' });

    await client.sendPrivateReply({
      instagramUserId: 'ig-user',
      commentId: 'comment-1',
      text: 'Aqui está!',
      button: { label: 'Ver material', url: 'https://site.com/x' },
      accessToken: 'ig-token',
    });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      recipient: { comment_id: 'comment-1' },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: 'Aqui está!',
            buttons: [
              {
                type: 'web_url',
                url: 'https://site.com/x',
                title: 'Ver material',
              },
            ],
          },
        },
      },
    });
  });

  it('replies to the comment', async () => {
    respond(200, { id: 'reply-1' });

    await client.replyToComment({
      commentId: 'comment-1',
      text: 'Te mandei no direct!',
      accessToken: 'ig-token',
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v25.0/comment-1/replies');
    expect(url.searchParams.get('access_token')).toBe('ig-token');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      message: 'Te mandei no direct!',
    });
  });
});
