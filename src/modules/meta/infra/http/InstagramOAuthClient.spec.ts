import { Environment } from '../../../../config/Environment';
import { InstagramOAuthError } from '../../domain/services/InstagramOAuthGateway';
import {
  INSTAGRAM_REQUIRED_PERMISSIONS,
  InstagramOAuthClient,
} from './InstagramOAuthClient';

const SECRET = 'app-secret-value';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const grantedPermissions = () => ({
  data: INSTAGRAM_REQUIRED_PERMISSIONS.map((permission) => ({
    permission,
    status: 'granted',
  })),
});

describe('InstagramOAuthClient', () => {
  const client = new InstagramOAuthClient();
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    Environment.vars = {
      META_APP_ID: '990602627938098',
      META_APP_SECRET: SECRET,
      META_GRAPH_API_VERSION: 'v25.0',
      INSTAGRAM_CONFIG_ID: '1886441355699639',
      INSTAGRAM_REDIRECT_URI: 'https://api.example.com/meta/instagram/callback',
    } as typeof Environment.vars;
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('builds Facebook Login for Business without legacy Instagram scopes', () => {
    const url = new URL(client.buildAuthorizationUrl('state-123'));

    expect(url.origin + url.pathname).toBe(
      'https://www.facebook.com/dialog/oauth',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: '990602627938098',
      config_id: '1886441355699639',
      display: 'popup',
      redirect_uri: 'https://api.example.com/meta/instagram/callback',
      response_type: 'code',
      override_default_response_type: 'true',
      state: 'state-123',
    });
    expect(url.searchParams.has('scope')).toBe(false);
  });

  it('exchanges the code with the Facebook Graph endpoint and a form body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ access_token: 'short', expires_in: 3600 }),
    );

    await expect(client.exchangeCode('the-code')).resolves.toEqual({
      accessToken: 'short',
      expiresInSeconds: 3600,
    });

    const [rawUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(rawUrl);
    const form = init.body as URLSearchParams;

    expect(url.toString()).toBe(
      'https://graph.facebook.com/v25.0/oauth/access_token',
    );
    expect(init.method).toBe('POST');
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('client_id')).toBe('990602627938098');
    expect(form.get('client_secret')).toBe(SECRET);
    expect(form.get('code')).toBe('the-code');
    expect(form.get('redirect_uri')).toBe(
      'https://api.example.com/meta/instagram/callback',
    );
    expect(rawUrl).not.toContain(SECRET);
    expect(rawUrl).not.toContain('the-code');
  });

  it('exchanges a short-lived user token without putting it in the URL', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ access_token: 'long', expires_in: 5_184_000 }),
    );

    await expect(client.exchangeForLongLivedToken('short')).resolves.toEqual({
      accessToken: 'long',
      expiresInSeconds: 5_184_000,
    });

    const [rawUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as URLSearchParams;

    expect(form.get('grant_type')).toBe('fb_exchange_token');
    expect(form.get('fb_exchange_token')).toBe('short');
    expect(rawUrl).not.toContain('short');
  });

  it('validates permissions and resolves the authorized Instagram account through Pages', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(grantedPermissions()))
      .mockResolvedValueOnce(jsonResponse({ id: 'facebook-user' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 'page-1',
              name: 'Page One',
              access_token: 'page-token',
              tasks: ['PROFILE_PLUS_MESSAGING', 'PROFILE_PLUS_MODERATE'],
              instagram_business_account: { id: 'ig-1' },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: 'ig-1', username: 'carlaexpert' }),
      );

    await expect(client.getAuthorizedAccount('user-token')).resolves.toEqual({
      authorizingUserId: 'facebook-user',
      permissions: [...INSTAGRAM_REQUIRED_PERMISSIONS],
      accessToken: 'page-token',
      userId: 'ig-1',
      username: 'carlaexpert',
      pageId: 'page-1',
      pageName: 'Page One',
      pageTasks: ['PROFILE_PLUS_MESSAGING', 'PROFILE_PLUS_MODERATE'],
    });

    for (const [rawUrl, init] of fetchMock.mock.calls) {
      const url = new URL(rawUrl as string);
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(url.searchParams.has('access_token')).toBe(false);
      expect(headers.Authorization).toMatch(/^Bearer /);
    }
  });

  it('rejects when the configuration did not grant every required permission', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          { permission: 'instagram_basic', status: 'granted' },
          { permission: 'pages_show_list', status: 'declined' },
        ],
      }),
    );

    await expect(client.getAuthorizedAccount('user-token')).rejects.toEqual(
      expect.objectContaining({ reason: 'missing_permissions' }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an account when the user lacks required Page tasks', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(grantedPermissions()))
      .mockResolvedValueOnce(jsonResponse({ id: 'facebook-user' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 'page-1',
              name: 'Page One',
              access_token: 'page-token',
              tasks: ['MODERATE'],
              instagram_business_account: { id: 'ig-1' },
            },
          ],
        }),
      );

    await expect(client.getAuthorizedAccount('user-token')).rejects.toEqual(
      expect.objectContaining({ reason: 'missing_permissions' }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reports safe diagnostics when no Page is returned', async () => {
    const run = async (data: unknown[]) => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(grantedPermissions()))
        .mockResolvedValueOnce(jsonResponse({ id: 'facebook-user' }))
        .mockResolvedValueOnce(jsonResponse({ data }));

      return client.getAuthorizedAccount('user-token');
    };

    const zeroPagesError = (await run([]).catch(
      (error: unknown) => error,
    )) as Error & {
      reason?: string;
    };

    expect(zeroPagesError).toMatchObject({ reason: 'no_instagram_account' });
    expect(zeroPagesError.message).toContain(
      `(paginas=0, comInstagram=0, comToken=0, permissoes=${INSTAGRAM_REQUIRED_PERMISSIONS.join(',')})`,
    );

    fetchMock.mockReset();

    const withoutInstagramError = (await run([
      {
        id: 'page-1',
        name: 'Private Page Name',
        access_token: 'page-token',
        tasks: ['PROFILE_PLUS_MESSAGING', 'PROFILE_PLUS_MODERATE'],
      },
    ]).catch((error: unknown) => error)) as Error & { reason?: string };

    expect(withoutInstagramError).toMatchObject({
      reason: 'no_instagram_account',
    });
    expect(withoutInstagramError.message).toContain(
      `(paginas=1, comInstagram=0, comToken=1, permissoes=${INSTAGRAM_REQUIRED_PERMISSIONS.join(',')})`,
    );
    expect(withoutInstagramError.message).not.toContain('Private Page Name');
    expect(withoutInstagramError.message).not.toContain('page-1');
    expect(withoutInstagramError.message).not.toContain('page-token');
  });

  it('rejects multiple professional accounts instead of guessing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(grantedPermissions()));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'facebook-user' }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: 'page-1',
            name: 'One',
            access_token: 'page-1-token',
            instagram_business_account: { id: 'ig-1' },
          },
          {
            id: 'page-2',
            name: 'Two',
            access_token: 'page-2-token',
            instagram_business_account: { id: 'ig-2' },
          },
        ],
      }),
    );

    await expect(client.getAuthorizedAccount('user-token')).rejects.toEqual(
      expect.objectContaining({ reason: 'multiple_instagram_accounts' }),
    );
  });

  it('never leaks secrets or tokens in provider errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 100,
            message: `Invalid ${SECRET} very-secret-token`,
          },
        },
        400,
      ),
    );

    const error = (await client
      .exchangeForLongLivedToken('very-secret-token')
      .catch((caught: unknown) => caught)) as Error;

    expect(error).toBeInstanceOf(InstagramOAuthError);
    expect(error.message).toContain('Meta respondeu 400');
    expect(error.message).not.toContain(SECRET);
    expect(error.message).not.toContain('very-secret-token');
  });

  it('reports itself as not configured when unified login data is missing', () => {
    Environment.vars.INSTAGRAM_CONFIG_ID = undefined;

    expect(client.isConfigured()).toBe(false);
    expect(() => client.buildAuthorizationUrl('s')).toThrow(
      InstagramOAuthError,
    );
  });
});
