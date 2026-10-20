import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { HandleMetaWebhookUseCase } from '../../application/use-cases/HandleMetaWebhookUseCase';
import { MetaConfigService } from '../../infra/config/MetaConfigService';
import { MetaWebhooksController } from './MetaWebhooksController';

describe('MetaWebhooksController', () => {
  const payload = { object: 'instagram', entry: [{ id: 'ig-id', time: 1 }] };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const sign = (secret: string) =>
    `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const request = { rawBody } as Request & { rawBody: Buffer };
  let handleWebhook: jest.Mocked<Pick<HandleMetaWebhookUseCase, 'execute'>>;
  let controller: MetaWebhooksController;

  beforeEach(() => {
    handleWebhook = {
      execute: jest.fn().mockResolvedValue({ received: true, entries: 1 }),
    };
    controller = new MetaWebhooksController(
      new MetaConfigService(),
      handleWebhook as unknown as HandleMetaWebhookUseCase,
    );
    Environment.vars = {
      PORT: 3000,
      META_GRAPH_API_VERSION: 'v21.0',
    } as typeof Environment.vars;
  });

  it('returns the challenge when Meta webhook verification is valid', () => {
    Environment.vars.META_WEBHOOK_VERIFY_TOKEN = 'verify-token';

    expect(
      controller.verifyWebhook('subscribe', 'verify-token', 'challenge-code'),
    ).toBe('challenge-code');
  });

  it('rejects Meta webhook verification with an invalid token', () => {
    Environment.vars.META_WEBHOOK_VERIFY_TOKEN = 'verify-token';

    expect(() =>
      controller.verifyWebhook('subscribe', 'wrong-token', 'challenge-code'),
    ).toThrow(DomainError);
  });

  it('rejects Meta webhook verification when verify token is not configured', () => {
    expect(() =>
      controller.verifyWebhook('subscribe', 'verify-token', 'challenge-code'),
    ).toThrow(DomainError);
  });

  it('refuses every webhook when no app secret is configured', () => {
    expect(() =>
      controller.receiveWebhook(payload, request, sign('any')),
    ).toThrow(
      expect.objectContaining({
        reason: 'META_WEBHOOK_SECRET_NOT_CONFIGURED',
      }) as Error,
    );
    expect(handleWebhook.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['Instagram app secret', 'INSTAGRAM_APP_SECRET'],
    ['Meta app secret', 'META_APP_SECRET'],
  ] as const)('accepts payloads signed with the %s', async (_, variable) => {
    Environment.vars[variable] = 'app-secret';

    await expect(
      controller.receiveWebhook(payload, request, sign('app-secret')),
    ).resolves.toEqual({ received: true, entries: 1 });
    expect(handleWebhook.execute).toHaveBeenCalledWith(payload);
  });

  it.each([
    ['a wrong signature', 'sha256=invalid'],
    ['another secret', sign('other-secret')],
    ['no signature', undefined],
  ])('rejects payloads with %s', (_, signature) => {
    Environment.vars.INSTAGRAM_APP_SECRET = 'app-secret';

    expect(() =>
      controller.receiveWebhook(payload, request, signature),
    ).toThrow(
      expect.objectContaining({
        reason: 'META_WEBHOOK_SIGNATURE_INVALID',
      }) as Error,
    );
    expect(handleWebhook.execute).not.toHaveBeenCalled();
  });
});
