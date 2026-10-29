import { Environment } from '../../../config/Environment';
import { ResendEmailSender } from './ResendEmailSender';

describe('ResendEmailSender', () => {
  const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();
  let capturedUrl: string | URL | Request | undefined;
  let capturedInit: RequestInit | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedUrl = undefined;
    capturedInit = undefined;
    global.fetch = fetchMock;
    Environment.vars = {
      RESEND_API_KEY: 'resend-key',
      EMAIL_FROM: 'Pulse Lead <no-reply@example.com>',
    } as typeof Environment.vars;
  });

  it('sends through the Resend HTTP API', async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        capturedUrl = url;
        capturedInit = init;
        return Promise.resolve(new Response('', { status: 200 }));
      },
    );

    await new ResendEmailSender().send({
      to: 'user@example.com',
      subject: 'Código',
      html: '<p>123456</p>',
      text: '123456',
    });

    expect(capturedUrl).toBe('https://api.resend.com/emails');
    expect(capturedInit?.method).toBe('POST');
    expect(new Headers(capturedInit?.headers).get('Authorization')).toBe(
      'Bearer resend-key',
    );
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
    if (typeof capturedInit?.body !== 'string') throw new Error('body ausente');
    expect(JSON.parse(capturedInit.body)).toMatchObject({
      from: 'Pulse Lead <no-reply@example.com>',
      to: ['user@example.com'],
    });
  });

  it('fails when Resend rejects the request', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 422 }));

    await expect(
      new ResendEmailSender().send({
        to: 'user@example.com',
        subject: 'Código',
        html: '<p>123456</p>',
        text: '123456',
      }),
    ).rejects.toThrow('RESEND_HTTP_422');
  });
});
