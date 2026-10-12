import {
  Body,
  Controller,
  Get,
  Headers,
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
  receiveWebhook(
    @Body() body: MetaWebhookPayload,
    @Req() request: RawBodyRequest,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    this.validateSignatureIfConfigured(request, signature);

    return this.handleMetaWebhookUseCase.execute(body);
  }

  private validateSignatureIfConfigured(
    request: RawBodyRequest,
    signature?: string,
  ): void {
    const appSecret = this.metaConfigService.appSecret;

    if (!appSecret) {
      return;
    }

    if (!request.rawBody || !signature?.startsWith('sha256=')) {
      throw new DomainError(403, 'META_WEBHOOK_SIGNATURE_INVALID');
    }

    const expectedSignature = createHmac('sha256', appSecret)
      .update(request.rawBody)
      .digest('hex');
    const receivedSignature = signature.replace('sha256=', '');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(receivedSignature, 'hex');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new DomainError(403, 'META_WEBHOOK_SIGNATURE_INVALID');
    }
  }
}
