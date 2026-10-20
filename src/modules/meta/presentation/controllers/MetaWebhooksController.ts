import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { DomainError } from '../../../../shared/errors/DomainError';
import { HandleMetaWebhookUseCase } from '../../application/use-cases/HandleMetaWebhookUseCase';
import type { MetaWebhookPayload } from '../../domain/types/MetaWebhookPayload';
import { MetaConfigService } from '../../infra/config/MetaConfigService';
import { Public } from '../../../../shared/presentation/decorators/Public';

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

@Public()
@Controller('meta/webhooks')
export class MetaWebhooksController {
  constructor(
    private readonly metaConfigService: MetaConfigService,
    private readonly handleMetaWebhookUseCase: HandleMetaWebhookUseCase,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const expectedToken = this.metaConfigService.webhookVerifyToken;

    if (!expectedToken) {
      throw new DomainError(500, 'META_WEBHOOK_VERIFY_TOKEN_NOT_CONFIGURED');
    }

    if (mode !== 'subscribe' || verifyToken !== expectedToken || !challenge) {
      throw new DomainError(403, 'META_WEBHOOK_FORBIDDEN');
    }

    return challenge;
  }

  @Post()
  @HttpCode(200)
  receiveWebhook(
    @Body() body: MetaWebhookPayload,
    @Req() request: RawBodyRequest,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    console.log(body);

    this.validateSignature(request, signature);

    return this.handleMetaWebhookUseCase.execute(body);
  }

  private validateSignature(request: RawBodyRequest, signature?: string): void {
    const secrets = [
      this.metaConfigService.instagramAppSecret,
      this.metaConfigService.appSecret,
    ].filter((secret): secret is string => Boolean(secret));

    if (secrets.length === 0) {
      throw new DomainError(503, 'META_WEBHOOK_SECRET_NOT_CONFIGURED');
    }

    if (!request.rawBody || !signature?.startsWith('sha256=')) {
      throw new DomainError(403, 'META_WEBHOOK_SIGNATURE_INVALID');
    }

    const receivedBuffer = Buffer.from(
      signature.slice('sha256='.length),
      'hex',
    );
    const rawBody = request.rawBody;
    const valid = secrets.some((secret) => {
      const expectedBuffer = createHmac('sha256', secret)
        .update(rawBody)
        .digest();

      return (
        expectedBuffer.length === receivedBuffer.length &&
        timingSafeEqual(expectedBuffer, receivedBuffer)
      );
    });

    if (!valid) {
      throw new DomainError(403, 'META_WEBHOOK_SIGNATURE_INVALID');
    }
  }
}
