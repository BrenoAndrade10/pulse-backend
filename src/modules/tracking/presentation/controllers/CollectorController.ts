import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Public } from '../../../../shared/presentation/decorators/Public';
import { CollectEventsUseCase } from '../../application/collector/CollectEventsUseCase';
import {
  GetPixelConfigUseCase,
  type PublicPixelConfig,
} from '../../application/collector/GetPixelConfigUseCase';
import { WindowRateLimiter } from '../../infra/collector/MemoryCache';

const CONFIG_REQUESTS_PER_IP_PER_MINUTE = 300;

@Public()
@Controller('t')
export class CollectorController {
  private readonly logger = new Logger(CollectorController.name);
  private readonly configLimiter = new WindowRateLimiter(
    CONFIG_REQUESTS_PER_IP_PER_MINUTE,
    60_000,
  );

  constructor(
    private readonly getConfig: GetPixelConfigUseCase,
    private readonly collect: CollectEventsUseCase,
  ) {}

  @Get(':publicKey/config')
  async config(
    @Param('publicKey') publicKey: string,
    @Query('page') page: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicPixelConfig> {
    if (!this.configLimiter.take(request.ip ?? '')) {
      throw new DomainError(429, 'TOO_MANY_ATTEMPTS');
    }

    const config = await this.getConfig.execute(
      publicKey,
      typeof page === 'string' ? page : undefined,
    );
    if (!config) throw new NotFoundException();

    response.setHeader('Cache-Control', 'public, max-age=60');
    return config;
  }

  @Post(':publicKey/events')
  @HttpCode(204)
  async events(
    @Param('publicKey') publicKey: string,
    @Headers('origin') origin: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<void> {
    try {
      await this.collect.execute({
        publicKey,
        origin,
        userAgent: userAgent ?? '',
        ip: request.ip ?? '',
        body,
      });
    } catch (error) {
      this.logger.error(`Lote de eventos descartado: ${String(error)}`);
    }
  }
}
