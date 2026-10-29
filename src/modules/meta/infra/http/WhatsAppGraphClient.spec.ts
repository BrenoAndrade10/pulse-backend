import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { MetaConfigService } from '../config/MetaConfigService';
import { WhatsAppGraphClient } from './WhatsAppGraphClient';

describe('WhatsAppGraphClient', () => {
  let client: WhatsAppGraphClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    Environment.vars = {
      META_APP_ID: 'app-id',
      META_APP_SECRET: 'app-secret',
      META_GRAPH_API_VERSION: 'v25.0',
    } as typeof Environment.vars;
    client = new WhatsAppGraphClient(new MetaConfigService());
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('exchanges the embedded signup code with a form body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'business-token' }), {
        status: 200,
      }),
    );

    await expect(client.exchangeCode('signup-code')).resolves.toBe(
      'business-token',
    );
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v25.0/oauth/access_token');
    expect(url.search).toBe('');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(new URLSearchParams(init.body as string)).toEqual(
      new URLSearchParams({
        client_id: 'app-id',
        client_secret: 'app-secret',
        code: 'signup-code',
      }),
    );
    expect(init.signal).toBeDefined();
  });

  it('maps token debug data and target ids', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            is_valid: true,
            app_id: 'app-id',
            granular_scopes: [
              {
                scope: 'whatsapp_business_management',
                target_ids: ['123'],
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    await expect(client.debugToken('token')).resolves.toEqual({
      isValid: true,
      appId: 'app-id',
      granularScopes: [
        { scope: 'whatsapp_business_management', targetIds: ['123'] },
      ],
    });
  });

  it('treats 133010 as a registration failure', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 133010 } }), {
        status: 400,
      }),
    );

    await expect(
      client.register('456', '123456', 'token'),
    ).rejects.toMatchObject({ reason: 'WHATSAPP_GRAPH_API_ERROR' });
  });

  it('maps an existing two-step PIN to conflict', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 133005 } }), {
        status: 400,
      }),
    );

    await expect(
      client.register('456', '123456', 'token'),
    ).rejects.toMatchObject({
      statusCode: 409,
      reason: 'WHATSAPP_NUMBER_HAS_TWO_STEP_PIN',
    });
  });

  it('follows phone number cursors with a ten-page ceiling', async () => {
    for (let page = 0; page < 11; page += 1) {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: String(page) }],
            paging: { cursors: { after: `cursor-${page}` } },
          }),
          { status: 200 },
        ),
      );
    }

    await expect(client.listPhoneNumbers('123', 'token')).resolves.toHaveLength(
      10,
    );
    expect(fetchMock).toHaveBeenCalledTimes(10);
    const [lastUrl] = fetchMock.mock.calls[9] as [URL];
    expect(lastUrl.searchParams.get('after')).toBe('cursor-8');
  });

  it('returns a sanitized domain error for Meta failures', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'raw secret detail', code: 1 } }),
        { status: 400 },
      ),
    );

    await expect(client.subscribe('123', 'token')).rejects.toEqual(
      expect.objectContaining({
        reason: 'WHATSAPP_GRAPH_API_ERROR',
        data: null,
      }) as DomainError,
    );
  });
});
