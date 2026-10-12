import { Environment } from '../../../../config/Environment';
import { InstagramOAuthError } from '../../domain/services/InstagramOAuthGateway';
import { InstagramOAuthClient } from './InstagramOAuthClient';

const SECRET = 'app-secret-value';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('InstagramOAuthClient', () => {
  const client = new InstagramOAuthClient();
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    Environment.vars = {
      INSTAGRAM_APP_ID: '990602627938098',
      INSTAGRAM_APP_SECRET: SECRET,
      INSTAGRAM_REDIRECT_URI: 'https://api.example.com/meta/instagram/callback',
      INSTAGRAM_SCOPES: 'instagram_business_basic',
      INSTAGRAM_GRAPH_API_VERSION: 'v25.0',
    } as typeof Environment.vars;
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('builds the authorization URL with the registered redirect URI', () => {
    const url = new URL(client.buildAuthorizationUrl('state-123'));

    expect(url.origin + url.pathname).toBe(
      'https://www.instagram.com/oauth/authorize',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: '990602627938098',
      redirect_uri: 'https://api.example.com/meta/instagram/callback',
      response_type: 'code',
      scope: 'instagram_business_basic',
      state: 'state-123',
    });
  });

  it('exchanges the code with a form POST and reads the data[] response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          {
            access_token: 'short',
            user_id: 111,
            permissions:
              'instagram_business_basic,instagram_business_manage_comments',
          },
        ],
      }),
    );

    await expect(client.exchangeCode('the-code')).resolves.toEqual({
      accessToken: 'short',
      appScopedUserId: '111',
      permissions: [
        'instagram_business_basic',
        'instagram_business_manage_comments',
      ],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    expect(url).toBe('https://api.instagram.com/oauth/access_token');
    expect(init.method).toBe('POST');
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('the-code');
    expect(form.get('redirect_uri')).toBe(
      'https://api.example.com/meta/instagram/callback',
    );
  });

  it('also accepts the legacy flat token response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ access_token: 'short', user_id: '111', permissions: [] }),
    );

    await expect(client.exchangeCode('c')).resolves.toMatchObject({
      accessToken: 'short',
      appScopedUserId: '111',
    });
  });

  it('never leaks secrets or tokens in error messages', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error_message: 'Invalid authorization code' }, 400),
    );

    const error = (await client
      .exchangeForLongLivedToken('very-secret-token')
      .catch((caught: unknown) => caught)) as Error;

    expect(error).toBeInstanceOf(InstagramOAuthError);
    expect(error.message).toContain('Invalid authorization code');
    expect(error.message).not.toContain(SECRET);
    expect(error.message).not.toContain('very-secret-token');
  });

  it('reads the profile from the versioned /me endpoint', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ user_id: 178414, username: 'carlaexpert' }),
    );

    await expect(client.getProfile('long')).resolves.toEqual({
      userId: '178414',
      username: 'carlaexpert',
    });

    const url = new URL((fetchMock.mock.calls[0] as [string])[0]);
    expect(url.pathname).toBe('/v25.0/me');
    expect(url.searchParams.get('fields')).toBe('user_id,username');
  });

  it('reports itself as not configured when credentials are missing', () => {
    Environment.vars.INSTAGRAM_APP_SECRET = undefined;

    expect(client.isConfigured()).toBe(false);
    expect(() => client.buildAuthorizationUrl('s')).toThrow(
      InstagramOAuthError,
    );
  });
});
