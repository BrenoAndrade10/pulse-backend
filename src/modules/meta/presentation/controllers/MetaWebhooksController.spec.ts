import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { HandleMetaWebhookUseCase } from '../../application/use-cases/HandleMetaWebhookUseCase';
import { MetaConfigService } from '../../infra/config/MetaConfigService';
import { MetaWebhooksController } from './MetaWebhooksController';

describe('MetaWebhooksController', () => {
  let controller: MetaWebhooksController;

  beforeEach(() => {
    const config = new MetaConfigService();
    const handleWebhookUseCase = new HandleMetaWebhookUseCase();

    controller = new MetaWebhooksController(config, handleWebhookUseCase);
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

  it('receives webhook payloads when signature validation is not configured', () => {
    expect(
      controller.receiveWebhook(
        {
          object: 'instagram',
          entry: [{ id: 'page-id', time: 1 }],
        },
        {} as Request,
      ),
    ).toEqual({
      received: true,
      entries: 1,
    });
  });

  it('validates Meta webhook signatures when app secret is configured', () => {
    Environment.vars.META_APP_SECRET = 'app-secret';
    const rawBody = Buffer.from(
      JSON.stringify({
        object: 'instagram',
        entry: [{ id: 'page-id', time: 1 }],
      }),
    );
    const signature = `sha256=${createHmac('sha256', 'app-secret')
      .update(rawBody)
      .digest('hex')}`;

    expect(
      controller.receiveWebhook(
        {
          object: 'instagram',
          entry: [{ id: 'page-id', time: 1 }],
        },
        { rawBody } as Request & { rawBody: Buffer },
        signature,
      ),
    ).toEqual({
      received: true,
      entries: 1,
    });
  });

  it('rejects invalid Meta webhook signatures', () => {
    Environment.vars.META_APP_SECRET = 'app-secret';

    expect(() =>
      controller.receiveWebhook(
        {
          object: 'instagram',
          entry: [{ id: 'page-id', time: 1 }],
        },
        { rawBody: Buffer.from('{}') } as Request & { rawBody: Buffer },
        'sha256=invalid',
      ),
    ).toThrow(DomainError);
  });
});
